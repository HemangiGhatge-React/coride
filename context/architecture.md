# Architecture Context

## Stack

| Layer         | Technology                          | Role                                                   |
| ------------- | ------------------------------------ | ------------------------------------------------------- |
| Backend       | NestJS + TypeScript                  | API server, business logic, auth                        |
| ORM           | Prisma                               | Schema, migrations, query layer                         |
| Database      | PostgreSQL (Neon or similar)         | System of record for all persistent data                |
| Mobile        | React Native + Expo                  | Primary client — driver and rider flows                 |
| Web           | Next.js + TypeScript                 | Secondary client — admin/triage dashboard                |
| Auth          | Custom JWT (bcrypt password hashing) | Shared auth model across mobile and web                 |
| Deployment    | Railway/Render (backend), Vercel (web), Expo/EAS (mobile) | Hosting for each layer |

## System Boundaries

- `backend/src/auth` — registration, login, JWT issuance and verification. No other module issues tokens.
- `backend/src/rides` — ride CRUD (create, list, get-by-id, update). Owns all ride-related business rules.
- `backend/src/bookings` — booking creation, cancellation, and the concurrency-safe seat allocation logic. This is the module with the highest correctness bar in the system — it owns the double-booking-prevention invariant below.
- `backend/prisma` — schema and migrations. Single source of truth for the data model; mobile and web never define their own copies of these shapes, they consume the API contract.
- `mobile/` — React Native/Expo app. Owns all driver/rider-facing UI and the optimistic-UI handling of booking failures. Does not talk to the database directly — only through the backend API.
- `web/` — Next.js admin dashboard. Owns the rides/bookings read (and optionally approve/reject) UI. Also only talks to the backend API, never the database directly.

## Storage Model

- **Database (PostgreSQL via Prisma)**: all persistent data — users, rides, vehicles, bookings, payment status (mocked). Everything the system needs to reconstruct state lives here; there is no separate file/blob storage layer in this build.

## Auth and Access Model

- Every user registers/logs in via the backend's own JWT-based auth (no third-party auth provider in this build).
- Every ride has exactly one owning driver (`driverId` on `Ride`).
- A rider can have at most one active booking per ride — enforced at the database level via `@@unique([rideId, riderId])`.
- Mutating a ride (edit/delete) is restricted to its owning driver. Mutating a booking's approval status (web dashboard action) is restricted to an admin-authenticated session.
- Mobile and web both authenticate against the same backend and receive the same JWT shape — there is one auth system, not two.

## Invariants

1. Two concurrent booking requests for the same ride's last seat must never both succeed. Seat count decrement and booking insert happen atomically inside a single database transaction with row-level locking (`SELECT ... FOR UPDATE`) — never relying solely on the `@@unique` constraint to catch the conflict after the fact.
2. All monetary fields (`costPerSeat`) are `Decimal`, never `Float` — avoids floating-point rounding errors in cost-splitting math.
3. Payment status is explicitly mocked (`MOCK_UNPAID` / `MOCK_PAID`) in this build. No code should assume or imply real payment processing occurred.
4. Neither mobile nor web ever accesses the database directly — all reads and writes go through the backend API, so business rules and the concurrency-safety invariant above are enforced in exactly one place.
