# Architecture Context

## Stack

| Layer         | Technology                          | Role                                                   |
| ------------- | ------------------------------------ | ------------------------------------------------------- |
| Backend       | NestJS + TypeScript                  | API server, business logic, auth                        |
| ORM           | Prisma                               | Schema, migrations, query layer                         |
| Database      | PostgreSQL (Neon or similar)         | System of record for all persistent data                |
| Mobile        | React Native + Expo                  | Primary client — driver and rider flows                 |
| Web           | Next.js + TypeScript                 | Secondary client — admin/triage dashboard                |
| Auth          | Email/password (bcrypt) issuing our own JWT access + rotating refresh tokens. Vipps Login (OIDC) is implemented but dormant | Shared session model across mobile and web |
| Deployment    | Railway/Render (backend), Vercel (web), Expo/EAS (mobile) | Hosting for each layer |

## System Boundaries

- `apps/api/src/auth` — registration, password login, Vipps Login (`auth/vipps/`), access/refresh token issuance, rotation and verification. No other module issues tokens.
- `apps/api/src/rides` — ride CRUD (create, list, get-by-id, update). Owns all ride-related business rules.
- `apps/api/src/bookings` — booking creation, cancellation, and the concurrency-safe seat allocation logic. This is the module with the highest correctness bar in the system — it owns the double-booking-prevention invariant below.
- `apps/api/prisma` — schema and migrations. Single source of truth for the data model; mobile and web never define their own copies of these shapes, they consume the API contract.
- `apps/mobile/` — React Native/Expo app. Owns all driver/rider-facing UI and the optimistic-UI handling of booking failures. Does not talk to the database directly — only through the backend API.
- `apps/web/` — Next.js admin dashboard. Owns the rides/bookings read (and optionally approve/reject) UI. Also only talks to the backend API, never the database directly.

## Storage Model

- **Database (PostgreSQL via Prisma)**: all persistent data — users, rides, vehicles, bookings, payment status (mocked). Everything the system needs to reconstruct state lives here; there is no separate file/blob storage layer in this build.

## Auth and Access Model

- **Active auth: email/password.** Mobile and web register via `POST /auth/register` and log in via `POST /auth/login` (bcrypt). Every account created through the active path has a password hash.
- **Vipps Login: designed and implemented, not deployed (dormant).** Vipps Login requires a registered business / merchant agreement to obtain credentials, so it is not wired into the mobile login screen. The code stays in the repo: backend `src/auth/vipps/` (routes still mounted, but with no `VIPPS_*` env set they fail closed and never call Vipps) and mobile `src/auth/vippsLogin.ts` (not imported by any screen). The design below describes how it works when enabled. Vipps only proves identity; the backend then issues its own session, so every client still holds the same CoRide token shape.
- Vipps flow (mobile → backend `/auth/vipps/start` → Vipps → backend `/auth/vipps/callback` → app deep link → `POST /auth/vipps/exchange`):
  - The app creates a PKCE verifier/challenge; only the challenge goes to `/start`, inside a signed `state` (10 min). The callback verifies `state`, exchanges the Vipps code (client_secret_basic), verifies the ID token (JWKS, issuer, audience, nonce) and checks userinfo `sub` matches.
  - The callback redirects into the app with a one-time login code (signed, 2 min) bound to the challenge — never with session tokens. Only the app holding the verifier can redeem it.
  - `/start` only redirects to app URIs in `VIPPS_APP_REDIRECT_URIS` (no open redirect).
  - Errors come back to the app as `?error=cancelled|vipps_error|email_conflict|invalid_state|not_configured`.
- Vipps account linking: a user is matched by `vippsSub` first. If none matches and an existing account has the same email, it is linked only when Vipps reports `email_verified: true`; otherwise login fails with `email_conflict`. New Vipps users get a passwordless `DRIVER` account (`password` is null).
- Sessions: access token = JWT, 15 min, audience `coride:api` (other JWTs signed with `JWT_SECRET` use different audiences and are rejected by the guard). Refresh token = opaque random value stored only as a SHA-256 hash in `RefreshToken`, 30-day sliding expiry, rotated on every `POST /auth/refresh`. Presenting a rotated token revokes the whole token family, unless it happens within 30 s while the family is still live (treated as a retry after a lost response). `POST /auth/logout` revokes the family.
- Mobile stores both tokens in Expo SecureStore only (`src/utils/authStorage.ts`). `src/api/client.ts` intercepts 401 → single in-flight refresh → one retry; a 401 after refresh clears the session and routes to the login screen with a "session expired" notice. Network errors never log the user out.
- Required API env: `DATABASE_URL`, `JWT_SECRET`. Only when enabling Vipps: `VIPPS_CLIENT_ID`, `VIPPS_CLIENT_SECRET`, `VIPPS_MERCHANT_SERIAL_NUMBER`, `VIPPS_REDIRECT_URI` (the public HTTPS URL of `/auth/vipps/callback`, registered exactly in the Vipps portal), `VIPPS_APP_REDIRECT_URIS` (comma-separated, e.g. `coride://auth/vipps,exp://192.168.1.10:8081/--/auth/vipps`), optional `VIPPS_BASE_URL` (default `https://apitest.vipps.no`; production `https://api.vipps.no`). Mobile env: `EXPO_PUBLIC_API_URL`.
- Every ride has exactly one owning driver (`driverId` on `Ride`).
- A rider can have at most one active booking per ride — enforced at the database level via `@@unique([rideId, riderId])`.
- Mutating a ride (edit/delete) is restricted to its owning driver. Mutating a booking's approval status (web dashboard action) is restricted to an admin-authenticated session.
- Mobile and web both authenticate against the same backend and receive the same token shape (`access_token`, `refresh_token`, `user`) — there is one session system, not two.
- Users have a `role` of `DRIVER` (default) or `ADMIN`. Booking approval/cancellation via the web dashboard requires `ADMIN` role — this is platform-level moderation, not ride-owner self-service. There is no self-service path to becoming admin; admin accounts are seeded directly.

## Invariants

1. Two concurrent booking requests for the same ride's last seat must never both succeed. Seat count decrement and booking insert happen atomically inside a single database transaction with row-level locking (`SELECT ... FOR UPDATE`) — never relying solely on the `@@unique` constraint to catch the conflict after the fact.
2. All monetary fields (`costPerSeat`) are `Decimal`, never `Float` — avoids floating-point rounding errors in cost-splitting math.
3. Payment status is explicitly mocked (`MOCK_UNPAID` / `MOCK_PAID`) in this build. No code should assume or imply real payment processing occurred.
4. Neither mobile nor web ever accesses the database directly — all reads and writes go through the backend API, so business rules and the concurrency-safety invariant above are enforced in exactly one place.