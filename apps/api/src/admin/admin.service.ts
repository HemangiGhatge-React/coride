import { ConflictException, Injectable, NotFoundException } from '@nestjs/common';
import { Prisma, Role } from '@prisma/client';
import { PrismaService } from '../prisma/prisma.service';
import { apiError } from '../common/api-error';
import { ListUsersQueryDto } from './admin.dto';

// Explicit select: the password hash and Vipps subject must never reach an admin response.
const USER_SELECT = { id: true, email: true, name: true, role: true, createdAt: true } as const;

@Injectable()
export class AdminService {
  constructor(private prisma: PrismaService) {}

  async listUsers(query: ListUsersQueryDto) {
    const { search, role, page, pageSize } = query;
    const where: Prisma.UserWhereInput = {
      ...(role && { role }),
      ...(search && {
        OR: [
          { email: { contains: search, mode: 'insensitive' } },
          { name: { contains: search, mode: 'insensitive' } },
        ],
      }),
    };

    const [total, users] = await Promise.all([
      this.prisma.user.count({ where }),
      this.prisma.user.findMany({
        where,
        select: USER_SELECT,
        orderBy: [{ createdAt: 'desc' }, { id: 'asc' }],
        skip: (page - 1) * pageSize,
        take: pageSize,
      }),
    ]);

    const sessionsByUser = await this.activeSessionCounts(users.map((u) => u.id));

    return {
      items: users.map((u) => ({ ...u, activeSessionCount: sessionsByUser.get(u.id) ?? 0 })),
      total,
      page,
      pageSize,
    };
  }

  async getUser(id: string) {
    const user = await this.prisma.user.findUnique({ where: { id }, select: USER_SELECT });
    if (!user) throw apiError(NotFoundException, 'USER_NOT_FOUND', 'User not found');
    const sessionsByUser = await this.activeSessionCounts([id]);
    return { ...user, activeSessionCount: sessionsByUser.get(id) ?? 0 };
  }

  /** A session is a token family with a live (unrevoked, unexpired) token. */
  private async activeSessionCounts(userIds: string[]) {
    const live = await this.prisma.refreshToken.groupBy({
      by: ['userId', 'familyId'],
      where: { userId: { in: userIds }, revokedAt: null, expiresAt: { gt: new Date() } },
    });
    const counts = new Map<string, number>();
    for (const row of live) counts.set(row.userId, (counts.get(row.userId) ?? 0) + 1);
    return counts;
  }

  async updateRole(actorId: string, targetId: string, role: Role) {
    if (actorId === targetId) {
      throw apiError(ConflictException, 'CANNOT_CHANGE_OWN_ROLE', 'You cannot change your own role');
    }

    return this.prisma.$transaction(async (tx) => {
      // Lock every admin row (fixed order, so concurrent changes cannot deadlock) so that two
      // admins demoting each other at the same time cannot both pass the check below. Under
      // READ COMMITTED the second transaction re-reads the committed roles after the lock.
      const admins = await tx.$queryRaw<{ id: string }[]>`SELECT id FROM "User" WHERE role = 'ADMIN' ORDER BY id FOR UPDATE`;
      const target = await tx.user.findUnique({ where: { id: targetId }, select: USER_SELECT });
      if (!target) throw apiError(NotFoundException, 'USER_NOT_FOUND', 'User not found');
      if (target.role === role) return target;

      if (target.role === 'ADMIN' && role !== 'ADMIN' && admins.length <= 1) {
        throw apiError(ConflictException, 'LAST_ADMIN', 'This would leave the system without an administrator');
      }
      return tx.user.update({ where: { id: targetId }, data: { role }, select: USER_SELECT });
    });
  }

  async listSessions(userId: string) {
    await this.requireUser(userId);

    const liveTokens = await this.prisma.refreshToken.findMany({
      where: { userId, revokedAt: null, expiresAt: { gt: new Date() } },
      select: { familyId: true, lastUsedAt: true, userAgent: true, createdAt: true },
      orderBy: { createdAt: 'desc' },
    });
    // Newest live token per family (there should only be one).
    const byFamily = new Map<string, (typeof liveTokens)[number]>();
    for (const t of liveTokens) if (!byFamily.has(t.familyId)) byFamily.set(t.familyId, t);

    // The session started when its first token was created, which is not the live token.
    const started = await this.prisma.refreshToken.groupBy({
      by: ['familyId'],
      where: { familyId: { in: [...byFamily.keys()] } },
      _min: { createdAt: true },
    });
    const startedAt = new Map(started.map((r) => [r.familyId, r._min.createdAt]));

    return [...byFamily.values()]
      .map((t) => ({
        familyId: t.familyId,
        createdAt: startedAt.get(t.familyId) ?? t.createdAt,
        lastUsedAt: t.lastUsedAt,
        userAgent: t.userAgent,
      }))
      .sort((a, b) => (b.lastUsedAt ?? b.createdAt).getTime() - (a.lastUsedAt ?? a.createdAt).getTime());
  }

  async revokeSession(familyId: string) {
    const exists = await this.prisma.refreshToken.findFirst({ where: { familyId }, select: { id: true } });
    if (!exists) throw apiError(NotFoundException, 'SESSION_NOT_FOUND', 'Session not found');
    await this.prisma.refreshToken.updateMany({
      where: { familyId, revokedAt: null },
      data: { revokedAt: new Date() },
    });
  }

  async revokeAllSessions(userId: string) {
    await this.requireUser(userId);
    await this.prisma.refreshToken.updateMany({
      where: { userId, revokedAt: null },
      data: { revokedAt: new Date() },
    });
  }

  private async requireUser(id: string) {
    const user = await this.prisma.user.findUnique({ where: { id }, select: { id: true } });
    if (!user) throw apiError(NotFoundException, 'USER_NOT_FOUND', 'User not found');
  }
}
