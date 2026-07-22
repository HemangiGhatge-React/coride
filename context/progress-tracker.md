# Progress Tracker

Update this file after every meaningful implementation change.

## Current Phase

- Backend Day 1 complete — schema written, migrated to live Neon Postgres, constraints verified (Booking unique index confirmed via migration.sql, not just schema inspection).

## Completed

- Web: placeholder page displaying project name.
- Web: shadcn/ui components installed (Button, Card, Dialog, Input, Tabs, Textarea, ScrollArea), lucide-react installed, lib/utils.cn helper created.
- Monorepo restructure: web app moved to apps/web, root workspace package.json added, apps/api scaffolded (NestJS), npm workspace hoisting verified.
- Prisma schema (User, Vehicle, Ride, Booking) written and migrated against Neon (direct, non-pooled connection). ADMIN/DRIVER role added. Booking unique constraint on (rideId, riderId) verified present in actual migration SQL.

## In Progress

- Nothing currently in progress on backend.

## Next Up

- Auth module: register/login endpoints, bcrypt password hashing, JWT issue + verify guard.

Apply that, commit it separately or as part of the same commit — your call, but don't leave it unsaved between now and tomorrow's session.

Before you close today out: the Jul 26 backend deadline now has auth, ride CRUD, and the booking module left — three pieces in what's likely 3-4 remaining days depending on when you actually start tomorrow. That's tighter than the "6 days for three pieces" estimate from earlier, because today ate into it more than a clean Day 1 would have (path confusion, Prisma 7 breaking change, monorepo move). Worth being honest with yourself about that compression now rather than discovering it on Jul 25.


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