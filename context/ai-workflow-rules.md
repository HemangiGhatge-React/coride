# AI Workflow Rules

## Approach

Build CoRide incrementally using a spec-driven workflow. `project-overview.md`, `architecture.md`, `code-standards.md`, and `ui-context.md` define what to build, how to build it, and the constraints that aren't obvious from the code alone (the concurrency invariant especially). Always implement against these specs — do not infer or invent product behavior, especially around the booking-conflict handling, which is the project's core technical claim and must be built exactly as specified in `architecture.md`, not approximated.

## Scoping Rules

- Work on one feature unit at a time (e.g. "booking creation with locking" is one unit; "mobile booking screen" is a separate unit).
- Prefer small, verifiable increments over large speculative changes — each day in the build plan corresponds to roughly one verifiable unit.
- Do not combine unrelated system boundaries in a single implementation step — e.g. don't touch the web dashboard and the booking transaction logic in the same change.

## When to Split Work

Split an implementation step if it combines:

- Backend logic changes and mobile/web UI changes in the same step
- Multiple unrelated API routes (e.g. rides CRUD and booking creation) in one change
- Behavior not clearly defined in the context files — especially anything touching the concurrency-safety invariant, which must be resolved explicitly, not assumed

If a change cannot be verified end to end quickly, the scope is too broad — split it.

## Handling Missing Requirements

- Do not invent product behavior not defined in the context files — if unsure whether a feature is in scope, check `project-overview.md`'s Scope section first.
- If a requirement is ambiguous, resolve it in the relevant context file before implementing — don't guess on anything touching auth, ownership, or the booking transaction logic.
- If a requirement is missing, add it as an open question in `progress-tracker.md` before continuing.

## Protected Files

Do not modify the following unless explicitly instructed:

- `backend/prisma/schema.prisma` — schema changes affect the whole system and should be deliberate, not incidental to an unrelated feature change.
- The booking-creation transaction/locking logic in `backend/src/bookings/` — this is the project's flagship correctness guarantee; changes here need explicit review against the invariant in `architecture.md`, not casual refactoring.

## Keeping Docs in Sync

Update the relevant context file whenever implementation changes:

- System architecture or boundaries → `architecture.md`
- Storage model decisions → `architecture.md`
- Code conventions or standards → `code-standards.md`
- Feature scope → `project-overview.md`

## Before Moving to the Next Unit

1. The current unit works end to end within its defined scope
2. No invariant defined in `architecture.md` was violated (check the concurrency invariant specifically after any booking-related change)
3. `progress-tracker.md` reflects the completed work
4. The relevant build/typecheck command passes (`npm run build` for web, `nest build` for backend, `expo doctor`/build check for mobile)
