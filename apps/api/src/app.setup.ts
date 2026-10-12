import { INestApplication, ValidationPipe } from '@nestjs/common';
import type { NextFunction, Request, Response } from 'express';

/** Parses CORS_ORIGINS (comma-separated) into a list of exact origins. */
export function parseCorsOrigins(value: string | undefined): string[] {
  return (value ?? '')
    .split(',')
    .map((o) => o.trim().replace(/\/+$/, ''))
    .filter(Boolean);
}

// Responses under these prefixes carry tokens, sessions or personal data and must never be stored
// by the browser or an intermediary (the browser would otherwise revalidate them and get 304s).
const NO_STORE_PREFIXES = ['/auth', '/admin'];

export function noStoreForSensitiveRoutes(req: Request, res: Response, next: NextFunction): void {
  if (NO_STORE_PREFIXES.some((prefix) => req.path === prefix || req.path.startsWith(`${prefix}/`))) {
    res.setHeader('Cache-Control', 'no-store');
  }
  next();
}

/** Configuration shared by main.ts and the e2e tests. */
export function configureApp(app: INestApplication): void {
  // Browsers may only call the API from the origins in CORS_ORIGINS. With none configured no
  // CORS headers are sent, so cross-origin browser requests are refused. Mobile is unaffected.
  // credentials: true lets the browser send the refresh cookie.
  app.enableCors({
    origin: parseCorsOrigins(process.env.CORS_ORIGINS),
    credentials: true,
  });

  app.use(noStoreForSensitiveRoutes);

  app.useGlobalPipes(new ValidationPipe({ whitelist: true, forbidNonWhitelisted: true }));
}
