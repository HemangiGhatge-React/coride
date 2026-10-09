import { INestApplication, ValidationPipe } from '@nestjs/common';

/** Parses CORS_ORIGINS (comma-separated) into a list of exact origins. */
export function parseCorsOrigins(value: string | undefined): string[] {
  return (value ?? '')
    .split(',')
    .map((o) => o.trim().replace(/\/+$/, ''))
    .filter(Boolean);
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

  app.useGlobalPipes(new ValidationPipe({ whitelist: true, forbidNonWhitelisted: true }));
}
