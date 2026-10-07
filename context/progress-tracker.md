# Progress Tracker

Update this file after every meaningful implementation change.

"Verified" means there is an automated test, a logged manual check, or a live check. Everything else is listed under "not verified", even if the code exists.

## Current Phase

- API: deployed on Render. Auth, rides, vehicles and bookings endpoints exist; booking concurrency is not yet tested.
- Mobile: auth screens only (splash, onboarding, login, signup, placeholder Home).
- Web: Next.js 16 scaffold with UI components, no features.

## Done (verified)

- **API deploy on Render.** `prisma.config.ts` was being compiled into the app build, which moved output to `dist/src/main.js` while `start:prod` runs `node dist/main`. Fixed by excluding it in `tsconfig.build.json`; `build` runs `prisma generate` first (Prisma 7 has no postinstall generate). Added `GET /health` and `render.yaml`. Checked live: `/health`, register (201), duplicate email (409).
- **Email/password auth.** `POST /auth/register`, `/auth/login`, `/auth/refresh`, `/auth/logout`, `GET /auth/me`. Manual check against a local API (Oct 3): register 201, duplicate 409, short password 400, wrong password 401, login -> `/auth/me` -> refresh -> logout -> refresh 401. Test user deleted afterwards.
- **Refresh tokens.** 15 min access JWT; opaque refresh tokens stored as SHA-256 hashes, rotated on every use, token families with reuse detection and a 30 s grace window (`src/auth/tokens.service.ts`). Covered by `tokens.service.spec.ts`.
- **`JwtAuthGuard`** (`src/auth/jwt-auth.guard.ts`). The Oct 3 manual run called `GET /auth/me`, which goes through the guard (with a valid token it returned the user). Rides and vehicles routes using the same guard have no logged check of their own.
- **Schema and migrations.** Migrations `init`, `add_fuel_cost_split`, `vipps_login_refresh_tokens` applied (checked Oct 3).
- **Passing specs without `DATABASE_URL`:** 3 suites, 16 tests (tokens, Vipps auth service, app controller).

## Done (not verified)

- **Seat booking** (`POST /bookings`, `src/bookings/bookings.service.ts`). Inside an interactive `$transaction` it locks the ride row with `SELECT ... FOR UPDATE`, checks driver/status/seats, decrements `seatsAvailable` and inserts the booking. `@@unique([rideId, riderId])` exists; a duplicate returns 409. Running out of seats returns a plain 409 `"Not enough seats available"` (no structured error code yet). **Concurrency is NOT verified.** `src/bookings/test-concurrent-booking.js` fires 2 manual requests and only logs them: no assertions, no setup. There is no booking spec, no cancel endpoint, and no DB-level `CHECK (seatsAvailable >= 0)`.
- **Rides** (guard on create/update): create, list, get by id, update (owner only; cancelling is `PATCH` with `status`). No delete. `rides.service.spec.ts` and `rides.controller.spec.ts` exist but fail at import (see Open Questions).
- **Vehicles** (guard on all routes): create, list own (`GET /vehicles/mine`). Same failing-spec situation.
- **Vipps Login.** Code kept but dormant: backend `src/auth/vipps/*` (fails closed with no `VIPPS_*` env), mobile `src/auth/vippsLogin.ts` (not imported by any screen). Callback/exchange logic has unit tests, but it has never run against real credentials; those need a Norwegian organisation number.
- **Payment is mocked.** `paymentStatus` is `MOCK_UNPAID` (default) / `MOCK_PAID`; no code writes it.
- **Mobile auth.** Login and Signup screens, `AuthContext`, SecureStore token storage, API client with 401 -> single refresh -> one retry, placeholder Home. No logged run on a device or emulator.
- **Web.** Next.js 16 scaffold with UI components and a placeholder page. No features.

## Next Up

In this order:

1. Booking safety: structured `SEAT_NO_LONGER_AVAILABLE` error, `CHECK (seatsAvailable >= 0)` migration, and a real concurrency test with assertions and a negative control (the same test fails with the lock removed).
2. `RolesGuard` and read endpoints for the web dashboard.
3. Cookie-based refresh and a CORS allowlist for web (replaces `origin: true` in `main.ts`).
4. Web dashboard, built as a client-side React + TypeScript app on the Next.js 16 scaffold: App Router for routing only, `"use client"` pages, React Query, own `AuthProvider` with the access token in memory. No server actions, no server-side auth, no data fetching in server components. Proxy `/api` to the Render API via `rewrites` so the refresh cookie is same-origin.
5. Mobile: ride list, ride detail, create ride, booking flow.
6. Make the unit specs mock `PrismaService` so they run without a database.

## Architecture Decisions

- **Money fields use `Decimal`, not `Float`** (`totalFuelCost`, `costPerSeat`) to avoid floating-point rounding in cost splitting. Implemented.
- **Booking concurrency.** `SELECT ... FOR UPDATE` inside a transaction is the primary guard; `@@unique([rideId, riderId])` is the safety net. Implemented, but concurrency is not yet verified and the structured `SEAT_NO_LONGER_AVAILABLE` error is not yet implemented.
- **Real `ADMIN` role, not driver self-approval**, so the web dashboard has genuine moderation functionality. The `Role` enum exists; there is no `RolesGuard` and no admin seed script yet. Undoing this means rewriting `architecture-context.md`; don't do it silently.
- **Payment is fully mocked** (`paymentStatus` enum). No real payment integration in this build.
- **Web is client-side React on the Next.js scaffold:** App Router for routing only, no server actions, no server-side auth. See Next Up.

## Open Questions

- API unit specs fail at import without `DATABASE_URL` (`PrismaService` throws in its module). 8 of 11 suites fail: auth controller/service, rides controller/service, vehicles controller/service, users service, prisma service. This is a test setup problem to fix (mock `PrismaService` or provide a test URL), not just something to document.
- Vipps Login is dormant. Enabling it needs a registered business (Norwegian org number) and a Vipps merchant agreement for credentials, `VIPPS_*` env on Render, the callback URL registered in the Vipps portal, and a screen that calls `loginWithVipps()`. Also verify on iOS that the Vipps app hands the user back into the auth browser session; if not, add `requested_flow=app_to_app` with `app_callback_uri`.
- CORS currently reflects any origin (`origin: true` in `main.ts`). Needs an allowlist before web goes live.
- Expo doctor reported patch mismatches (expo 57.0.10 vs ~57.0.26 etc.) and a duplicate `expo-constants` pulled in by `expo-linking`; not re-checked. Fix with `npx expo install --fix`.
- No input sanitization test beyond class-validator's built-in checks. SQL injection is not a concern given Prisma's parameterized queries, but XSS in the `name` field isn't addressed. Low priority, deferred.
