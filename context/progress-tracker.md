# Progress Tracker

Update this file after every meaningful implementation change.

## Current Phase

- Not started — backend Day 0. Schema not yet written or migrated. Web frontend has a placeholder page and design system dependencies installed.

## Current Goal

- Write and migrate the Prisma schema against a live Postgres instance (Neon), verified via Prisma Studio. Then: auth, ride CRUD, concurrency-safe booking module. (Target: Jul 26 — unchanged, but now compressed by however many days schema work takes.)

## Completed

- Web: placeholder page displaying project name.
- Web: shadcn/ui components installed (Button, Card, Dialog, Input, Tabs, Textarea, ScrollArea), lucide-react installed, lib/utils.cn helper created.

## In Progress

- Nothing currently in progress on backend.

## Next Up

- Write Prisma schema (User, Ride, Vehicle, Booking) per `architecture.md`.
- Migrate against live Postgres (Neon) — `npx prisma migrate dev --name init`.
- Verify via Prisma Studio before writing any endpoint code.
- Auth module: register/login endpoints, bcrypt password hashing, JWT issue + verify guard.
- Then: ride CRUD endpoints.
- Then: booking module with row-level-locked transaction for seat allocation (flagship concurrency-safety piece — see `architecture.md` invariant #1).

## Open Questions

- Web dashboard scope (read-only vs. approve/reject actions) is a checkpoint decision on Aug 3 — depends on whether the project is on schedule at that point. Not yet decided.
- Backend has not started — Jul 26 target for auth+CRUD+booking is now at risk depending on how long schema work takes. Not yet a confirmed blocker, but flag if schema isn't migrated by end of Jul 21.

## Architecture Decisions

- Monetary fields use `Decimal`, not `Float` — avoids floating-point rounding errors in cost-per-seat calculations. (Planned for schema stage — not yet implemented.)
- Booking double-booking prevention will use a database transaction with row-level locking (`SELECT ... FOR UPDATE`), not solely the `@@unique` constraint — the constraint is the safety net, the transaction/lock produces a clean, structured error instead of a raw DB exception. (Planned — see `architecture.md` invariant #1.)
- Web dashboard uses a real ADMIN role (separate from DRIVER), not driver-self-approval. Decided Jul 20 — adds scope (role field, admin auth guard, seed script for at least one admin account) against the Jul 26 backend deadline. Chosen deliberately to give the web app genuine functionality for portfolio purposes, not because it's the fastest path. If behind schedule by Jul 24, revisit — driver-self-approval is the fallback, but requires an architecture-context.md rewrite to undo, don't do it silently.
- Payment is fully mocked (`paymentStatus` enum, no real Vipps integration) for this build — real payment integration is out of scope given the timeline.

## Session Notes

- Building solo, hard external deadline: full system (backend + mobile + web) needs to be live and documented by Aug 13, 2026, ahead of an Aug 14 job-outreach sprint.
- Timeline is tight — one buffer day currently scheduled (Aug 8). Backend start slipped from "Day 1 complete" to "Day 0" as of Jul 20 — this eats into that buffer before backend work has even begun.
- Cuts, in priority order if behind: (1) drop web dashboard styling polish, (2) skip Vipps entirely — already mocked, (3) skip any Facebook-integration ideas entirely — already out of scope, (4) reduce web dashboard to read-only only (no approve/reject action).
- Mobile app currently exists only as an unfinished prototype — full auth/ride/booking flow still needs to be wired up to the live backend starting Jul 27. This date assumes backend is done Jul 26 — currently unconfirmed given schema hasn't started.