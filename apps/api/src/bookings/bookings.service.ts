// booking.service.ts
import { Injectable, NotFoundException, ConflictException } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { RideStatus } from '@prisma/client';

// Error body is a superset of Nest's default { statusCode, error, message } so clients
// can rely on `code` for booking failures without losing the usual fields.
function bookingError(Exc: typeof NotFoundException | typeof ConflictException, code: string, message: string) {
    const e = new Exc();
    return new Exc({ statusCode: e.getStatus(), error: e.name.replace('Exception', '').replace(/([a-z])([A-Z])/g, '$1 $2'), code, message });
}

// Names of the columns behind a P2002, or null when Prisma didn't report them.
// Prisma 7 with the pg driver adapter may put them in meta.driverAdapterError instead of meta.target.
function uniqueViolationColumns(err: any): string[] | null {
    // The adapter reports quoted identifiers (e.g. '"rideId"'), so strip the quotes.
    const clean = (names: unknown[]) => names.map((n) => String(n).replace(/"/g, ''));
    const target = err?.meta?.target;
    if (Array.isArray(target)) return clean(target);
    if (typeof target === 'string') return clean([target]);
    const fields = err?.meta?.driverAdapterError?.cause?.constraint?.fields;
    if (Array.isArray(fields)) return clean(fields);
    return null;
}

// True for a Postgres CHECK violation (23514, surfaced by Prisma as P2039) on the Ride seat
// constraints. Only reachable if the row lock is bypassed, but it must not become a 500.
function isSeatCheckViolation(err: any): boolean {
    if (err?.code !== 'P2039') return false;
    const text = `${err?.message ?? ''} ${err?.meta?.driverAdapterError?.message ?? ''}`;
    return /Ride_seatsAvailable_(nonnegative|lte_seatsTotal)/.test(text);
}

@Injectable()
export class BookingsService {
    constructor(private prisma: PrismaService) { }

    async create(riderId: string, rideId: string, seatsBooked: number = 1) {
        try {
            return await this.prisma.$transaction(async (tx) => {
                // Lock the ride row for the duration of this transaction
                const rides = await tx.$queryRaw<{ id: string; status: RideStatus; seatsAvailable: number; driverId: string }[]>`SELECT id, status, "seatsAvailable", "driverId" FROM "Ride" WHERE id = ${rideId} FOR UPDATE`;
                const ride = rides[0];
                if (!ride) throw bookingError(NotFoundException, 'RIDE_NOT_FOUND', 'Ride not found');
                if (riderId === ride.driverId) {
                    throw bookingError(ConflictException, 'CANNOT_BOOK_OWN_RIDE', 'Drivers cannot book their own ride');
                }
                if (ride.status !== 'ACTIVE') {
                    throw bookingError(ConflictException, 'RIDE_NOT_ACTIVE', 'Ride is not open for booking');
                }
                if (ride.seatsAvailable < seatsBooked) {
                    throw bookingError(ConflictException, 'SEAT_NO_LONGER_AVAILABLE', 'Not enough seats available');
                }

                // Test hook: widens the window between the seat check and the decrement so
                // concurrency tests can prove the lock closes it. Never active in production.
                const testDelayMs = process.env.NODE_ENV === 'production' ? 0 : Number(process.env.BOOKING_TEST_DELAY_MS ?? 0);
                if (testDelayMs > 0) await new Promise((resolve) => setTimeout(resolve, testDelayMs));

                await tx.ride.update({
                    where: { id: rideId },
                    data: { seatsAvailable: { decrement: seatsBooked } },
                });

                return tx.booking.create({
                    data: { rideId, riderId, seatsBooked },
                });
            });
        } catch (err) {
            if (isSeatCheckViolation(err)) {
                throw bookingError(ConflictException, 'SEAT_NO_LONGER_AVAILABLE', 'Not enough seats available');
            }
            if (err.code === 'P2002') {
                // Booking has only one unique constraint, (rideId, riderId). If Prisma reports the
                // violated columns, require both; if it reports none, assume it is that one.
                const columns = uniqueViolationColumns(err);
                if (!columns || (columns.includes('rideId') && columns.includes('riderId'))) {
                    throw bookingError(ConflictException, 'ALREADY_BOOKED', 'You have already booked this ride');
                }
            }
            throw err;
        }
    }
}