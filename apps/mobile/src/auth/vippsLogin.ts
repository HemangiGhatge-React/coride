import * as Crypto from 'expo-crypto';
import * as Linking from 'expo-linking';
import * as WebBrowser from 'expo-web-browser';
import { API_URL } from '../config';
import { ApiError, NetworkError, publicFetch } from '../api/client';
import type { LoginSession } from './types';

// DORMANT: Vipps Login is designed and implemented (backend: src/auth/vipps/)
// but not wired into the app, because Vipps Login requires a registered
// business (merchant agreement) to get credentials. The active login is
// email/password in AuthContext. To enable: call loginWithVipps() from a
// screen, save result.session via saveSession, and set the VIPPS_* env vars.

export type VippsLoginErrorCode =
  | 'vipps_error' // Vipps rejected the login or the backend couldn't verify it
  | 'email_conflict' // email belongs to an existing account that can't be auto-linked
  | 'expired' // flow took too long / state or login code invalid
  | 'network' // backend unreachable before or after the Vipps step
  | 'not_configured'; // backend has no Vipps credentials

export type VippsLoginResult =
  | { type: 'success'; session: LoginSession }
  | { type: 'cancelled' }
  | { type: 'error'; code: VippsLoginErrorCode };

// Error values the backend puts on the final redirect (see VippsAuthService).
const BACKEND_ERRORS: Record<string, VippsLoginResult> = {
  cancelled: { type: 'cancelled' },
  vipps_error: { type: 'error', code: 'vipps_error' },
  email_conflict: { type: 'error', code: 'email_conflict' },
  invalid_state: { type: 'error', code: 'expired' },
  not_configured: { type: 'error', code: 'not_configured' },
};

function toBase64Url(base64: string): string {
  return base64.replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');
}

async function createPkcePair() {
  const bytes = Crypto.getRandomBytes(32);
  const verifier = toBase64Url(btoa(String.fromCharCode(...bytes)));
  const digest = await Crypto.digestStringAsync(Crypto.CryptoDigestAlgorithm.SHA256, verifier, {
    encoding: Crypto.CryptoEncoding.BASE64,
  });
  return { verifier, challenge: toBase64Url(digest) };
}

function firstParam(value: string | string[] | undefined): string | undefined {
  return Array.isArray(value) ? value[0] : value;
}

/** True if the backend answers at all. Lets us report "offline" instead of a blank browser error page. */
async function backendReachable(): Promise<boolean> {
  try {
    await publicFetch<unknown>('/');
    return true;
  } catch (err) {
    return !(err instanceof NetworkError);
  }
}

/**
 * Runs mobile → backend /start → Vipps → backend /callback → app deep link,
 * then redeems the one-time login code for a session. Never throws.
 */
export async function loginWithVipps(): Promise<VippsLoginResult> {
  if (!(await backendReachable())) return { type: 'error', code: 'network' };

  const { verifier, challenge } = await createPkcePair();
  const appRedirect = Linking.createURL('auth/vipps');
  const startUrl =
    `${API_URL}/auth/vipps/start?` +
    new URLSearchParams({ app_redirect: appRedirect, code_challenge: challenge }).toString();

  let result: WebBrowser.WebBrowserAuthSessionResult;
  try {
    result = await WebBrowser.openAuthSessionAsync(startUrl, appRedirect);
  } catch {
    return { type: 'error', code: 'vipps_error' };
  }
  // 'cancel' / 'dismiss': the user closed the browser sheet.
  if (result.type !== 'success') return { type: 'cancelled' };

  const { queryParams } = Linking.parse(result.url);
  const error = firstParam(queryParams?.error as string | string[] | undefined);
  if (error) return BACKEND_ERRORS[error] ?? { type: 'error', code: 'vipps_error' };

  const code = firstParam(queryParams?.code as string | string[] | undefined);
  if (!code) return { type: 'error', code: 'vipps_error' };

  try {
    const session = await publicFetch<LoginSession>('/auth/vipps/exchange', {
      method: 'POST',
      body: JSON.stringify({ code, code_verifier: verifier }),
    });
    return { type: 'success', session };
  } catch (err) {
    if (err instanceof NetworkError) return { type: 'error', code: 'network' };
    if (err instanceof ApiError && err.status === 401) return { type: 'error', code: 'expired' };
    return { type: 'error', code: 'vipps_error' };
  }
}
