// Shared helpers for the real-database e2e suites. Everything runs against apps/api/.env.test
// (load-test-env.ts refuses to run against the main database) and only touches rows whose
// email starts with the suite's own prefix, which are deleted afterwards.
import { INestApplication } from '@nestjs/common';
import { Test } from '@nestjs/testing';
import { Role } from '@prisma/client';
import * as bcrypt from 'bcrypt';
import request from 'supertest';
import { AppModule } from '../src/app.module';
import { configureApp } from '../src/app.setup';
import { PrismaService } from '../src/prisma/prisma.service';

export const PASSWORD = 'Test-password-1';

export async function createApp(): Promise<INestApplication> {
  const moduleRef = await Test.createTestingModule({ imports: [AppModule] }).compile();
  const app = moduleRef.createNestApplication();
  configureApp(app); // same CORS and validation setup as main.ts
  await app.init();
  return app;
}

export async function purge(prisma: PrismaService, prefix: string) {
  // Refresh tokens go with their user (onDelete: Cascade).
  await prisma.user.deleteMany({ where: { email: { startsWith: prefix } } });
}

let counter = 0;
export async function createUser(prisma: PrismaService, prefix: string, label: string, role: Role = Role.DRIVER) {
  const email = `${prefix}${Date.now()}-${counter++}-${label}@example.test`;
  const user = await prisma.user.create({
    data: { email, name: label, role, password: await bcrypt.hash(PASSWORD, 4) },
  });
  return { id: user.id, email };
}

export async function login(app: INestApplication, email: string, userAgent?: string) {
  const req = request(app.getHttpServer()).post('/auth/login');
  if (userAgent) req.set('User-Agent', userAgent);
  const res = await req.send({ email, password: PASSWORD });
  if (res.status !== 200) throw new Error(`login failed for ${email}: ${res.status}`);
  return { res, accessToken: res.body.access_token as string, refreshToken: res.body.refresh_token as string };
}

export const bearer = (token: string) => ({ Authorization: `Bearer ${token}` });
