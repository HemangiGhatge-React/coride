# CoRide

Carpooling for Norwegian recreational trips: cabin trips, ski weekends, airport runs. Solo portfolio project.

## Status

| App | Path | Status |
| --- | --- | --- |
| api | `apps/api` | Deployed on Render. Auth, rides, vehicles, bookings. |
| mobile | `apps/mobile` | Auth screens only (onboarding, login, signup, placeholder home). |
| web | `apps/web` | Admin dashboard: sign-in, users table, role changes, session management (see [Web admin](#web-admin)). Rides and bookings views are not built yet. |

Payment is mocked (`MOCK_UNPAID` / `MOCK_PAID`). Detailed status: [context/progress-tracker.md](context/progress-tracker.md).

## Stack

- API: NestJS, Prisma 7, PostgreSQL on Neon
- Mobile: React Native + Expo SDK 57
- Web: Next.js 16, used as a client-side React app

## Engineering decisions

1. **Seat booking.** Booking runs in a transaction that locks the ride row with `SELECT ... FOR UPDATE`, plus a unique constraint on `(rideId, riderId)` and `CHECK` constraints on `seatsAvailable`. A real-database concurrency test (10 simultaneous riders for 1 and 3 seats) passes; with the lock removed it fails. The `CHECK` migration is applied to the test database only so far.
2. **Refresh tokens.** Stored hashed, rotated on every use, grouped in token families with reuse detection and a 30 s grace window. See [apps/api/src/auth/tokens.service.ts](apps/api/src/auth/tokens.service.ts).

Vipps Login is designed against Vipps' documented Login API, not deployed. The code is in the repo but dormant, and it has never run against real credentials. Env vars `VIPPS_*` only apply if it is enabled.

## Web admin

The web app is an admin dashboard for CoRide staff. It is a client-side React app on Next.js 16 (App Router for routing only, no server actions, no server-side auth).

**Live demo:** _coming soon (Vercel URL goes here)_

### What it does

- **Users:** a table of all users with search by name or email, a role filter and pagination. The search, filter and page live in the URL, so reload, back/forward and shared links restore the same view.
- **Roles:** open a user and change their role between Driver and Admin through a confirmation dialog that states exactly what changes. The API enforces two guard rails: you cannot change your own role, and the last admin cannot be demoted. Role checks on `/admin/*` read the role from the database, not from the token, so a demotion takes effect on the next request.
- **Sessions:** each user's active sessions with a device label ("Chrome on Windows"), when it was last used and when it was signed in. An admin can revoke one session or sign the user out everywhere.

### Auth design

- **Access token in memory only.** A short-lived (15 min) JWT held in a JavaScript variable. It is never written to `localStorage` or `sessionStorage`.
- **Refresh token in an httpOnly cookie, via a same-origin proxy.** The refresh token is opaque and lives in an httpOnly, Secure, SameSite=Lax cookie, and for web requests (`X-Client: web`) the API never puts it in a JSON body, so page scripts cannot read it. The browser only calls `/api/...` on its own origin; Next rewrites that to the API. The cookie is therefore first-party and no CORS is involved.
- **Rotation with reuse detection.** Every refresh issues a new token and revokes the old one. Tokens from one login form a family; presenting an already-rotated token outside a 30 second grace window revokes the whole family.
- **One shared refresh per tab.** Refresh tokens rotate, so parallel refreshes would race. All concurrent 401s, and session restore on page load, share a single in-flight refresh request, and each failed request is retried once. Only a 401/403 from the refresh endpoint logs the user out; network errors do not. (This is per tab; see the trade-offs below for several tabs.)

### Run it

From the repo root:

```bash
npm install
cp apps/web/.env.example apps/web/.env.local   # API_ORIGIN: the API to proxy /api to
npm run dev --workspace apps/web               # http://localhost:3000
npm test --workspace apps/web                  # Vitest + Testing Library
```

Sign in with an admin account. To promote an existing user: `npm run user:promote --workspace apps/api -- someone@example.com`. For demo data (18 users at `@demo.coride.no`, two admins, some active sessions) run `npm run seed:demo --workspace apps/api`, and `npm run seed:demo:remove --workspace apps/api` to take it out again. Both run against whatever `DATABASE_URL` points at, so check which database that is first.

Use Chrome, Edge or Firefox for local development: Safari does not keep `Secure` cookies on plain `http://localhost`.

### Known trade-offs

- **Revoking a session is not instant for access already issued.** Revoking ends the session's refresh token immediately, but an access token that was already issued stays valid until it expires (up to 15 minutes), because access tokens are stateless JWTs. Admin routes are the exception: they check the role in the database on every request. Options if this matters: a shorter access token lifetime, a session id claim checked against revoked sessions on each request, or a denylist.
- **The header can be stale after a demotion.** The web app reads its own role once, when it loads. If an admin is demoted while the dashboard is open, the header keeps looking like an admin's until a reload, although every admin request is refused (403) and pages show a "no admin access" view.
- **Render cold start.** The API runs on a free tier that sleeps when idle, so the first request after a quiet period can take up to about a minute. The login page warms the API up as soon as it opens and shows "Waking up the server…" if signing in takes more than 5 seconds.
- **Several tabs refreshing at the same instant can log you out.** All tabs share one cookie. If two tabs refresh within the same few milliseconds (for example a browser restoring several dashboard tabs at once), the second request either loses the race and gets a 401 whose response clears the cookie, or both succeed but one tab is left holding an already-revoked token, which is treated as reuse about 30 seconds later and revokes the whole session. Reproduced against the real API in a throwaway test. The fix is to coordinate across tabs so only one refreshes at a time, with the Web Locks API (`navigator.locks`) or a `BroadcastChannel`. Not implemented yet.
- **Sessions from the mobile app show a generic label.** The app does not send a `CoRide/<version>` User-Agent yet, so its sessions read "Android app" or "iOS app" rather than "CoRide Android app".
- **No browser-level end-to-end tests.** The web app has unit and component tests (Vitest) and was checked by hand against the live API; there is no Playwright-style suite.

## Run locally

Requires Node >= 22.12. From the repo root:

```bash
npm install
```

API (`apps/api`):

```bash
npm run build --workspace apps/api
npm run start:dev --workspace apps/api
npm run test --workspace apps/api
```

Mobile (`apps/mobile`):

```bash
npm run start --workspace apps/mobile
```

Web (`apps/web`):

```bash
npm run dev --workspace apps/web
```

Environment variables (names only):

- api: `DATABASE_URL`, `JWT_SECRET` (in `apps/api/.env`); optional `CORS_ORIGINS`, `REFRESH_COOKIE_PATH` (see `apps/api/.env.example`)
- mobile: `EXPO_PUBLIC_API_URL`
- web: `API_ORIGIN` (in `apps/web/.env.local`, see `apps/web/.env.example`)

API tests require `DATABASE_URL` (see [context/progress-tracker.md](context/progress-tracker.md)).
