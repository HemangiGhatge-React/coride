// Seeds (or removes) demo users for the admin dashboard.
//   npm run seed:demo           create / refresh the demo users and their sessions (idempotent)
//   npm run seed:demo:remove    delete only users whose email ends in @demo.coride.no
// Runs against DATABASE_URL (from the environment / .env), so check which database that is.
// Prints counts and the target hostname only: no emails, tokens or credentials.
import 'dotenv/config';
import { PrismaClient } from '@prisma/client';
import { PrismaPg } from '@prisma/adapter-pg';
import { DEMO_EMAIL_DOMAIN, countDemo, removeDemo, seedDemo } from './demo-users';

async function main() {
  const command = process.argv[2] ?? 'seed';
  if (command !== 'seed' && command !== 'remove') {
    console.error('Usage: seed-demo.ts [seed|remove]');
    process.exit(2);
  }
  const connectionString = process.env.DATABASE_URL;
  if (!connectionString) {
    console.error('DATABASE_URL is not set');
    process.exit(2);
  }

  console.log(`Target database host: ${new URL(connectionString).hostname}`);
  const prisma = new PrismaClient({ adapter: new PrismaPg({ connectionString }) });
  try {
    if (command === 'seed') {
      const c = await seedDemo(prisma);
      console.log(`Demo users (${DEMO_EMAIL_DOMAIN}): ${c.users}, of which admins: ${c.admins}`);
      console.log(`Active sessions: ${c.activeSessions}`);
    } else {
      const before = await countDemo(prisma);
      const { removed } = await removeDemo(prisma);
      console.log(`Removed demo users (${DEMO_EMAIL_DOMAIN}): ${removed} (had ${before.activeSessions} active sessions)`);
    }
  } finally {
    await prisma.$disconnect();
  }
}

main().catch((err) => {
  // A demo user with rides/vehicles/bookings would block the delete; report without details.
  console.error('Failed:', err instanceof Error ? err.message.split('\n').slice(-1)[0] : 'unknown error');
  process.exit(1);
});
