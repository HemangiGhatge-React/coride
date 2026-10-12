// Demo data for the admin dashboard: ~18 users with Norwegian-sounding names, two admins, and
// some active login sessions with varied clients. Everything it creates has an email ending in
// DEMO_EMAIL_DOMAIN, and that suffix is the ONLY thing removeDemo() deletes by, so other users
// are never touched. Demo users have no password, so nobody can log in as them.
import type { PrismaClient, Role } from '@prisma/client';
import { createHash, randomBytes, randomUUID } from 'crypto';

export const DEMO_EMAIL_DOMAIN = '@demo.coride.no';

const HOUR_MS = 60 * 60 * 1000;
const DAY_MS = 24 * HOUR_MS;
const SESSION_TTL_MS = 30 * DAY_MS; // same as the real refresh token lifetime

const CLIENTS = {
  chromeWindows:
    'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/130.0.0.0 Safari/537.36',
  safariIphone:
    'Mozilla/5.0 (iPhone; CPU iPhone OS 18_0 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/18.0 Mobile/15E148 Safari/604.1',
  corideAndroid: 'CoRide/1.0 (Android 15; Pixel 8)',
} as const;

type Client = keyof typeof CLIENTS;

interface DemoUser {
  name: string;
  role: Role;
  /** One entry per active session (token family): which client it is. */
  sessions?: Client[];
}

// Order matters: index i is created (i * 3 + 2) days ago, so the newest accounts come first.
export const DEMO_USERS: DemoUser[] = [
  { name: 'Kari Nordmann', role: 'DRIVER', sessions: ['chromeWindows', 'safariIphone', 'corideAndroid'] },
  { name: 'Ingrid Solheim', role: 'ADMIN', sessions: ['chromeWindows', 'safariIphone'] },
  { name: 'Ola Hansen', role: 'DRIVER', sessions: ['corideAndroid', 'chromeWindows'] },
  { name: 'Nora Johansen', role: 'DRIVER', sessions: ['safariIphone'] },
  { name: 'Lars Olsen', role: 'DRIVER', sessions: ['corideAndroid'] },
  { name: 'Emma Kristiansen', role: 'DRIVER', sessions: ['safariIphone', 'corideAndroid', 'chromeWindows'] },
  { name: 'Magnus Larsen', role: 'DRIVER', sessions: ['chromeWindows'] },
  { name: 'Henrik Bakken', role: 'ADMIN', sessions: ['chromeWindows'] },
  { name: 'Sofie Andersen', role: 'DRIVER' },
  { name: 'Jakob Pedersen', role: 'DRIVER' },
  { name: 'Ida Nilsen', role: 'DRIVER' },
  { name: 'Sander Eriksen', role: 'DRIVER' },
  { name: 'Maja Karlsen', role: 'DRIVER' },
  { name: 'Bjørn Dahl', role: 'DRIVER' },
  { name: 'Synnøve Fjeld', role: 'DRIVER' },
  { name: 'Thea Haugen', role: 'DRIVER' },
  { name: 'Åsmund Vik', role: 'DRIVER' },
  { name: 'Silje Lunde', role: 'DRIVER' },
];

/** "Bjørn Dahl" -> "bjorn.dahl@demo.coride.no" */
export function demoEmail(name: string): string {
  const local = name
    .toLowerCase()
    .replace(/æ/g, 'ae')
    .replace(/ø/g, 'o')
    .replace(/å/g, 'a')
    .replace(/[^a-z\s]/g, '')
    .trim()
    .replace(/\s+/g, '.');
  return `${local}${DEMO_EMAIL_DOMAIN}`;
}

export interface DemoCounts {
  users: number;
  admins: number;
  activeSessions: number;
}

const demoWhere = { email: { endsWith: DEMO_EMAIL_DOMAIN } } as const;

export async function countDemo(prisma: PrismaClient): Promise<DemoCounts> {
  const [users, admins, families] = await Promise.all([
    prisma.user.count({ where: demoWhere }),
    prisma.user.count({ where: { ...demoWhere, role: 'ADMIN' } }),
    prisma.refreshToken.groupBy({
      by: ['familyId'],
      where: { user: demoWhere, revokedAt: null, expiresAt: { gt: new Date() } },
    }),
  ]);
  return { users, admins, activeSessions: families.length };
}

/**
 * Creates (or refreshes) the demo users and their sessions. Idempotent: users are upserted by
 * email and the demo users' sessions are replaced, so running it twice gives the same counts.
 */
export async function seedDemo(prisma: PrismaClient, now = new Date()): Promise<DemoCounts> {
  await prisma.$transaction(async (tx) => {
    const ids: string[] = [];
    for (const [i, demo] of DEMO_USERS.entries()) {
      const email = demoEmail(demo.name);
      const user = await tx.user.upsert({
        where: { email },
        update: { name: demo.name, role: demo.role },
        create: {
          email,
          name: demo.name,
          role: demo.role,
          password: null,
          createdAt: new Date(now.getTime() - (i * 3 + 2) * DAY_MS),
        },
        select: { id: true },
      });
      ids.push(user.id);
    }

    await tx.refreshToken.deleteMany({ where: { userId: { in: ids } } });

    let n = 0;
    for (const [i, demo] of DEMO_USERS.entries()) {
      for (const client of demo.sessions ?? []) {
        n++;
        // Spread "last used" over the past week, newest first, deterministically.
        const lastUsedAt = new Date(now.getTime() - (((n * 37) % 160) + 2) * HOUR_MS);
        await tx.refreshToken.create({
          data: {
            userId: ids[i],
            familyId: randomUUID(),
            // Random hash of a token nobody holds: the session shows up but cannot be used.
            tokenHash: createHash('sha256').update(randomBytes(32)).digest('hex'),
            userAgent: CLIENTS[client],
            lastUsedAt,
            createdAt: new Date(lastUsedAt.getTime() - (n % 3) * DAY_MS),
            expiresAt: new Date(lastUsedAt.getTime() + SESSION_TTL_MS),
          },
        });
      }
    }
  });
  return countDemo(prisma);
}

/** Deletes only users whose email ends in DEMO_EMAIL_DOMAIN (their sessions cascade). */
export async function removeDemo(prisma: PrismaClient): Promise<{ removed: number }> {
  const { count } = await prisma.user.deleteMany({ where: demoWhere });
  return { removed: count };
}
