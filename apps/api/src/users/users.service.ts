import { Injectable, ConflictException } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';

export interface VippsIdentity {
  sub: string;
  email: string;
  emailVerified: boolean;
  name: string;
}

@Injectable()
export class UsersService {
  constructor(private prisma: PrismaService) {}

  async findByEmail(email: string) {
    return this.prisma.user.findUnique({ where: { email } });
  }

  async findById(id: string) {
    return this.prisma.user.findUnique({ where: { id } });
  }

  async create(data: { email: string; password: string; name: string }) {
    const existing = await this.findByEmail(data.email);
    if (existing) {
      throw new ConflictException('Email already registered');
    }
    return this.prisma.user.create({
      data: {
        email: data.email,
        password: data.password, // already hashed by caller — see auth.service.ts
        name: data.name,
        role: 'DRIVER', // hardcoded — no self-service ADMIN, no RIDER role (decided Jul 22)
      },
    });
  }

  /**
   * Resolve a Vipps identity to a local user:
   * 1. Known vippsSub → that user.
   * 2. Existing account with the same email → link it, but only if Vipps says the
   *    email is verified (otherwise anyone could claim an account by email).
   * 3. Otherwise create a new passwordless DRIVER account.
   */
  async findOrCreateFromVipps(identity: VippsIdentity) {
    const bySub = await this.prisma.user.findUnique({
      where: { vippsSub: identity.sub },
    });
    if (bySub) return bySub;

    const byEmail = await this.findByEmail(identity.email);
    if (byEmail) {
      if (!identity.emailVerified || byEmail.vippsSub) {
        throw new ConflictException('EMAIL_ALREADY_REGISTERED');
      }
      return this.prisma.user.update({
        where: { id: byEmail.id },
        data: { vippsSub: identity.sub },
      });
    }

    return this.prisma.user.create({
      data: {
        email: identity.email,
        vippsSub: identity.sub,
        name: identity.name,
        role: 'DRIVER',
      },
    });
  }
}
