# CoRide

## Overview

CoRide is a carpooling app for Norwegian recreational travel — cabin trips, ski weekends, airport runs. Drivers offering a ride post it with route, time, and available seats; riders search and book a seat. The system spans a NestJS/Prisma/PostgreSQL backend, a React Native/Expo mobile app (primary interface for drivers and riders), and a Next.js web admin dashboard (secondary interface for reviewing rides and bookings). It originated as a team project in the TCS goIT INNO-SCI Innovation Course and is now being continued and finished solo.

## Goals

1. Ship a working, deployed, end-to-end system (backend + mobile + web) by Aug 13, 2026 — this is a portfolio/interview project on a hard deadline, not a commercial launch.
2. Demonstrate correct handling of concurrent booking requests (the flagship technical story) — no double-booking of the last seat on a ride, even under simultaneous requests.
3. Prove real cross-platform frontend ownership: one backend, a functional mobile client, and a functional web client, built solo.

## Core User Flow

1. User registers/logs in (mobile).
2. Driver creates a ride: origin, destination, departure time, seats available, cost per seat.
3. Rider browses/searches rides and requests to book a seat.
4. Booking is created against the ride; seat count decrements atomically — this is the point where the concurrency-safety work matters.
5. Rider sees booking status (confirmed / seat no longer available). Payment status is mocked, not processed for real.
6. Admin (web dashboard) can view all rides and bookings for the platform.

## Features

### Core (mobile)

- Auth: register/login with email + password; backend issues its own access + refresh tokens, stored via Expo SecureStore and silently refreshed. (Vipps Login is implemented but dormant — designed, not deployed, because it requires a registered business.)
- Ride creation, listing, and detail view
- Booking creation with race-condition-safe seat allocation
- Booking status shown to the user, with graceful handling if a seat is lost to a concurrent booking

### Core (web admin)

- Auth: login (reuses backend JWT auth)
- Rides list (table view)
- Ride detail view showing associated bookings
- Booking approve/reject action — stretch goal only, included if ahead of schedule per the Aug 3 checkpoint; otherwise the dashboard stays read-only

### Deferred / mocked

- Payment: `paymentStatus` is a mocked enum (`MOCK_UNPAID` / `MOCK_PAID`). No real Vipps payment integration in this build, and no payment capture in the booking flow.
- Facebook Page/Messenger ride-request capture: explicitly out of scope for this build (was considered, cut to keep timeline realistic).

## Scope

### In Scope

- NestJS/Prisma/PostgreSQL backend, deployed and live
- React Native/Expo mobile app covering the full core user flow above
- Next.js web admin dashboard, at minimum read-only rides/bookings view
- Transaction-level concurrency handling for bookings (the hard, interview-defensible piece)
- Functional UI on both mobile and web — no design-polish pass; correctness and working state over visual refinement

### Out of Scope

- Real Vipps payment processing
- Facebook/WhatsApp/any external social integration
- Route-matching algorithms / geospatial search
- Real-time sync (WebSockets) between mobile and web
- Styling/design system polish beyond basic usability

## Success Criteria

1. A user can register, create a ride, and book a ride from the mobile app against the live deployed backend.
2. Two simultaneous booking requests for the last seat on a ride resolve correctly: exactly one succeeds, the other receives a clear `SEAT_NO_LONGER_AVAILABLE` response — verified with an actual concurrency test, not just code review.
3. The web admin dashboard, deployed and live, shows real ride and booking data pulled from the same backend the mobile app uses.
4. The whole system (backend + mobile + web) is deployed, documented (README with architecture diagram), and demoable via a recorded video by Aug 13, 2026.
