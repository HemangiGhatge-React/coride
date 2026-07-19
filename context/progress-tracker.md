# Progress Tracker

Update this file after every meaningful implementation change.

## Current Phase

- In progress — backend, Day 1 of 25 complete (schema only).

## Current Goal

- Finish backend: auth, ride CRUD, and the concurrency-safe booking module, then deploy. (Target: Jul 26.)

## Completed

-None yet

## In Progress

- Design system — adding shadcn/ui components (Button, Card, Dialog, Input, Tabs, Textarea, ScrollArea), installing lucide-react, and creating lib/utils.cn helper (in progress).

## Next Up

- Auth module: register/login endpoints, bcrypt password hashing, JWT issue + verify guard.
- Then: ride CRUD endpoints.
- Then: booking module with row-level-locked transaction for seat allocation (the flagship concurrency-safety piece — see `architecture.md` invariant #1).

## Open Questions

- Web dashboard scope (read-only vs. approve/reject actions) is a checkpoint decision on Aug 3 — depends on whether the project is on schedule at that point. Not yet decided.
- None currently blocking backend work.

## Architecture Decisions

- Monetary fields use `Decimal`, not `Float` — avoids floating-point rounding errors in cost-per-seat calculations. (Decided at schema stage.)
- Booking double-booking prevention is handled via a database transaction with row-level locking (`SELECT ... FOR UPDATE`), not solely the `@@unique` constraint — the constraint is the safety net, the transaction/lock is what produces a clean, structured error instead of a raw DB exception. (Decided as the project's flagship technical story — see `architecture.md` invariant #1.)
- Payment is fully mocked (`paymentStatus` enum, no real Vipps integration) for this build — real payment integration is out of scope given the timeline.

## Session Notes

- Building solo, hard external deadline: full system (backend + mobile + web) needs to be live and documented by Aug 13, 2026, ahead of an Aug 14 job-outreach sprint.
- Timeline is tight — one buffer day currently scheduled (Aug 8). Cuts, in priority order if behind: (1) drop web dashboard styling polish, (2) skip Vipps entirely — already mocked, (3) skip any Facebook-integration ideas entirely — already out of scope, (4) reduce web dashboard to read-only only (no approve/reject action).
- Mobile app currently exists only as an unfinished prototype — full auth/ride/booking flow still needs to be wired up to the live backend starting Jul 27.
