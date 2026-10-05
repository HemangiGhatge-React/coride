# Progress Tracker

Update this file after every meaningful implementation change.

## Current Phase

- Backend Day 4 complete.

## Completed

[...previous entries...]
- The booking module actually verified
- Auth: Vipps Login + refresh tokens (Oct 1). Backend: `auth/vipps/*` endpoints, `TokensService` (15 min access JWT, rotating hashed refresh tokens with reuse detection), `/auth/refresh`, `/auth/logout`, `/auth/me`; password login now also returns `refresh_token`. Schema change (explicitly approved): `User.password` nullable, `User.vippsSub`, `RefreshToken` table — migration `20261001090000_vipps_login_refresh_tokens`. Mobile: Login (Vipps) screen, AuthContext, API client with 401 interception, placeholder Home. Unit tests for rotation/reuse and Vipps callback/exchange pass; not yet run end to end against real Vipps credentials.
- Render deploy fix (Oct 1): `prisma.config.ts` was being compiled into the app build, which moved output to `dist/src/main.js` while `start:prod` runs `node dist/main`. Excluded it in `tsconfig.build.json`; `build` now runs `prisma generate` first (Prisma 7 has no postinstall generate); added `GET /health` and `render.yaml`. Verified the clean-copy build + `start:prod` + `/health` 200 locally; not yet redeployed on Render.
- Auth switched back to email/password as the active flow (Oct 3). Mobile: email/password Login + Signup screens; AuthContext uses `/auth/login` + `/auth/register`; Vipps code kept but dormant (nothing imports `vippsLogin.ts`). Backend auth endpoints unchanged (register/login/bcrypt + refresh/logout/me). Verified against a local API with no Vipps env: register 201, duplicate 409, short password 400, wrong password 401, login → /auth/me → refresh → logout → refresh 401; test user deleted afterwards. DB check: 4 existing users, all with password hashes; migration applied. Booking `paymentStatus` untouched (still `MOCK_UNPAID` default, no code writes it).

## Next Up

- jwt-auth.guard.ts — reusable guard for protecting ride/booking routes (not yet built; needed before ride CRUD).
- Ride CRUD endpoints (apps/api/src/rides/).
- Then: booking module with row-level-locked transaction (flagship concurrency piece).

## Open Questions

- Vipps Login is dormant (Oct 3). Enabling it needs: a registered business + Vipps merchant agreement for credentials; `VIPPS_*` env on Render; the callback URL registered in the Vipps portal; a screen that calls `loginWithVipps()`. The items below apply then.
- Vipps Login end-to-end test pending: needs test credentials from portal.vippsmobilepay.com, the callback URL registered there, a public HTTPS URL for the API (deploy or tunnel), and the migration applied. Also verify on iOS that the Vipps app hands the user back into the auth browser session; if not, add `requested_flow=app_to_app` with `app_callback_uri`.
- Existing scaffold specs `auth.controller.spec.ts` / `auth.service.spec.ts` fail at import (PrismaService needs `DATABASE_URL`); this predates the Vipps work.
- Expo doctor reports patch mismatches (expo 57.0.10 vs ~57.0.26 etc.) and a duplicate `expo-constants` pulled in by `expo-linking`; fix with `npx expo install --fix`.

- No input sanitization test done beyond class-validator's built-in checks (e.g., SQL injection isn't a concern given Prisma's parameterized queries, but XSS in `name` field isn't addressed — low priority, note and defer).