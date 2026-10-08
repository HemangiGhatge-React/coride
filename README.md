# CoRide

Carpooling for Norwegian recreational trips: cabin trips, ski weekends, airport runs. Solo portfolio project.

## Status

| App | Path | Status |
| --- | --- | --- |
| api | `apps/api` | Deployed on Render. Auth, rides, vehicles, bookings. |
| mobile | `apps/mobile` | Auth screens only (onboarding, login, signup, placeholder home). |
| web | `apps/web` | Next.js 16 scaffold with UI components, no features yet. |

Payment is mocked (`MOCK_UNPAID` / `MOCK_PAID`). Detailed status: [context/progress-tracker.md](context/progress-tracker.md).

## Stack

- API: NestJS, Prisma 7, PostgreSQL on Neon
- Mobile: React Native + Expo SDK 57
- Web: Next.js 16, used as a client-side React app

## Engineering decisions

1. **Seat booking.** Booking runs in a transaction that locks the ride row with `SELECT ... FOR UPDATE`, plus a unique constraint on `(rideId, riderId)` and `CHECK` constraints on `seatsAvailable`. A real-database concurrency test (10 simultaneous riders for 1 and 3 seats) passes; with the lock removed it fails. The `CHECK` migration is applied to the test database only so far.
2. **Refresh tokens.** Stored hashed, rotated on every use, grouped in token families with reuse detection and a 30 s grace window. See [apps/api/src/auth/tokens.service.ts](apps/api/src/auth/tokens.service.ts).

Vipps Login is designed against Vipps' documented Login API, not deployed. The code is in the repo but dormant, and it has never run against real credentials. Env vars `VIPPS_*` only apply if it is enabled.

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

- api: `DATABASE_URL`, `JWT_SECRET` (in `apps/api/.env`)
- mobile: `EXPO_PUBLIC_API_URL`

API tests require `DATABASE_URL` (see [context/progress-tracker.md](context/progress-tracker.md)).
