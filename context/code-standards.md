# Code Standards

## General

- Keep modules small and single-purpose — one NestJS module per domain concern (auth, rides, bookings), one screen/component per mobile or web view.
- Fix root causes, not symptoms — especially in the booking concurrency logic; do not paper over a race condition with a retry loop or a client-side delay.
- Do not mix unrelated concerns in one component, route, or service — e.g. booking creation logic does not belong inside a ride controller.
- Given the compressed timeline, favor working and correct over polished. Do not spend time on visual refinement, animations, or design-system work unless explicitly scheduled.

## TypeScript

- Strict mode required throughout backend, mobile, and web.
- Avoid `any` — use explicit interfaces/types generated from or matching the Prisma schema.
- Validate all external input (API request bodies, form input) at system boundaries before trusting it — especially booking requests, since that's the concurrency-critical path.

## NestJS (backend)

- Route handlers/controllers stay thin — orchestration only, no business logic inline in controllers.
- Business logic (especially the transaction/locking logic for bookings) lives in services, not controllers.
- Return consistent, structured error responses — e.g. a booking conflict returns a specific `SEAT_NO_LONGER_AVAILABLE` error code, not a generic 500 or unstructured message.

## Next.js (web)

- Default to server components; add `"use client"` only where browser interactivity (forms, buttons with handlers) requires it.
- Keep route/page components focused — data fetching and presentation can be split if a page grows complex, but do not over-engineer this for a dashboard this small.

## React Native (mobile)

- Keep screens and components separated — a screen composes components, it does not contain all UI logic inline.
- Handle the booking-conflict case explicitly in UI state (optimistic "confirming" → rollback to "seat taken" on failure) rather than leaving it as an unhandled promise rejection.

## Styling

- Functional over polished for this build — no design tokens/theming system required unless time allows. If used, keep it minimal (a small shared constants file for colors/spacing) rather than a full design system.
- No hardcoded magic numbers repeated across files for spacing/sizing where avoidable — but do not spend build time retrofitting a token system onto working screens.

## API Routes / Endpoints

- Validate and parse request input before any logic runs.
- Enforce auth (and ownership, where relevant — e.g. only a ride's driver can edit it) before any mutation.
- Booking creation endpoint specifically: input validation → auth check → transaction with row-level lock → structured success or structured conflict error. No shortcuts on this path since it's the project's core technical claim.

## Data and Storage

- All persistent data lives in PostgreSQL via Prisma — no local mobile persistence beyond auth token storage (SecureStore) and normal in-memory app state.
- Do not introduce a second source of truth (e.g. caching ride data locally on mobile in a way that can drift from the backend) — the timeline doesn't allow for building proper cache invalidation.

## File Organization

- `backend/src/auth/` — auth module (controllers, services, guards, DTOs)
- `backend/src/rides/` — ride module
- `backend/src/bookings/` — booking module, including the concurrency-safe creation logic
- `backend/prisma/` — schema, migrations, seed script
- `mobile/screens/` — one file per screen (Login, RideList, RideDetail, CreateRide, BookingConfirmation)
- `web/app/` — Next.js app router pages (login, rides list, ride detail)
