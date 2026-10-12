// Real-database tests for the demo seed (scripts/demo-users.ts): idempotent, and `remove` deletes
// only @demo.coride.no rows. Runs against apps/api/.env.test (see load-test-env.ts).
import { INestApplication } from '@nestjs/common';
import { createHash } from 'crypto';
import { AdminService } from '../src/admin/admin.service';
import { PrismaService } from '../src/prisma/prisma.service';
import { DEMO_EMAIL_DOMAIN, DEMO_USERS, countDemo, demoEmail, removeDemo, seedDemo } from '../scripts/demo-users';
import { createApp, createUser, purge } from './helpers';

const PREFIX = 'seedtest-';

describe('demo seed', () => {
  let app: INestApplication;
  let prisma: PrismaService;

  beforeAll(async () => {
    app = await createApp();
    prisma = app.get(PrismaService);
    await removeDemo(prisma);
    await purge(prisma, PREFIX);
  });

  afterAll(async () => {
    await removeDemo(prisma);
    await purge(prisma, PREFIX);
    await app.close();
  });

  const expectedSessions = DEMO_USERS.reduce((n, u) => n + (u.sessions?.length ?? 0), 0);

  it('creates ~18 users with 2 admins and active sessions, without passwords', async () => {
    const counts = await seedDemo(prisma);
    expect(counts).toEqual({ users: 18, admins: 2, activeSessions: expectedSessions });

    const users = await prisma.user.findMany({ where: { email: { endsWith: DEMO_EMAIL_DOMAIN } } });
    expect(users.every((u) => u.password === null && u.vippsSub === null)).toBe(true);
    expect(users.find((u) => u.name === 'Kari Nordmann')?.email).toBe('kari.nordmann@demo.coride.no');
    expect(users.find((u) => u.name === 'Bjørn Dahl')?.email).toBe('bjorn.dahl@demo.coride.no');
    expect(demoEmail('Åsmund Vik')).toBe('asmund.vik@demo.coride.no');
  });

  it('has 1-3 sessions for the users that have any, varied clients, last used within the past week', async () => {
    await seedDemo(prisma);
    const tokens = await prisma.refreshToken.findMany({ where: { user: { email: { endsWith: DEMO_EMAIL_DOMAIN } } } });

    const perUser = new Map<string, Set<string>>();
    for (const t of tokens) perUser.set(t.userId, (perUser.get(t.userId) ?? new Set()).add(t.familyId));
    for (const families of perUser.values()) {
      expect(families.size).toBeGreaterThanOrEqual(1);
      expect(families.size).toBeLessThanOrEqual(3);
    }

    const agents = new Set(tokens.map((t) => t.userAgent ?? ''));
    expect([...agents].some((a) => /Chrome.*Windows|Windows.*Chrome/.test(a))).toBe(true);
    expect([...agents].some((a) => /iPhone.*Safari/.test(a))).toBe(true);
    expect([...agents].some((a) => a.startsWith('CoRide/') && a.includes('Android'))).toBe(true);

    const week = Date.now() - 7 * 24 * 3600 * 1000;
    expect(tokens.every((t) => t.lastUsedAt && t.lastUsedAt.getTime() > week && t.lastUsedAt.getTime() <= Date.now())).toBe(true);
    expect(tokens.every((t) => t.revokedAt === null && t.expiresAt.getTime() > Date.now())).toBe(true);
  });

  it('is idempotent: running it twice leaves the same users and sessions', async () => {
    const first = await seedDemo(prisma);
    const idsFirst = (await prisma.user.findMany({ where: { email: { endsWith: DEMO_EMAIL_DOMAIN } }, select: { id: true } }))
      .map((u) => u.id)
      .sort();

    const second = await seedDemo(prisma);
    const idsSecond = (await prisma.user.findMany({ where: { email: { endsWith: DEMO_EMAIL_DOMAIN } }, select: { id: true } }))
      .map((u) => u.id)
      .sort();

    expect(second).toEqual(first);
    expect(idsSecond).toEqual(idsFirst); // same rows, not recreated
    expect(await prisma.refreshToken.count({ where: { user: { email: { endsWith: DEMO_EMAIL_DOMAIN } } } })).toBe(expectedSessions);
  });

  it('shows up in the admin list with the right session counts', async () => {
    await seedDemo(prisma);
    const list = await app.get(AdminService).listUsers({ search: DEMO_EMAIL_DOMAIN, page: 1, pageSize: 100 });
    expect(list.total).toBe(18);
    expect(list.items.reduce((n, u) => n + u.activeSessionCount, 0)).toBe(expectedSessions);
    expect(list.items.find((u) => u.name === 'Kari Nordmann')?.activeSessionCount).toBe(3);
  });

  it('remove deletes only @demo.coride.no users and never touches anyone else', async () => {
    // Bystanders: a normal user with a session, and look-alike emails that must NOT match.
    const normal = await createUser(prisma, PREFIX, 'bystander');
    await prisma.refreshToken.create({
      data: {
        userId: (await prisma.user.findUniqueOrThrow({ where: { email: normal.email } })).id,
        familyId: 'bystander-family',
        tokenHash: createHash('sha256').update('bystander').digest('hex'),
        expiresAt: new Date(Date.now() + 3600_000),
      },
    });
    const lookalikes = [
      `${PREFIX}x@demo.coride.no.evil.test`,
      `${PREFIX}demo.coride.no@example.test`,
      `${PREFIX}x@notdemo.coride.no`,
    ];
    for (const email of lookalikes) await prisma.user.create({ data: { email, name: 'Lookalike' } });

    await removeDemo(prisma); // earlier tests left the demo users in place; take the baseline without them
    const totalBefore = await prisma.user.count();
    await seedDemo(prisma);
    expect(await prisma.user.count()).toBe(totalBefore + 18);

    const { removed } = await removeDemo(prisma);
    expect(removed).toBe(18);

    expect(await countDemo(prisma)).toEqual({ users: 0, admins: 0, activeSessions: 0 });
    expect(await prisma.user.count()).toBe(totalBefore); // everyone else is still there
    expect(await prisma.user.count({ where: { email: { in: [normal.email, ...lookalikes] } } })).toBe(1 + lookalikes.length);
    expect(await prisma.refreshToken.count({ where: { familyId: 'bystander-family' } })).toBe(1);
    expect(await prisma.refreshToken.count({ where: { user: { email: { endsWith: DEMO_EMAIL_DOMAIN } } } })).toBe(0);

    // Removing again is a harmless no-op.
    expect((await removeDemo(prisma)).removed).toBe(0);
  });
});
