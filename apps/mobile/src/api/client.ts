import { API_URL } from '../config';
import {
  clearSession,
  getAccessToken,
  getRefreshToken,
  saveSession,
  type StoredSession,
} from '../utils/authStorage';

/** The server rejected the session and it could not be refreshed. The user must log in again. */
export class SessionExpiredError extends Error {
  constructor() {
    super('Session expired');
  }
}

/** The request never got a response (offline, DNS, timeout). Session is left untouched. */
export class NetworkError extends Error {
  constructor() {
    super('Network request failed');
  }
}

export class ApiError extends Error {
  constructor(
    public status: number,
    message: string,
  ) {
    super(message);
  }
}

const REQUEST_TIMEOUT_MS = 15_000;

let sessionExpiredHandler: (() => void) | null = null;

/** AuthProvider registers here so any request that hits a dead session can route to login. */
export function setSessionExpiredHandler(handler: (() => void) | null) {
  sessionExpiredHandler = handler;
}

async function expireSession(): Promise<never> {
  await clearSession();
  sessionExpiredHandler?.();
  throw new SessionExpiredError();
}

async function send(path: string, init: RequestInit, token: string | null): Promise<Response> {
  const headers = new Headers(init.headers);
  if (init.body && !headers.has('Content-Type')) headers.set('Content-Type', 'application/json');
  if (token) headers.set('Authorization', `Bearer ${token}`);
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), REQUEST_TIMEOUT_MS);
  try {
    return await fetch(`${API_URL}${path}`, { ...init, headers, signal: controller.signal });
  } catch {
    throw new NetworkError();
  } finally {
    clearTimeout(timer);
  }
}

async function toApiError(res: Response): Promise<ApiError> {
  const body = await res.json().catch(() => null);
  const message = typeof body?.message === 'string' ? body.message : `Request failed (${res.status})`;
  return new ApiError(res.status, message);
}

// Single in-flight refresh. Refresh tokens rotate on every use, so two parallel
// refreshes with the same token would look like token reuse to the backend.
let refreshInFlight: Promise<string> | null = null;

function refreshAccessToken(): Promise<string> {
  refreshInFlight ??= doRefresh().finally(() => {
    refreshInFlight = null;
  });
  return refreshInFlight;
}

async function doRefresh(): Promise<string> {
  const refreshToken = await getRefreshToken();
  if (!refreshToken) return expireSession();

  const res = await send('/auth/refresh', {
    method: 'POST',
    body: JSON.stringify({ refresh_token: refreshToken }),
  }, null);
  if (res.status === 401) return expireSession();
  if (!res.ok) throw await toApiError(res);

  const session = (await res.json()) as StoredSession;
  await saveSession(session);
  return session.access_token;
}

/**
 * Authenticated JSON request. On 401 it refreshes once and retries; if the
 * retry is still 401 the session is cleared and the expired handler fires.
 * Network failures throw NetworkError and never log the user out.
 */
export async function apiFetch<T>(path: string, init: RequestInit = {}): Promise<T> {
  const token = await getAccessToken();
  let res = await send(path, init, token);

  if (res.status === 401) {
    // Another request may have refreshed while this one was in flight.
    const current = await getAccessToken();
    const retryToken = current && current !== token ? current : await refreshAccessToken();
    res = await send(path, init, retryToken);
    if (res.status === 401) return expireSession();
  }

  if (!res.ok) throw await toApiError(res);
  if (res.status === 204) return undefined as T;
  return (await res.json()) as T;
}

/** Unauthenticated JSON request (login exchange, logout). */
export async function publicFetch<T>(path: string, init: RequestInit = {}): Promise<T> {
  const res = await send(path, init, null);
  if (!res.ok) throw await toApiError(res);
  if (res.status === 204) return undefined as T;
  return (await res.json()) as T;
}
