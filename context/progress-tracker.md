# Progress Tracker

Update this file after every meaningful implementation change.

"Verified" means there is an automated test, a logged manual check, or a live check. Everything else is listed under "not verified", even if the code exists.

## Current Phase

- API: deployed on Render. Auth, rides, vehicles and bookings endpoints exist; booking concurrency verified against a test database (2026-10-08); the CHECK migration is applied to the test branch and to production (2026-10-09). Roles, admin user/session endpoints and cookie refresh are implemented and verified on the test branch (2026-10-09), not yet deployed or migrated in production.
- Mobile: auth screens only (splash, onboarding, login, signup, placeholder Home).
- Web: client-side foundation built and verified live against the production API (2026-10-12): proxy, API client, auth, login, guarded /admin, users-count placeholder; 39 Vitest tests. Next: the real users table.

## Done (verified)

- **API deploy on Render.** `prisma.config.ts` was being compiled into the app build, which moved output to `dist/src/main.js` while `start:prod` runs `node dist/main`. Fixed by excluding it in `tsconfig.build.json`; `build` runs `prisma generate` first (Prisma 7 has no postinstall generate). Added `GET /health`. (`render.yaml` was later deleted; the service is configured in the Render dashboard, see Deploy and Production Notes.) Checked live: `/health`, register (201), duplicate email (409).
- **Email/password auth.** `POST /auth/register`, `/auth/login`, `/auth/refresh`, `/auth/logout`, `GET /auth/me`. Manual check against a local API (Oct 3): register 201, duplicate 409, short password 400, wrong password 401, login -> `/auth/me` -> refresh -> logout -> refresh 401. Test user deleted afterwards.
- **Refresh tokens.** 15 min access JWT; opaque refresh tokens stored as SHA-256 hashes, rotated on every use, token families with reuse detection and a 30 s grace window (`src/auth/tokens.service.ts`). Covered by `tokens.service.spec.ts`.
- **`JwtAuthGuard`** (`src/auth/jwt-auth.guard.ts`). The Oct 3 manual run called `GET /auth/me`, which goes through the guard (with a valid token it returned the user). Rides and vehicles routes using the same guard have no logged check of their own.
- **Schema and migrations.** Migrations `init`, `add_fuel_cost_split`, `vipps_login_refresh_tokens` applied (checked Oct 3).
- **Seat booking concurrency** (`POST /bookings`, `src/bookings/bookings.service.ts`), verified 2026-10-08 by `test/bookings.concurrency.e2e-spec.ts`. It runs against a dedicated Neon branch (`apps/api/.env.test`, not committed) with a real database and no Prisma mocks, through HTTP with the real guard and validation. Each case runs at `BOOKING_TEST_DELAY_MS` 0 and 200 (a test-only delay between the seat check and the decrement; ignored when `NODE_ENV=production`):
  - A: 1 seat, 10 riders -> exactly 1 booking, 9 x 409 `SEAT_NO_LONGER_AVAILABLE`, `seatsAvailable` 0.
  - B: 3 seats, 10 riders -> exactly 3 bookings, `seatsAvailable` 0.
  - C: same rider x 5 -> 1 booking, 4 x 409 `ALREADY_BOOKED`, no 500s, `seatsAvailable` = total - 1.
  - Negative control (not committed): with `FOR UPDATE` and the CHECKs removed, A and B at 200 ms fail with 10 bookings and `seatsAvailable` -9 / -7. With only `FOR UPDATE` removed and the CHECKs kept, the data stays correct (the losing transactions roll back) but clients get 500 instead of 409 (A: 1 x 201 + 9 x 500; B: 3 x 201 + 7 x 500; Prisma P2039 wrapping Postgres 23514). Re-run 2026-10-09 on the test branch.
  - Booking errors return `{ statusCode, error, code, message }`: `RIDE_NOT_FOUND` (404), `CANNOT_BOOK_OWN_RIDE`, `RIDE_NOT_ACTIVE`, `SEAT_NO_LONGER_AVAILABLE`, `ALREADY_BOOKED` (409).
  - Run: `npx jest --config ./test/jest-e2e.json test/bookings.concurrency.e2e-spec.ts` in `apps/api`. The scaffold `test/app.e2e-spec.ts` is unrelated and does not pass.
- **Roles and admin endpoints** (2026-10-09), verified by `test/admin.e2e-spec.ts` (12 tests, real AppModule and database, test branch only):
  - `@Roles()` + `RolesGuard` (`src/auth/roles.*.ts`). The guard reads the user's *current* role from the database, not the JWT, so a demoted admin gets 403 `FORBIDDEN` immediately (tested: demote, then the old token gets 403). Non-admins get 403 `{ statusCode, error, code: 'FORBIDDEN', message }` on all five `/admin/*` routes.
  - `GET /admin/users` (search, role, page, pageSize; explicit select, no password hash; `activeSessionCount` = token families with a live token), `PATCH /admin/users/:id/role`, `GET /admin/users/:id/sessions`, `DELETE /admin/sessions/:familyId` (204; 404 `SESSION_NOT_FOUND` for an unknown family), `POST /admin/users/:id/revoke-all` (204).
  - Guard rails: 409 `CANNOT_CHANGE_OWN_ROLE`; 409 `LAST_ADMIN`. `LAST_ADMIN` is only reachable through a race (the caller must be an admin to get past the guard), so it is tested by two admins demoting each other concurrently via `AdminService.updateRole` (5 rounds: exactly one succeeds, one admin remains). The admin rows are locked `FOR UPDATE`. Negative control: without the lock both demotions succeed and zero admins remain.
  - Revoking a session (or revoke-all) makes its refresh token return 401 on `/auth/refresh`; the other sessions keep working.
  - `RefreshToken.userAgent` and `lastUsedAt` (migration `20261009130000_refresh_token_session_meta`) are set on login and on every rotation; `userAgent` is truncated to 255 chars.
  - `npm run user:promote -- <email>` promotes an existing user to ADMIN (idempotent, never creates users, prints no secrets). Checked on the test branch: not found (exit 1), promoted, already admin, no argument (exit 2). It uses whatever `DATABASE_URL` is set, so pass the production URL deliberately.
- **Cookie refresh and CORS allowlist** (2026-10-09), verified by `test/auth-cookie.e2e-spec.ts` (12 tests):
  - `/auth/login` and `/auth/refresh` set `refresh_token` as an httpOnly, Secure, SameSite=Lax cookie, path `/auth` (override with `REFRESH_COOKIE_PATH`, needed if the web proxy serves the API under a prefix such as `/api/auth`). The token is still in the body for mobile.
  - With the request header `X-Client: web`, `/auth/login` and `/auth/refresh` omit `refresh_token` from the JSON body (cookie only), so page scripts can never read it. Without the header (mobile) the body is unchanged. Tested both ways in `test/auth-cookie.e2e-spec.ts` (34 e2e tests passing across the three suites on 2026-10-11).
  - `/auth/refresh` and `/auth/logout` accept the token from the body or the cookie; logout and a rejected refresh clear the cookie. The tests caught a bug: a request with no body made `body.refresh_token` throw (Express 5 leaves `req.body` undefined), a 500 on every cookie-only refresh. Fixed.
  - Every response under `/auth/*` and `/admin/*` (including 401/403/404) carries `Cache-Control: no-store`, so the browser never stores or revalidates tokens, sessions or admin data (DevTools showed 304s on `/auth/me` and `/admin/users` before this). Set in `configureApp()` (`noStoreForSensitiveRoutes`); tested in `test/cache-control.e2e-spec.ts` (4 tests; the 2 positive ones fail with the middleware disabled).
  - CORS: `origin` is the allowlist in `CORS_ORIGINS` (comma-separated, exact origins), `credentials: true`; unset means no origin is allowed (replaces `origin: true`). `.env.example` added with `localhost:3000`.
  - `test/load-test-env.ts` (run before every e2e spec) refuses to run if `.env.test`'s `DATABASE_URL` or `DIRECT_URL` has the same host as main (from `apps/api/.env` and/or `MAIN_DB_HOST`, `-pooler` ignored), and also if it cannot tell which host is main (no `.env` and no `MAIN_DB_HOST`). Checked against fake env files for 8 combinations.
  - The e2e jest config now transforms ESM-only `jose` so the real `AuthModule` loads in tests (`test/jest-e2e.json`).
  - Run: `npx jest --config ./test/jest-e2e.json test/bookings.concurrency.e2e-spec.ts test/admin.e2e-spec.ts test/auth-cookie.e2e-spec.ts` in `apps/api`: 3 suites, 30 tests passed on 2026-10-09.
- **Web foundation** (`apps/web`, 2026-10-11; unit-tested, and checked live against the production API on 2026-10-12):
  - `next.config.ts` rewrites `/api/:path*` to `${API_ORIGIN}/:path*` (`.env.local`, template in `.env.example`; 60 s proxy timeout for Render cold starts). The browser only calls `/api/...`, so the refresh cookie (`Path=/api/auth`, `REFRESH_COOKIE_PATH` on Render) is same-origin and no CORS is involved.
  - `lib/api`: typed fetch client, access token in memory only, `ApiError { status, code, message }`, zod schemas (login, `/auth/me`, `/admin/users`). Requests send `X-Client: web`, so the API returns the refresh token only in the httpOnly cookie and the schemas never expect it.
  - `lib/auth`: `AuthProvider`/`useAuth()` (`loading | authenticated | anonymous`), session restore on load (cookie refresh then `/auth/me`), logout, TanStack Query provider.
  - Routes: `/login` (labelled form, aria-live error, disabled while pending, safe `?next`), `/admin` guard (skeleton / redirect to `/login?next=` / in-page 403 for non-admins, no redirect loop), header with email + Log out, `/admin/users` placeholder showing the total from `GET /api/admin/users`, `/` redirects to `/admin`.
  - Tests (`npm test` in `apps/web`, Vitest + Testing Library): 3 parallel 401s -> exactly 1 refresh and 3 retries; refresh 401 -> anonymous; network error / 5xx on refresh do not log out; React StrictMode sends one refresh; network retry with the "Connection problem, retrying…" notice; non-ADMIN sees the 403 page; login form behaviour; `safeNextPath`. Negative controls: without the shared refresh promise the parallel-401 test sees 3 refreshes and the StrictMode test sees 2.
  - Fixed on the way: `globals.css` used Tailwind 3 directives under Tailwind 4 (utilities were generated but the base reset was missing).
  - **Live check (2026-10-12, manual, `npm run dev` on `localhost:3000` against production via the proxy; the admin entered their own password).** All 7 steps passed: `/` and `/admin` sent a logged-out visitor to `/login?next=…`; login landed on `/admin/users` showing the total and the header with email + Log out; the `refresh_token` cookie was HttpOnly, Secure, SameSite=Lax, `Path=/api/auth`, with the login response body free of `refresh_token` and nothing in Local/Session storage; a reload stayed logged in with exactly one `POST /api/auth/refresh` followed by `GET /api/auth/me`; Log out cleared the cookie and a reload stayed on `/login`; opening `/admin/users` while logged out redirected to `/login?next=%2Fadmin%2Fusers` and returned there after login. Before the login step, curl through the proxy confirmed `/api/health` 200, `/api/auth/refresh` without a cookie 401 `INVALID_REFRESH_TOKEN`, a wrong password 401, and `/api/admin/users` without a token 401.
- **Passing specs without `DATABASE_URL`:** 3 suites, 16 tests (tokens, Vipps auth service, app controller).

## Done (not verified)

- **`CHECK` constraints on `Ride`** (migration `20261008104552_ride_seats_check`): `seatsAvailable >= 0` and `seatsAvailable <= seatsTotal`. Applied to the test branch and, on 2026-10-09, to production main with `prisma migrate deploy` (done by hand by the owner; no output logged here). Before that, the production `Ride` rows were checked read-only: none violated either constraint. A violation that slips past the row lock now maps to 409 `SEAT_NO_LONGER_AVAILABLE` (`bookings.service.ts`, unit-tested with a stubbed Prisma in `bookings.service.spec.ts`; not re-run against the real database).
- **Rides** (guard on create/update): create, list, get by id, update (owner only; cancelling is `PATCH` with `status`). No delete. `rides.service.spec.ts` and `rides.controller.spec.ts` exist but fail at import (see Open Questions).
- **Vehicles** (guard on all routes): create, list own (`GET /vehicles/mine`). Same failing-spec situation.
- **Vipps Login.** Code kept but dormant: backend `src/auth/vipps/*` (fails closed with no `VIPPS_*` env), mobile `src/auth/vippsLogin.ts` (not imported by any screen). Callback/exchange logic has unit tests, but it has never run against real credentials; those need a Norwegian organisation number.
- **Payment is mocked.** `paymentStatus` is `MOCK_UNPAID` (default) / `MOCK_PAID`; no code writes it.
- **Mobile auth.** Login and Signup screens, `AuthContext`, SecureStore token storage, API client with 401 -> single refresh -> one retry, placeholder Home. No logged run on a device or emulator.

## Next Up

In this order:

1. Read endpoints for the web dashboard (rides, bookings).
2. Web dashboard, built as a client-side React + TypeScript app on the Next.js 16 scaffold: App Router for routing only, `"use client"` pages, React Query, own `AuthProvider` with the access token in memory. No server actions, no server-side auth, no data fetching in server components. Proxy `/api` to the Render API via `rewrites` so the refresh cookie is same-origin.
3. Mobile: ride list, ride detail, create ride, booking flow.
4. Make the unit specs mock `PrismaService` so they run without a database.

## Deploy and Production Notes

- **Render service `coride`** is configured in the dashboard, not in the repo (`render.yaml` deleted). Root Directory `apps/api`; Pre-Deploy Command empty.
- **Build command:** `npm install --include=dev && npm run build`. `NODE_ENV=production` on Render makes npm skip devDependencies, which removed `@nestjs/cli` and broke the build; `--include=dev` restores it.
- **Node:** `NODE_VERSION=22.17.0` is pinned in the Render environment.
- **Lockfile:** the repo has one lockfile, the root `package-lock.json` (npm workspaces). `apps/web/package-lock.json` was a stale pre-monorepo leftover and is deleted. On 2026-10-12 the 15 missing `@rolldown/binding-*` platform entries (npm optional-dependency bug, npm/cli#4828) were added so Vitest's native binding resolves on Linux, macOS and Windows; every optional dependency in the lockfile now has an entry. A strict `npm ci` on Windows then ran `npm test` (39 passed) and `next build` without any manual workaround. If `npm install` ever drops these again, regenerate the entries rather than the whole lockfile (a full regenerate re-resolves api and mobile too).
- **Web cookie path:** `REFRESH_COOKIE_PATH=/api/auth` is set on Render so the browser sends the refresh cookie to `/api/auth/*` through the web proxy. The web app needs `API_ORIGIN` (see `apps/web/.env.example`).
- **Before deploying the roles/cookie work:** (1) apply migration `20261009130000_refresh_token_session_meta` to production first, because Prisma selects the new columns and refresh would fail against the old schema; (2) set `CORS_ORIGINS` on Render to the web origin(s), since an empty value now refuses all browser origins; (3) set `REFRESH_COOKIE_PATH` if the web proxy exposes the API under a prefix; (4) create the first admin with `npm run user:promote -- <email>` using production's `DATABASE_URL`.
- **Production migrations:** applied manually with `prisma migrate deploy` against main's direct URL, after a read-only pre-check of the data. Render does not run migrations on deploy, so every new migration needs the same manual step.

## Architecture Decisions

- **Money fields use `Decimal`, not `Float`** (`totalFuelCost`, `costPerSeat`) to avoid floating-point rounding in cost splitting. Implemented.
- **Booking concurrency.** `SELECT ... FOR UPDATE` inside a transaction is the primary guard; `@@unique([rideId, riderId])` is the safety net. Implemented and verified by a real-database concurrency test (2026-10-08). A `CHECK` on `seatsAvailable` backs it up at the database level. Structured `SEAT_NO_LONGER_AVAILABLE` error implemented.
- **Real `ADMIN` role, not driver self-approval**, so the web dashboard has genuine moderation functionality. The `Role` enum, `RolesGuard` and `npm run user:promote` exist. Undoing this means rewriting `architecture-context.md`; don't do it silently.
- **Payment is fully mocked** (`paymentStatus` enum). No real payment integration in this build.
- **Web is client-side React on the Next.js scaffold:** App Router for routing only, no server actions, no server-side auth. See Next Up.
- **One shared refresh promise in the web client.** Refresh tokens rotate, so two concurrent refreshes with the same cookie race: the server revokes the first one's new token, and whichever response the browser applies last can leave a revoked token in the cookie, which logs the user out about 30 s later (after the reuse grace window). `lib/api/client.ts` therefore keeps a single in-flight refresh promise at module level, used by both the 401 handler and session restore on load. This also covers React StrictMode, which runs effects twice in development. Multiple browser tabs still refresh independently; the API's 30 s grace window is what covers that.
- **Web logs out only on a definitive rejection** (401/403 from `/auth/refresh`), like mobile. Network errors and 5xx never log out; they show a polite "Connection problem, retrying…" notice and are retried.
- **The refresh token never reaches page scripts:** web requests send `X-Client: web` and the API omits `refresh_token` from the JSON body (cookie only). Mobile, which sends no such header, still gets it in the body.

## Open Questions

- The `Secure` refresh cookie works on `http://localhost` in Chrome, Edge and Firefox but not in Safari, so use one of those for local web development.
- Logging out while the server is unreachable signs out locally but cannot clear the httpOnly cookie, so a reload may restore the session.
- On a fresh visit the web app's session restore calls `POST /auth/refresh` without a cookie and gets a 401; expected, but it shows in server logs and the browser console.
- **Known trade-off: access tokens outlive revocation.** Revoking a session or all of a user's sessions stops refresh immediately, but an access token already issued stays valid until it expires (up to 15 minutes), because access tokens are stateless JWTs. `RolesGuard` avoids this for admin routes by reading the role from the database; other routes trust the JWT. Options if this matters: a shorter access TTL; a `sid` (family id) claim in the access token checked against revoked families on each request (one query per request); or a denylist of revoked sessions/tokens held in memory or the database.
- The test branch is a copy of main, so it contains real user rows. `test/admin.e2e-spec.ts` temporarily demotes any existing admins (the last-admin rule depends on the global count) and restores them afterwards. Use an empty or seeded test branch if this becomes a concern.
- `DIRECT_URL` in `apps/api/.env.test` points at the `-pooler` host, the same as `DATABASE_URL`. It worked for `migrate deploy`, but is not a true direct connection.
- Review `npm audit` (17 vulnerabilities, 1 critical). Not triaged yet.
- API unit specs fail at import without `DATABASE_URL` (`PrismaService` throws in its module). 8 of 11 suites fail: auth controller/service, rides controller/service, vehicles controller/service, users service, prisma service. This is a test setup problem to fix (mock `PrismaService` or provide a test URL), not just something to document.
- Vipps Login is dormant. Enabling it needs a registered business (Norwegian org number) and a Vipps merchant agreement for credentials, `VIPPS_*` env on Render, the callback URL registered in the Vipps portal, and a screen that calls `loginWithVipps()`. Also verify on iOS that the Vipps app hands the user back into the auth browser session; if not, add `requested_flow=app_to_app` with `app_callback_uri`.
- CORS currently reflects any origin (`origin: true` in `main.ts`). Needs an allowlist before web goes live.
- Expo doctor reported patch mismatches (expo 57.0.10 vs ~57.0.26 etc.) and a duplicate `expo-constants` pulled in by `expo-linking`; not re-checked. Fix with `npx expo install --fix`.
- No input sanitization test beyond class-validator's built-in checks. SQL injection is not a concern given Prisma's parameterized queries, but XSS in the `name` field isn't addressed. Low priority, deferred.
