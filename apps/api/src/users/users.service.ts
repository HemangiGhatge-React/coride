import { Injectable, ConflictException } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { Prisma } from '@prisma/client';

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
}