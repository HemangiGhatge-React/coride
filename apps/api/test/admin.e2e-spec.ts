// Real-database tests for the admin endpoints and RolesGuard. No mocks: the real AppModule,
// guards, validation and Prisma, against the database in apps/api/.env.test.
import { ConflictException, INestApplication } from '@nestjs/common';
import { randomUUID } from 'crypto';
import request from 'supertest';
import { AdminService } from '../src/admin/admin.service';
import { PrismaService } from '../src/prisma/prisma.service';
import { bearer, createApp, createUser, login, purge } from './helpers';

const PREFIX = 'admtest-';

describe('admin endpoints', () => {
  let app: INestApplication;
  let prisma: PrismaService;
  let http: () => ReturnType<typeof request>;
  // Admins that already exist in the test database (it is a copy of main). The last-admin
  // guard rail depends on the global admin count, so they are demoted for the run and restored.
  let displacedAdminIds: string[] = [];

  beforeAll(async () => {
    app = await createApp();
    prisma = app.get(PrismaService);
    http = () => request(app.getHttpServer());
    await purge(prisma, PREFIX);
    const others = await prisma.user.findMany({ where: { role: 'ADMIN' }, select: { id: true } });
    displacedAdminIds = others.map((u) => u.id);
    await prisma.user.updateMany({ where: { id: { in: displacedAdminIds } }, data: { role: 'DRIVER' } });
  });

  afterAll(async () => {
    await purge(prisma, PREFIX);
    await prisma.user.updateMany({ where: { id: { in: displacedAdminIds } }, data: { role: 'ADMIN' } });
    await app.close();
  });

  const admin = async (label: string) => {
    const u = await createUser(prisma, PREFIX, label, 'ADMIN');
    return { ...u, ...(await login(app, u.email)) };
  };
  const driver = async (label: string) => {
    const u = await createUser(prisma, PREFIX, label, 'DRIVER');
    return { ...u, ...(await login(app, u.email)) };
  };

  describe('access control', () => {
    it('non-admin gets 403 FORBIDDEN on every /admin route', async () => {
      const d = await driver('plain');
      const id = randomUUID();
      // Lazy, so each request is created right before it is sent.
      const calls = [
        () => http().get('/admin/users'),
        () => http().get(`/admin/users/${id}`),
        () => http().patch(`/admin/users/${id}/role`).send({ role: 'ADMIN' }),
        () => http().get(`/admin/users/${id}/sessions`),
        () => http().post(`/admin/users/${id}/revoke-all`),
        () => http().delete(`/admin/sessions/${id}`),
      ];
      for (const call of calls) {
        const res = await call().set(bearer(d.accessToken));
        expect(res.status).toBe(403);
        expect(res.body).toEqual({
          statusCode: 403,
          error: 'Forbidden',
          code: 'FORBIDDEN',
          message: expect.any(String),
        });
      }
    });

    it('no token gets 401', async () => {
      expect((await http().get('/admin/users')).status).toBe(401);
    });

    it('a demoted admin loses access immediately, even with a token that still says ADMIN', async () => {
      const a = await admin('actor');
      const b = await admin('soon-demoted');
      expect((await http().get('/admin/users').set(bearer(b.accessToken))).status).toBe(200);

      const demote = await http().patch(`/admin/users/${b.id}/role`).set(bearer(a.accessToken)).send({ role: 'DRIVER' });
      expect(demote.status).toBe(200);
      expect(demote.body.role).toBe('DRIVER');

      // b's access token was issued while b was ADMIN and has not expired.
      const res = await http().get('/admin/users').set(bearer(b.accessToken));
      expect(res.status).toBe(403);
      expect(res.body.code).toBe('FORBIDDEN');
    });
  });

  describe('GET /admin/users', () => {
    it('lists users with counts, filters and pagination, and never returns secrets', async () => {
      const a = await admin('lister');
      const target = await driver('findme');
      await login(app, target.email); // second session for the same user

      const res = await http().get('/admin/users').query({ search: `${PREFIX}`, pageSize: 100 }).set(bearer(a.accessToken));
      expect(res.status).toBe(200);
      expect(res.body.page).toBe(1);
      expect(res.body.pageSize).toBe(100);
      expect(res.body.total).toBeGreaterThanOrEqual(2);
      const row = res.body.items.find((i: { id: string }) => i.id === target.id);
      expect(row).toMatchObject({ id: target.id, email: target.email, role: 'DRIVER', activeSessionCount: 2 });
      expect(Object.keys(row).sort()).toEqual(['activeSessionCount', 'createdAt', 'email', 'id', 'name', 'role']);
      expect(JSON.stringify(res.body)).not.toMatch(/password|\$2[aby]\$/i);

      const onlyAdmins = await http().get('/admin/users').query({ search: PREFIX, role: 'ADMIN', pageSize: 100 }).set(bearer(a.accessToken));
      expect(onlyAdmins.body.items.every((i: { role: string }) => i.role === 'ADMIN')).toBe(true);

      const page1 = await http().get('/admin/users').query({ search: PREFIX, pageSize: 1, page: 1 }).set(bearer(a.accessToken));
      const page2 = await http().get('/admin/users').query({ search: PREFIX, pageSize: 1, page: 2 }).set(bearer(a.accessToken));
      expect(page1.body.items).toHaveLength(1);
      expect(page2.body.items).toHaveLength(1);
      expect(page1.body.items[0].id).not.toBe(page2.body.items[0].id);
    });

    it('rejects bad query parameters with 400', async () => {
      const a = await admin('badquery');
      const auth = bearer(a.accessToken);
      expect((await http().get('/admin/users').query({ pageSize: 1000 }).set(auth)).status).toBe(400);
      expect((await http().get('/admin/users').query({ role: 'KING' }).set(auth)).status).toBe(400);
      expect((await http().get('/admin/users').query({ page: 0 }).set(auth)).status).toBe(400);
    });
  });

  describe('GET /admin/users/:id', () => {
    it('returns the same fields as a list row, with the live session count, and no secrets', async () => {
      const a = await admin('reader');
      const u = await createUser(prisma, PREFIX, 'detail');
      const before = await http().get(`/admin/users/${u.id}`).set(bearer(a.accessToken));
      expect(before.status).toBe(200);
      expect(before.body).toMatchObject({ id: u.id, email: u.email, name: 'detail', role: 'DRIVER', activeSessionCount: 0 });
      expect(Object.keys(before.body).sort()).toEqual(['activeSessionCount', 'createdAt', 'email', 'id', 'name', 'role']);
      expect(JSON.stringify(before.body)).not.toMatch(/password|\$2[aby]\$/i);

      await login(app, u.email);
      await login(app, u.email);
      const after = await http().get(`/admin/users/${u.id}`).set(bearer(a.accessToken));
      expect(after.body.activeSessionCount).toBe(2);

      // The list and the detail agree.
      const list = await http().get('/admin/users').query({ search: u.email }).set(bearer(a.accessToken));
      expect(list.body.items).toEqual([after.body]);
    });

    it('does not count revoked sessions', async () => {
      const a = await admin('revoked-reader');
      const u = await createUser(prisma, PREFIX, 'revoked');
      await login(app, u.email);
      await http().post(`/admin/users/${u.id}/revoke-all`).set(bearer(a.accessToken)).expect(204);
      const res = await http().get(`/admin/users/${u.id}`).set(bearer(a.accessToken));
      expect(res.body.activeSessionCount).toBe(0);
    });

    it('404 USER_NOT_FOUND for an unknown id, 400 for a malformed one', async () => {
      const a = await admin('lookup');
      const missing = await http().get(`/admin/users/${randomUUID()}`).set(bearer(a.accessToken));
      expect(missing.status).toBe(404);
      expect(missing.body).toMatchObject({ statusCode: 404, code: 'USER_NOT_FOUND' });
      expect((await http().get('/admin/users/not-a-uuid').set(bearer(a.accessToken))).status).toBe(400);
    });

    it('401 without a token', async () => {
      expect((await http().get(`/admin/users/${randomUUID()}`)).status).toBe(401);
    });
  });

  describe('PATCH /admin/users/:id/role guard rails', () => {
    it('409 CANNOT_CHANGE_OWN_ROLE when changing your own role', async () => {
      const a = await admin('self');
      const res = await http().patch(`/admin/users/${a.id}/role`).set(bearer(a.accessToken)).send({ role: 'DRIVER' });
      expect(res.status).toBe(409);
      expect(res.body).toMatchObject({ statusCode: 409, code: 'CANNOT_CHANGE_OWN_ROLE' });
      expect((await prisma.user.findUniqueOrThrow({ where: { id: a.id } })).role).toBe('ADMIN');
    });

    it('409 LAST_ADMIN: two admins demoting each other at once cannot leave zero admins', async () => {
      // Calls the service directly: through HTTP, RolesGuard re-checks the actor's role first and
      // would turn the slower request into a 403, which hides the race this guard rail is for.
      const service = app.get(AdminService);
      // The rule depends on the global admin count, so start with no admins from earlier tests.
      await purge(prisma, PREFIX);
      for (let round = 0; round < 5; round++) {
        const a = await createUser(prisma, PREFIX, `race-a${round}`, 'ADMIN');
        const b = await createUser(prisma, PREFIX, `race-b${round}`, 'ADMIN');

        const results = await Promise.allSettled([
          service.updateRole(a.id, b.id, 'DRIVER'),
          service.updateRole(b.id, a.id, 'DRIVER'),
        ]);

        expect(results.filter((r) => r.status === 'fulfilled')).toHaveLength(1);
        const rejected = results.find((r) => r.status === 'rejected') as PromiseRejectedResult;
        expect(rejected.reason).toBeInstanceOf(ConflictException);
        expect(rejected.reason.getResponse()).toMatchObject({ statusCode: 409, code: 'LAST_ADMIN' });
        expect(await prisma.user.count({ where: { role: 'ADMIN' } })).toBe(1);

        await purge(prisma, PREFIX);
      }
    });

    it('promotes and demotes, and is idempotent', async () => {
      const a = await admin('promoter');
      const t = await driver('promotee');
      const auth = bearer(a.accessToken);
      const up = await http().patch(`/admin/users/${t.id}/role`).set(auth).send({ role: 'ADMIN' });
      expect(up.body).toMatchObject({ id: t.id, role: 'ADMIN' });
      expect(up.body.password).toBeUndefined();
      const again = await http().patch(`/admin/users/${t.id}/role`).set(auth).send({ role: 'ADMIN' });
      expect(again.status).toBe(200);
      const down = await http().patch(`/admin/users/${t.id}/role`).set(auth).send({ role: 'DRIVER' });
      expect(down.body.role).toBe('DRIVER');
    });

    it('404 USER_NOT_FOUND and 400 for bad input', async () => {
      const a = await admin('badinput');
      const auth = bearer(a.accessToken);
      const missing = await http().patch(`/admin/users/${randomUUID()}/role`).set(auth).send({ role: 'ADMIN' });
      expect(missing.status).toBe(404);
      expect(missing.body.code).toBe('USER_NOT_FOUND');
      expect((await http().patch(`/admin/users/${randomUUID()}/role`).set(auth).send({ role: 'KING' })).status).toBe(400);
      expect((await http().patch('/admin/users/not-a-uuid/role').set(auth).send({ role: 'ADMIN' })).status).toBe(400);
    });
  });

  describe('sessions', () => {
    it('lists active sessions with userAgent and lastUsedAt, and revoking one kills its refresh token', async () => {
      const a = await admin('revoker');
      const u = await createUser(prisma, PREFIX, 'sessions');
      const phone = await login(app, u.email, 'CorideApp/1.0 (iPhone)');
      const laptop = await login(app, u.email, 'Mozilla/5.0 Firefox');

      // Rotating the phone session updates lastUsedAt on its live token.
      const rotated = await http().post('/auth/refresh').set('User-Agent', 'CorideApp/1.1 (iPhone)').send({ refresh_token: phone.refreshToken });
      expect(rotated.status).toBe(200);

      const list = await http().get(`/admin/users/${u.id}/sessions`).set(bearer(a.accessToken));
      expect(list.status).toBe(200);
      expect(list.body).toHaveLength(2);
      for (const s of list.body) {
        expect(Object.keys(s).sort()).toEqual(['createdAt', 'familyId', 'lastUsedAt', 'userAgent']);
        expect(new Date(s.lastUsedAt).getTime()).toBeGreaterThan(0);
      }
      const agents = list.body.map((s: { userAgent: string }) => s.userAgent).sort();
      expect(agents).toEqual(['CorideApp/1.1 (iPhone)', 'Mozilla/5.0 Firefox']);

      const laptopFamily = list.body.find((s: { userAgent: string }) => s.userAgent.startsWith('Mozilla')).familyId;
      const phoneSession = list.body.find((s: { userAgent: string }) => s.userAgent.startsWith('CorideApp'));
      // The session started at login, before the rotation that produced the live token.
      expect(new Date(phoneSession.createdAt).getTime()).toBeLessThanOrEqual(new Date(phoneSession.lastUsedAt).getTime());

      const del = await http().delete(`/admin/sessions/${laptopFamily}`).set(bearer(a.accessToken));
      expect(del.status).toBe(204);

      const dead = await http().post('/auth/refresh').send({ refresh_token: laptop.refreshToken });
      expect(dead.status).toBe(401);
      const alive = await http().post('/auth/refresh').send({ refresh_token: rotated.body.refresh_token });
      expect(alive.status).toBe(200);

      const after = await http().get(`/admin/users/${u.id}/sessions`).set(bearer(a.accessToken));
      expect(after.body).toHaveLength(1);
    });

    it('revoke-all makes every refresh token of the user return 401', async () => {
      const a = await admin('revoke-all');
      const u = await createUser(prisma, PREFIX, 'victim');
      const s1 = await login(app, u.email);
      const s2 = await login(app, u.email);

      expect((await http().post(`/admin/users/${u.id}/revoke-all`).set(bearer(a.accessToken))).status).toBe(204);

      expect((await http().post('/auth/refresh').send({ refresh_token: s1.refreshToken })).status).toBe(401);
      expect((await http().post('/auth/refresh').send({ refresh_token: s2.refreshToken })).status).toBe(401);
      const list = await http().get(`/admin/users/${u.id}/sessions`).set(bearer(a.accessToken));
      expect(list.body).toEqual([]);
    });

    it('404 for unknown users and sessions', async () => {
      const a = await admin('notfound');
      const auth = bearer(a.accessToken);
      expect((await http().get(`/admin/users/${randomUUID()}/sessions`).set(auth)).body.code).toBe('USER_NOT_FOUND');
      expect((await http().post(`/admin/users/${randomUUID()}/revoke-all`).set(auth)).status).toBe(404);
      const missing = await http().delete(`/admin/sessions/${randomUUID()}`).set(auth);
      expect(missing.status).toBe(404);
      expect(missing.body.code).toBe('SESSION_NOT_FOUND');
    });
  });
});
