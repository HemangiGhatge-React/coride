// Loads apps/api/.env.test and refuses to run against anything that looks like the main database.
import { config, parse } from 'dotenv';
import { existsSync, readFileSync } from 'fs';
import { resolve } from 'path';

const testEnvPath = resolve(__dirname, '../.env.test');
if (!existsSync(testEnvPath)) {
  throw new Error('apps/api/.env.test is missing; concurrency tests need a dedicated test database');
}
config({ path: testEnvPath, override: true });

const hostOf = (url?: string) => (url ? new URL(url).hostname.replace('-pooler', '') : undefined);

const mainEnvPath = resolve(__dirname, '../.env');
const mainHost = existsSync(mainEnvPath) ? hostOf(parse(readFileSync(mainEnvPath))['DATABASE_URL']) : undefined;
const testHost = hostOf(process.env.DATABASE_URL);

if (!testHost) throw new Error('DATABASE_URL is not set in .env.test');
if (process.env.NODE_ENV === 'production') throw new Error('Refusing to run tests with NODE_ENV=production');
if (testHost === mainHost) throw new Error(`Refusing to run: .env.test points at the main database (${mainHost})`);

process.env.JWT_SECRET ??= 'test-only-jwt-secret';
