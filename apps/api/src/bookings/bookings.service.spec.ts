import { ConflictException } from '@nestjs/common';
import { BookingsService } from './bookings.service';

// PrismaService throws at import without DATABASE_URL; this spec never touches a database.
jest.mock('../prisma/prisma.service', () => ({ PrismaService: class {} }));

// Unit test with a stubbed PrismaService: the real-database lock behaviour is covered by
// test/bookings.concurrency.e2e-spec.ts. This only checks error mapping.
describe('BookingsService CHECK violation mapping', () => {
  const service = (err: unknown) =>
    new BookingsService({ $transaction: jest.fn().mockRejectedValue(err) } as any);

  it('maps a Ride seat CHECK violation (P2039/23514) to 409 SEAT_NO_LONGER_AVAILABLE', async () => {
    const err = Object.assign(
      new Error('Database error. Code: `23514`. Message: `new row for relation "Ride" violates check constraint "Ride_seatsAvailable_nonnegative"`'),
      { code: 'P2039' },
    );
    const rejection = await service(err).create('rider', 'ride').catch((e) => e);
    expect(rejection).toBeInstanceOf(ConflictException);
    expect(rejection.getStatus()).toBe(409);
    expect(rejection.getResponse()).toMatchObject({ code: 'SEAT_NO_LONGER_AVAILABLE' });
  });

  it('rethrows other errors unchanged', async () => {
    const err = Object.assign(new Error('violates check constraint "Other_check"'), { code: 'P2039' });
    await expect(service(err).create('rider', 'ride')).rejects.toBe(err);
  });
});
