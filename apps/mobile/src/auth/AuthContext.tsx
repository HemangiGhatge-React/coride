import { createContext, useCallback, useContext, useEffect, useMemo, useState, type ReactNode } from 'react';
import {
  apiFetch,
  publicFetch,
  setSessionExpiredHandler,
  ApiError,
  NetworkError,
  SessionExpiredError,
} from '../api/client';
import { clearSession, getRefreshToken, saveSession } from '../utils/authStorage';
import type { AuthUser, LoginSession } from './types';

export type AuthState =
  | { status: 'loading' }
  // reason drives the login screen: show a banner on 'expired', skip onboarding unless 'fresh'.
  | { status: 'signedOut'; reason: 'fresh' | 'expired' | 'loggedOut' }
  // user is null when we have a stored session but couldn't reach the backend on launch.
  | { status: 'signedIn'; user: AuthUser | null };

/** Outcome of a login/signup attempt; `message` is ready to show to the user. */
export type AuthResult = { ok: true } | { ok: false; message: string };

interface AuthContextValue {
  state: AuthState;
  signIn: (email: string, password: string) => Promise<AuthResult>;
  signUp: (name: string, email: string, password: string) => Promise<AuthResult>;
  signOut: () => Promise<void>;
  /** Re-fetch the current user, e.g. after launching offline. */
  reloadUser: () => Promise<void>;
}

const AuthContext = createContext<AuthContextValue | null>(null);

const NETWORK_MESSAGE = "Can't reach CoRide. Check your internet connection and try again.";
const UNKNOWN_MESSAGE = 'Something went wrong. Please try again.';

export function AuthProvider({ children }: { children: ReactNode }) {
  const [state, setState] = useState<AuthState>({ status: 'loading' });

  const reloadUser = useCallback(async () => {
    try {
      // Goes through 401 interception, so an expired access token is refreshed here.
      const user = await apiFetch<AuthUser>('/auth/me');
      setState({ status: 'signedIn', user });
    } catch (err) {
      if (err instanceof SessionExpiredError) return; // handler below already routed to login
      if (err instanceof NetworkError) {
        // Offline on launch: keep the stored session rather than logging the user out.
        setState((s) => (s.status === 'signedIn' ? s : { status: 'signedIn', user: null }));
        return;
      }
      throw err;
    }
  }, []);

  useEffect(() => {
    setSessionExpiredHandler(() => setState({ status: 'signedOut', reason: 'expired' }));
    return () => setSessionExpiredHandler(null);
  }, []);

  // Relaunch: validate any stored session against the backend.
  useEffect(() => {
    (async () => {
      const refreshToken = await getRefreshToken().catch(() => null);
      if (!refreshToken) {
        setState({ status: 'signedOut', reason: 'fresh' });
        return;
      }
      await reloadUser().catch(() => setState({ status: 'signedIn', user: null }));
    })();
  }, [reloadUser]);

  const signIn = useCallback(async (email: string, password: string): Promise<AuthResult> => {
    try {
      const { user, ...tokens } = await publicFetch<LoginSession>('/auth/login', {
        method: 'POST',
        body: JSON.stringify({ email, password }),
      });
      await saveSession(tokens);
      setState({ status: 'signedIn', user });
      return { ok: true };
    } catch (err) {
      if (err instanceof NetworkError) return { ok: false, message: NETWORK_MESSAGE };
      if (err instanceof ApiError && err.status === 401) {
        return { ok: false, message: 'Wrong email or password.' };
      }
      if (err instanceof ApiError && err.status === 400) return { ok: false, message: err.message };
      return { ok: false, message: UNKNOWN_MESSAGE };
    }
  }, []);

  const signUp = useCallback(
    async (name: string, email: string, password: string): Promise<AuthResult> => {
      try {
        // /auth/register creates the account but returns no tokens; log in right after.
        await publicFetch('/auth/register', {
          method: 'POST',
          body: JSON.stringify({ name, email, password }),
        });
      } catch (err) {
        if (err instanceof NetworkError) return { ok: false, message: NETWORK_MESSAGE };
        if (err instanceof ApiError && err.status === 409) {
          return { ok: false, message: 'An account with this email already exists. Log in instead.' };
        }
        if (err instanceof ApiError && err.status === 400) return { ok: false, message: err.message };
        return { ok: false, message: UNKNOWN_MESSAGE };
      }
      return signIn(email, password);
    },
    [signIn],
  );

  const signOut = useCallback(async () => {
    const refreshToken = await getRefreshToken();
    if (refreshToken) {
      // Best effort: if offline, the server-side token simply expires on its own.
      await publicFetch('/auth/logout', {
        method: 'POST',
        body: JSON.stringify({ refresh_token: refreshToken }),
      }).catch(() => undefined);
    }
    await clearSession();
    setState({ status: 'signedOut', reason: 'loggedOut' });
  }, []);

  const value = useMemo(
    () => ({ state, signIn, signUp, signOut, reloadUser }),
    [state, signIn, signUp, signOut, reloadUser],
  );
  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export function useAuth(): AuthContextValue {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error('useAuth must be used inside AuthProvider');
  return ctx;
}
