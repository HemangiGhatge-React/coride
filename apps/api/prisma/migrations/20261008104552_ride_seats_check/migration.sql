-- Database-level safety net for the booking invariant: seat counts can never go
-- negative or exceed the ride's capacity, even if application locking is bypassed.
ALTER TABLE "Ride"
  ADD CONSTRAINT "Ride_seatsAvailable_nonnegative" CHECK ("seatsAvailable" >= 0),
  ADD CONSTRAINT "Ride_seatsAvailable_lte_seatsTotal" CHECK ("seatsAvailable" <= "seatsTotal");
