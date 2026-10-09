// Real-database tests for cookie-based refresh (web) alongside body-based refresh (mobile),
// and the CORS allowlist. Real AppModule against apps/api/.env.test.
import { INestApplication } from '@nestjs/common';
import request from 'supertest';
import { parseCorsOrigins } from '../src/app.setup';
import { PrismaService } from '../src/prisma/prisma.service';
import { PASSWORD, createApp, createUser, purge } from './helpers';

const PREFIX = 'cktest-';
const ALLOWED_ORIGIN = 'http://localhost:3000';

const setCookies = (res: request.Response): string[] => (res.headers['set-cookie'] as unknown as string[]) ?? [];
const refreshCookie = (res: request.Response) => setCookies(res).find((c) => c.startsWith('refresh_token='));
const cookieValue = (setCookie: string) => decodeURIComponent(setCookie.split(';')[0].slice('refresh_token='.length));

describe('refresh cookie and CORS', () => {
  let app: INestApplication;
  let prisma: PrismaService;
  let email: string;
  const http = () => request(app.getHttpServer());
  const login = () => http().post('/auth/login').send({ email, password: PASSWORD });

  beforeAll(async () => {
    process.env.CORS_ORIGINS = `${ALLOWED_ORIGIN}, https://app.example.test/`;
    app = await createApp();
    prisma = app.get(PrismaService);
    await purge(prisma, PREFIX);
    email = (await createUser(prisma, PREFIX, 'web')).email;
  });

  afterAll(async () => {
    delete process.env.CORS_ORIGINS;
    await purge(prisma, PREFIX);
    await app.close();
  });

  describe('login', () => {
    it('sets an httpOnly, Secure, SameSite=Lax cookie scoped to /auth, and still returns the token in the body', async () => {
      const res = await login();
      expect(res.status).toBe(200);

      const cookie = refreshCookie(res);
      expect(cookie).toBeDefined();
      expect(cookie).toMatch(/;\s*HttpOnly/i);
      expect(cookie).toMatch(/;\s*Secure/i);
      expect(cookie).toMatch(/;\s*SameSite=Lax/i);
      expect(cookie).toMatch(/;\s*Path=\/auth(;|$)/);
      expect(cookie).toMatch(/;\s*Max-Age=\d+/i);

      expect(typeof res.body.refresh_token).toBe('string');
      expect(cookieValue(cookie!)).toBe(res.body.refresh_token);
    });

    it('scopes the cookie to REFRESH_COOKIE_PATH when set', async () => {
      process.env.REFRESH_COOKIE_PATH = '/api/auth';
      try {
        expect(refreshCookie(await login())).toMatch(/;\s*Path=\/api\/auth(;|$)/);
      } finally {
        delete process.env.REFRESH_COOKIE_PATH;
      }
    });
  });

  describe('refresh', () => {
    it('works with the cookie only (no body) and rotates the cookie', async () => {
      const first = await login();
      const cookie = refreshCookie(first)!;

      const res = await http().post('/auth/refresh').set('Cookie', cookie.split(';')[0]);
      expect(res.status).toBe(200);
      expect(typeof res.body.access_token).toBe('string');

      const rotated = refreshCookie(res);
      expect(rotated).toBeDefined();
      expect(cookieValue(rotated!)).toBe(res.body.refresh_token);
      expect(cookieValue(rotated!)).not.toBe(first.body.refresh_token);

      // The new access token is usable.
      const me = await http().get('/auth/me').set('Authorization', `Bearer ${res.body.access_token}`);
      expect(me.status).toBe(200);
      expect(me.body.email).toBe(email);

      // And the rotated cookie works for the next refresh.
      const next = await http().post('/auth/refresh').set('Cookie', rotated!.split(';')[0]);
      expect(next.status).toBe(200);
    });

    it('still works with the token in the body only (mobile)', async () => {
      const first = await login();
      const res = await http().post('/auth/refresh').send({ refresh_token: first.body.refresh_token });
      expect(res.status).toBe(200);
      expect(res.body.refresh_token).not.toBe(first.body.refresh_token);
    });

    it('401 INVALID_REFRESH_TOKEN with neither cookie nor body', async () => {
      const res = await http().post('/auth/refresh');
      expect(res.status).toBe(401);
      expect(res.body.message).toBe('INVALID_REFRESH_TOKEN');
    });

    it('401 for an unknown cookie token, and the cookie is cleared', async () => {
      const res = await http().post('/auth/refresh').set('Cookie', 'refresh_token=not-a-real-token');
      expect(res.status).toBe(401);
      const cleared = refreshCookie(res);
      expect(cleared).toBeDefined();
      expect(cleared).toMatch(/refresh_token=;/);
      expect(cleared).toMatch(/Expires=Thu, 01 Jan 1970/i);
      expect(cleared).toMatch(/;\s*Path=\/auth(;|$)/);
    });
  });

  describe('logout', () => {
    it('reads the cookie, clears it, and kills the session', async () => {
      const first = await login();
      const cookie = refreshCookie(first)!.split(';')[0];

      const out = await http().post('/auth/logout').set('Cookie', cookie);
      expect(out.status).toBe(204);
      expect(refreshCookie(out)).toMatch(/refresh_token=;/);

      const after = await http().post('/auth/refresh').set('Cookie', cookie);
      expect(after.status).toBe(401);
    });

    it('is a quiet 204 with nothing to log out', async () => {
      const out = await http().post('/auth/logout');
      expect(out.status).toBe(204);
    });
  });

  describe('CORS', () => {
    it('allows an origin from CORS_ORIGINS with credentials', async () => {
      const res = await http()
        .options('/auth/refresh')
        .set('Origin', ALLOWED_ORIGIN)
        .set('Access-Control-Request-Method', 'POST');
      expect(res.headers['access-control-allow-origin']).toBe(ALLOWED_ORIGIN);
      expect(res.headers['access-control-allow-credentials']).toBe('true');
    });

    it('accepts an entry written with a trailing slash and surrounding spaces', async () => {
      const res = await http().options('/auth/refresh').set('Origin', 'https://app.example.test').set('Access-Control-Request-Method', 'POST');
      expect(res.headers['access-control-allow-origin']).toBe('https://app.example.test');
    });

    it('sends no Allow-Origin to an origin that is not allowed', async () => {
      const res = await http()
        .options('/auth/refresh')
        .set('Origin', 'https://evil.example.test')
        .set('Access-Control-Request-Method', 'POST');
      // Without Access-Control-Allow-Origin the browser blocks the response, whatever else is set.
      expect(res.headers['access-control-allow-origin']).toBeUndefined();
    });

    it('an unset CORS_ORIGINS allows no origins', () => {
      expect(parseCorsOrigins(undefined)).toEqual([]);
      expect(parseCorsOrigins('')).toEqual([]);
      expect(parseCorsOrigins(' http://a.test/ , ,http://b.test')).toEqual(['http://a.test', 'http://b.test']);
    });
  });
});
