import { Injectable, UnauthorizedException } from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import { createHash, randomBytes, randomUUID } from 'crypto';
import { PrismaService } from '../prisma/prisma.service';

export const ACCESS_TOKEN_TTL = '15m';
// Other short-lived JWTs (Vipps state, login codes) share JWT_SECRET; the
// audience keeps them from being accepted as access tokens.
export const ACCESS_TOKEN_AUDIENCE = 'coride:api';
const REFRESH_TOKEN_TTL_MS = 30 * 24 * 60 * 60 * 1000; // 30 days, sliding on each rotation
// A rotated token presented again within this window is treated as a lost
// response (client retried after a network failure), not as token theft.
const REUSE_GRACE_MS = 30 * 1000;

export interface SessionUser {
  id: string;
  email: string;
  role: string;
}

export interface SessionTokens {
  access_token: string;
  refresh_token: string;
}

export function hashToken(token: string): string {
  return createHash('sha256').update(token).digest('hex');
}

@Injectable()
export class TokensService {
  constructor(
    private prisma: PrismaService,
    private jwtService: JwtService,
  ) {}

  /** Start a new session (new refresh token family) for a freshly authenticated user. */
  async issueSession(user: SessionUser): Promise<SessionTokens> {
    return {
      access_token: this.signAccessToken(user),
      refresh_token: await this.createRefreshToken(user.id, randomUUID()),
    };
  }

  /**
   * Exchange a refresh token for a new access + refresh token pair.
   * The presented token is revoked (rotation). Presenting an already-rotated
   * token outside the grace window revokes the whole family.
   */
  async rotate(refreshToken: string): Promise<SessionTokens> {
    const now = new Date();
    const existing = await this.prisma.refreshToken.findUnique({
      where: { tokenHash: hashToken(refreshToken) },
      include: { user: true },
    });

    if (!existing || existing.expiresAt <= now) {
      throw new UnauthorizedException('INVALID_REFRESH_TOKEN');
    }

    if (existing.revokedAt) {
      // Only a rotated token has a live successor; after logout or a detected
      // reuse the family has none and the session must stay dead.
      const familyStillActive =
        (await this.prisma.refreshToken.count({
          where: { familyId: existing.familyId, revokedAt: null },
        })) > 0;
      const withinGrace =
        now.getTime() - existing.revokedAt.getTime() < REUSE_GRACE_MS;
      // Invalidate everything else in the family either way, so at most one
      // live token exists per session.
      await this.revokeFamily(existing.familyId);
      if (!familyStillActive || !withinGrace) {
        throw new UnauthorizedException('REFRESH_TOKEN_REUSED');
      }
    } else {
      // Conditional update so two concurrent rotations of the same token cannot both win.
      const claimed = await this.prisma.refreshToken.updateMany({
        where: { id: existing.id, revokedAt: null },
        data: { revokedAt: now },
      });
      if (claimed.count === 0) {
        throw new UnauthorizedException('INVALID_REFRESH_TOKEN');
      }
    }

    return {
      access_token: this.signAccessToken(existing.user),
      refresh_token: await this.createRefreshToken(
        existing.userId,
        existing.familyId,
      ),
    };
  }

  /** Logout: revoke the session the token belongs to. Unknown tokens are ignored. */
  async revoke(refreshToken: string): Promise<void> {
    const existing = await this.prisma.refreshToken.findUnique({
      where: { tokenHash: hashToken(refreshToken) },
    });
    if (existing) {
      await this.revokeFamily(existing.familyId);
    }
  }

  private signAccessToken(user: SessionUser): string {
    // Same payload shape JwtStrategy already validates.
    return this.jwtService.sign(
      { sub: user.id, email: user.email, role: user.role },
      { expiresIn: ACCESS_TOKEN_TTL, audience: ACCESS_TOKEN_AUDIENCE },
    );
  }

  private async createRefreshToken(
    userId: string,
    familyId: string,
  ): Promise<string> {
    const token = randomBytes(32).toString('base64url');
    await this.prisma.refreshToken.create({
      data: {
        userId,
        familyId,
        tokenHash: hashToken(token),
        expiresAt: new Date(Date.now() + REFRESH_TOKEN_TTL_MS),
      },
    });
    return token;
  }

  private async revokeFamily(familyId: string): Promise<void> {
    await this.prisma.refreshToken.updateMany({
      where: { familyId, revokedAt: null },
      data: { revokedAt: new Date() },
    });
  }
}
