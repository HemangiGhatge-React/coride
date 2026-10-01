import { JwtService } from '@nestjs/jwt';
import { UnauthorizedException } from '@nestjs/common';
import { TokensService, hashToken } from './tokens.service';
import { PrismaService } from '../prisma/prisma.service';

jest.mock('../prisma/prisma.service', () => ({ PrismaService: class {} }));

interface Row {
  id: string;
  userId: string;
  familyId: string;
  tokenHash: string;
  expiresAt: Date;
  revokedAt: Date | null;
}

/** Minimal in-memory stand-in for the RefreshToken delegate. */
function fakePrisma() {
  const rows: Row[] = [];
  const user = { id: 'u1', email: 'a@b.no', role: 'DRIVER' };
  const matches = (r: Row, where: Partial<Row>) =>
    Object.entries(where).every(
      ([k, v]) => (r as unknown as Record<string, unknown>)[k] === v,
    );
  return {
    rows,
    refreshToken: {
      create: async ({ data }: { data: Omit<Row, 'id' | 'revokedAt'> }) => {
        const row = { ...data, id: `t${rows.length}`, revokedAt: null };
        rows.push(row);
        return row;
      },
      findUnique: async ({ where }: { where: { tokenHash: string } }) => {
        const row = rows.find((r) => r.tokenHash === where.tokenHash);
        return row ? { ...row, user } : null;
      },
      updateMany: async ({
        where,
        data,
      }: {
        where: Partial<Row>;
        data: Partial<Row>;
      }) => {
        const hit = rows.filter((r) => matches(r, where));
        hit.forEach((r) => Object.assign(r, data));
        return { count: hit.length };
      },
      count: async ({ where }: { where: Partial<Row> }) =>
        rows.filter((r) => matches(r, where)).length,
    },
  };
}

describe('TokensService', () => {
  let prisma: ReturnType<typeof fakePrisma>;
  let service: TokensService;
  const user = { id: 'u1', email: 'a@b.no', role: 'DRIVER' };

  beforeEach(() => {
    prisma = fakePrisma();
    service = new TokensService(
      prisma as unknown as PrismaService,
      new JwtService({ secret: 'test-secret' }),
    );
  });

  afterEach(() => jest.useRealTimers());

  it('issues an access token with the API audience and stores only a hash of the refresh token', async () => {
    const session = await service.issueSession(user);
    const decoded = new JwtService({ secret: 'test-secret' }).verify(
      session.access_token,
      {
        audience: 'coride:api',
      },
    );
    expect(decoded.sub).toBe('u1');
    expect(prisma.rows[0].tokenHash).toBe(hashToken(session.refresh_token));
    expect(prisma.rows[0].tokenHash).not.toBe(session.refresh_token);
  });

  it('rotates: old token is revoked, new token works', async () => {
    const first = await service.issueSession(user);
    const second = await service.rotate(first.refresh_token);
    expect(second.refresh_token).not.toBe(first.refresh_token);
    await expect(service.rotate(second.refresh_token)).resolves.toBeDefined();
  });

  it('rejects unknown and expired tokens', async () => {
    await expect(service.rotate('nope')).rejects.toThrow(UnauthorizedException);
    const s = await service.issueSession(user);
    prisma.rows[0].expiresAt = new Date(Date.now() - 1);
    await expect(service.rotate(s.refresh_token)).rejects.toThrow(
      'INVALID_REFRESH_TOKEN',
    );
  });

  it('tolerates a retry within the grace window (lost response) but leaves one live token', async () => {
    const first = await service.issueSession(user);
    await service.rotate(first.refresh_token); // response "lost"
    const retried = await service.rotate(first.refresh_token);
    expect(prisma.rows.filter((r) => r.revokedAt === null)).toHaveLength(1);
    await expect(service.rotate(retried.refresh_token)).resolves.toBeDefined();
  });

  it('revokes the whole family when a rotated token is reused after the grace window', async () => {
    jest.useFakeTimers({ now: new Date('2026-10-01T10:00:00Z') });
    const first = await service.issueSession(user);
    const second = await service.rotate(first.refresh_token);
    jest.setSystemTime(new Date('2026-10-01T10:05:00Z'));
    await expect(service.rotate(first.refresh_token)).rejects.toThrow(
      'REFRESH_TOKEN_REUSED',
    );
    // The legitimate holder's newer token is now dead too.
    await expect(service.rotate(second.refresh_token)).rejects.toThrow(
      UnauthorizedException,
    );
  });

  it('logout is final, even for a replay inside the grace window', async () => {
    const s = await service.issueSession(user);
    await service.revoke(s.refresh_token);
    await expect(service.rotate(s.refresh_token)).rejects.toThrow(
      'REFRESH_TOKEN_REUSED',
    );
  });
});
