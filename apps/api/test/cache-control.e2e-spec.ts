// Responses under /auth/* and /admin/* must carry Cache-Control: no-store (tokens, sessions and
// personal data must not be cached by the browser or a proxy). Real AppModule against .env.test.
import { INestApplication } from '@nestjs/common';
import { randomUUID } from 'crypto';
import request from 'supertest';
import { PrismaService } from '../src/prisma/prisma.service';
import { PASSWORD, bearer, createApp, createUser, login, purge } from './helpers';

const PREFIX = 'cctest-';

describe('Cache-Control: no-store on /auth/* and /admin/*', () => {
  let app: INestApplication;
  let prisma: PrismaService;
  const http = () => request(app.getHttpServer());

  beforeAll(async () => {
    app = await createApp();
    prisma = app.get(PrismaService);
    await purge(prisma, PREFIX);
  });

  afterAll(async () => {
    await purge(prisma, PREFIX);
    await app.close();
  });

  it('is set on auth responses: login (200 and 401), me, refresh (200 and 401), logout', async () => {
    const u = await createUser(prisma, PREFIX, 'auth');

    const ok = await http().post('/auth/login').send({ email: u.email, password: PASSWORD });
    expect(ok.status).toBe(200);
    expect(ok.headers['cache-control']).toBe('no-store');

    const bad = await http().post('/auth/login').send({ email: u.email, password: 'wrong-password' });
    expect(bad.status).toBe(401);
    expect(bad.headers['cache-control']).toBe('no-store');

    const me = await http().get('/auth/me').set(bearer(ok.body.access_token));
    expect(me.status).toBe(200);
    expect(me.headers['cache-control']).toBe('no-store');

    // A second GET must not be answerable with a 304 from a conditional request either.
    const etag = me.headers['etag'];
    const again = await http().get('/auth/me').set(bearer(ok.body.access_token)).set('If-None-Match', etag ?? '');
    expect(again.headers['cache-control']).toBe('no-store');

    const refreshed = await http().post('/auth/refresh').send({ refresh_token: ok.body.refresh_token });
    expect(refreshed.status).toBe(200);
    expect(refreshed.headers['cache-control']).toBe('no-store');

    const rejected = await http().post('/auth/refresh').send({ refresh_token: 'not-a-real-token' });
    expect(rejected.status).toBe(401);
    expect(rejected.headers['cache-control']).toBe('no-store');

    const out = await http().post('/auth/logout').send({ refresh_token: refreshed.body.refresh_token });
    expect(out.status).toBe(204);
    expect(out.headers['cache-control']).toBe('no-store');
  });

  it('is set on admin responses: 200, 401 (no token) and 403 (not an admin)', async () => {
    const admin = await createUser(prisma, PREFIX, 'admin', 'ADMIN');
    const driver = await createUser(prisma, PREFIX, 'driver');
    const adminSession = await login(app, admin.email);
    const driverSession = await login(app, driver.email);

    const list = await http().get('/admin/users').query({ search: PREFIX }).set(bearer(adminSession.accessToken));
    expect(list.status).toBe(200);
    expect(list.headers['cache-control']).toBe('no-store');

    const sessions = await http().get(`/admin/users/${driver.id}/sessions`).set(bearer(adminSession.accessToken));
    expect(sessions.status).toBe(200);
    expect(sessions.headers['cache-control']).toBe('no-store');

    const anonymous = await http().get('/admin/users');
    expect(anonymous.status).toBe(401);
    expect(anonymous.headers['cache-control']).toBe('no-store');

    const forbidden = await http().get('/admin/users').set(bearer(driverSession.accessToken));
    expect(forbidden.status).toBe(403);
    expect(forbidden.headers['cache-control']).toBe('no-store');

    const notFound = await http().delete(`/admin/sessions/${randomUUID()}`).set(bearer(adminSession.accessToken));
    expect(notFound.status).toBe(404);
    expect(notFound.headers['cache-control']).toBe('no-store');
  });

  it('is not added to other routes (only /auth and /admin are sensitive)', async () => {
    const health = await http().get('/health');
    expect(health.status).toBe(200);
    expect(health.headers['cache-control']).toBeUndefined();
  });

  it('does not match look-alike prefixes such as /authors or /administrator', async () => {
    const res = await http().get('/authors');
    expect(res.status).toBe(404);
    expect(res.headers['cache-control']).toBeUndefined();
  });
});
