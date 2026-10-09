// Promotes an existing user to ADMIN. Idempotent. Never creates users and never prints secrets.
// Usage (from apps/api): npm run user:promote -- someone@example.com
// Uses DATABASE_URL from the environment / .env, i.e. whichever database that points at.
import 'dotenv/config';
import { PrismaClient } from '@prisma/client';
import { PrismaPg } from '@prisma/adapter-pg';

async function main() {
  const email = process.argv[2]?.trim();
  if (!email) {
    console.error('Usage: npm run user:promote -- <email>');
    process.exit(2);
  }
  const connectionString = process.env.DATABASE_URL;
  if (!connectionString) {
    console.error('DATABASE_URL is not set');
    process.exit(2);
  }

  const prisma = new PrismaClient({ adapter: new PrismaPg({ connectionString }) });
  try {
    const user = await prisma.user.findUnique({ where: { email }, select: { id: true, role: true } });
    if (!user) {
      console.error(`No user with email ${email}`);
      process.exitCode = 1;
    } else if (user.role === 'ADMIN') {
      console.log(`${email} is already ADMIN`);
    } else {
      await prisma.user.update({ where: { id: user.id }, data: { role: 'ADMIN' } });
      console.log(`${email} promoted to ADMIN`);
    }
  } finally {
    await prisma.$disconnect();
  }
}

main().catch((err) => {
  console.error('Promotion failed:', err instanceof Error ? err.message : 'unknown error');
  process.exit(1);
});
