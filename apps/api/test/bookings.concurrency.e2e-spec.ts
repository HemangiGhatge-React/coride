// Real-database concurrency tests for POST /bookings. No Prisma mocks.
// Runs against the database in apps/api/.env.test (see load-test-env.ts) and only
// touches rows it creates itself (emails prefixed "bktest-"), which it deletes afterwards.
import { INestApplication, ValidationPipe } from '@nestjs/common';
import { JwtModule, JwtService } from '@nestjs/jwt';
import { PassportModule } from '@nestjs/passport';
import { Test } from '@nestjs/testing';
import request from 'supertest';
import { JwtStrategy } from '../src/auth/jwt.strategy';
import { ACCESS_TOKEN_AUDIENCE } from '../src/auth/tokens.service';
import { BookingsModule } from '../src/bookings/bookings.module';
import { PrismaModule } from '../src/prisma/prisma.module';
import { PrismaService } from '../src/prisma/prisma.service';

const PREFIX = 'bktest-';
const RIDERS = 10;

type Outcome = { status: number; body: { code?: string; message?: string } };

describe.each([0, 200])('POST /bookings concurrency (BOOKING_TEST_DELAY_MS=%i)', (delayMs) => {
  let app: INestApplication;
  let prisma: PrismaService;
  let baseUrl: string;
  let driverId: string;
  let vehicleId: string;
  let riders: { id: string; token: string }[];

  async function purge() {
    const users = await prisma.user.findMany({ where: { email: { startsWith: PREFIX } }, select: { id: true } });
    const ids = users.map((u) => u.id);
    await prisma.booking.deleteMany({ where: { OR: [{ riderId: { in: ids } }, { ride: { driverId: { in: ids } } }] } });
    await prisma.ride.deleteMany({ where: { driverId: { in: ids } } });
    await prisma.vehicle.deleteMany({ where: { ownerId: { in: ids } } });
    await prisma.user.deleteMany({ where: { id: { in: ids } } });
  }

  async function createUser(label: string) {
    const user = await prisma.user.create({
      data: { email: `${PREFIX}${Date.now()}-${label}@example.test`, name: label, password: null },
    });
    const token = app
      .get(JwtService)
      .sign(
        { sub: user.id, email: user.email, role: user.role },
        { expiresIn: '15m', audience: ACCESS_TOKEN_AUDIENCE },
      );
    return { id: user.id, token };
  }

  async function createRide(seats: number) {
    const ride = await prisma.ride.create({
      data: {
        driverId,
        vehicleId,
        origin: 'Oslo',
        destination: 'Geilo',
        departureTime: new Date(Date.now() + 24 * 3600 * 1000),
        seatsTotal: seats,
        seatsAvailable: seats,
        totalFuelCost: 400,
        costPerSeat: 100,
      },
    });
    return ride.id;
  }

  const book = async (token: string, rideId: string): Promise<Outcome> => {
    const res = await request(baseUrl).post('/bookings').set('Authorization', `Bearer ${token}`).send({ rideId });
    return { status: res.status, body: res.body };
  };

  const settle = async (calls: Promise<Outcome>[]) =>
    (await Promise.allSettled(calls)).map((r) => {
      if (r.status === 'rejected') throw r.reason;
      return r.value;
    });

  const state = async (rideId: string) => ({
    seatsAvailable: (await prisma.ride.findUniqueOrThrow({ where: { id: rideId } })).seatsAvailable,
    bookings: await prisma.booking.count({ where: { rideId } }),
  });

  beforeAll(async () => {
    process.env.BOOKING_TEST_DELAY_MS = String(delayMs);
    // Real bookings stack (guard, validation, service, Prisma) without AuthModule, which pulls in ESM-only `jose`.
    const moduleRef = await Test.createTestingModule({
      imports: [PrismaModule, PassportModule, JwtModule.register({ secret: process.env.JWT_SECRET }), BookingsModule],
      providers: [JwtStrategy],
    }).compile();
    app = moduleRef.createNestApplication();
    app.useGlobalPipes(new ValidationPipe({ whitelist: true, forbidNonWhitelisted: true }));
    await app.listen(0);
    baseUrl = await app.getUrl();
    prisma = app.get(PrismaService);

    // Open every pooled connection up front. Otherwise requests reach the database staggered
    // (connections are created lazily) and a lock-less implementation can pass by luck.
    await Promise.all(Array.from({ length: RIDERS }, () => prisma.$queryRaw`SELECT pg_sleep(0.3)::text`));

    await purge();
    const driver = await createUser('driver');
    driverId = driver.id;
    vehicleId = (
      await prisma.vehicle.create({ data: { ownerId: driverId, make: 'Test', model: 'Car', plate: 'BK1', seats: 5 } })
    ).id;
    riders = [];
    for (let i = 0; i < RIDERS; i++) riders.push(await createUser(`rider${i}`));
  });

  afterAll(async () => {
    await purge();
    delete process.env.BOOKING_TEST_DELAY_MS;
    await app.close();
  });

  it('A: 1 seat, 10 riders -> exactly 1 success, 9 SEAT_NO_LONGER_AVAILABLE', async () => {
    const rideId = await createRide(1);
    const results = await settle(riders.map((r) => book(r.token, rideId)));

    expect(await state(rideId)).toEqual({ seatsAvailable: 0, bookings: 1 });
    expect(results.filter((r) => r.status === 201)).toHaveLength(1);
    const failures = results.filter((r) => r.status !== 201);
    expect(failures).toHaveLength(RIDERS - 1);
    for (const f of failures) {
      expect(f.status).toBe(409);
      expect(f.body.code).toBe('SEAT_NO_LONGER_AVAILABLE');
    }
  });

  it('B: 3 seats, 10 riders -> exactly 3 successes, seatsAvailable 0, never negative', async () => {
    const rideId = await createRide(3);
    const results = await settle(riders.map((r) => book(r.token, rideId)));

    expect(await state(rideId)).toEqual({ seatsAvailable: 0, bookings: 3 });
    expect(results.filter((r) => r.status === 201)).toHaveLength(3);
    const failures = results.filter((r) => r.status !== 201);
    expect(failures).toHaveLength(RIDERS - 3);
    for (const f of failures) {
      expect(f.status).toBe(409);
      expect(f.body.code).toBe('SEAT_NO_LONGER_AVAILABLE');
    }
  });

  it('C: same rider, 5 concurrent requests -> 1 booking, the rest ALREADY_BOOKED, no 500s', async () => {
    // 3 seats so that seats don't run out and mask the duplicate-booking path.
    const rideId = await createRide(3);
    const results = await settle(Array.from({ length: 5 }, () => book(riders[0].token, rideId)));

    // The losing requests must roll back their seat decrement, so only one seat is gone.
    expect(await state(rideId)).toEqual({ seatsAvailable: 2, bookings: 1 });
    expect(results.filter((r) => r.status >= 500)).toHaveLength(0);
    expect(results.filter((r) => r.status === 201)).toHaveLength(1);
    const failures = results.filter((r) => r.status !== 201);
    expect(failures).toHaveLength(4);
    for (const f of failures) {
      expect(f.status).toBe(409);
      expect(f.body.code).toBe('ALREADY_BOOKED');
    }
  });
});
