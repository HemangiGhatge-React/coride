import type { Request, Response } from 'express';

// The web client keeps the refresh token in an httpOnly cookie so scripts cannot read it.
// Mobile keeps using the token from the response body.
export const REFRESH_COOKIE_NAME = 'refresh_token';
const REFRESH_COOKIE_MAX_AGE_MS = 30 * 24 * 60 * 60 * 1000; // matches the refresh token TTL

// Scope the cookie to the auth routes. If the API is served behind a path prefix (for example a
// web proxy that exposes it as /api/auth/*), set REFRESH_COOKIE_PATH=/api/auth, otherwise the
// browser will not send the cookie.
function cookiePath(): string {
  return process.env.REFRESH_COOKIE_PATH || '/auth';
}

const cookieAttributes = () => ({
  httpOnly: true,
  secure: true,
  sameSite: 'lax' as const,
  path: cookiePath(),
});

export function setRefreshCookie(res: Response, token: string): void {
  res.cookie(REFRESH_COOKIE_NAME, token, { ...cookieAttributes(), maxAge: REFRESH_COOKIE_MAX_AGE_MS });
}

export function clearRefreshCookie(res: Response): void {
  res.clearCookie(REFRESH_COOKIE_NAME, cookieAttributes());
}

/** Reads the refresh token cookie from the raw Cookie header (no cookie-parser needed). */
export function readRefreshCookie(req: Request): string | undefined {
  const header = req.headers.cookie;
  if (!header) return undefined;
  for (const part of header.split(';')) {
    const eq = part.indexOf('=');
    if (eq === -1 || part.slice(0, eq).trim() !== REFRESH_COOKIE_NAME) continue;
    const raw = part.slice(eq + 1).trim();
    try {
      return decodeURIComponent(raw) || undefined;
    } catch {
      return undefined;
    }
  }
  return undefined;
}
