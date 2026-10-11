// Loads apps/api/.env.test and refuses to run against anything that looks like the main database.
//
// "Main" is identified by host, from apps/api/.env (DATABASE_URL) and/or MAIN_DB_HOST. If neither
// is available the guard cannot tell test from main, so it refuses to run rather than assume.
// Set MAIN_DB_HOST (a hostname, e.g. in CI where there is no .env) to supply main's host.
import { config, parse } from 'dotenv';
import { existsSync, readFileSync } from 'fs';
import { resolve } from 'path';

// Read before .env.test is loaded so the test file cannot override it.
const mainDbHostFromEnv = process.env.MAIN_DB_HOST;

const testEnvPath = resolve(__dirname, '../.env.test');
if (!existsSync(testEnvPath)) {
  throw new Error('apps/api/.env.test is missing; the e2e tests need a dedicated test database');
}
config({ path: testEnvPath, override: true });

// '-pooler' is Neon's pooled endpoint for the same instance.
const normalise = (host: string) => host.trim().toLowerCase().replace('-pooler', '');
const hostOf = (url?: string) => (url ? normalise(new URL(url).hostname) : undefined);

const mainHosts = new Set<string>();
if (mainDbHostFromEnv?.trim()) mainHosts.add(normalise(mainDbHostFromEnv));
const mainEnvPath = resolve(__dirname, '../.env');
if (existsSync(mainEnvPath)) {
  const fromFile = hostOf(parse(readFileSync(mainEnvPath))['DATABASE_URL']);
  if (fromFile) mainHosts.add(fromFile);
}
if (mainHosts.size === 0) {
  throw new Error(
    "Refusing to run: cannot tell which database is main. apps/api/.env is missing (or has no DATABASE_URL) and MAIN_DB_HOST is not set. Set MAIN_DB_HOST to main's database hostname.",
  );
}

if (process.env.NODE_ENV === 'production') throw new Error('Refusing to run tests with NODE_ENV=production');

const testHost = hostOf(process.env.DATABASE_URL);
if (!testHost) throw new Error('DATABASE_URL is not set in .env.test');

// DIRECT_URL is used for migrations and by the helper scripts, so it must not point at main either.
for (const [name, host] of [
  ['DATABASE_URL', testHost],
  ['DIRECT_URL', hostOf(process.env.DIRECT_URL)],
] as const) {
  if (host && mainHosts.has(host)) {
    throw new Error(`Refusing to run: ${name} in .env.test points at the main database (${host})`);
  }
}

process.env.JWT_SECRET ??= 'test-only-jwt-secret';
