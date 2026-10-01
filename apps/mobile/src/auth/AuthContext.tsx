import { createContext, useCallback, useContext, useEffect, useMemo, useState, type ReactNode } from 'react';
import { apiFetch, publicFetch, setSessionExpiredHandler, NetworkError, SessionExpiredError } from '../api/client';
import { clearSession, getRefreshToken, saveSession } from '../utils/authStorage';
import { loginWithVipps, type AuthUser, type VippsLoginResult } from './vippsLogin';

export type AuthState =
  | { status: 'loading' }
  // reason drives the login screen: show a banner on 'expired', skip onboarding unless 'fresh'.
  | { status: 'signedOut'; reason: 'fresh' | 'expired' | 'loggedOut' }
  // user is null when we have a stored session but couldn't reach the backend on launch.
  | { status: 'signedIn'; user: AuthUser | null };

interface AuthContextValue {
  state: AuthState;
  signInWithVipps: () => Promise<VippsLoginResult>;
  signOut: () => Promise<void>;
  /** Re-fetch the current user, e.g. after launching offline. */
  reloadUser: () => Promise<void>;
}

const AuthContext = createContext<AuthContextValue | null>(null);

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

  const signInWithVipps = useCallback(async () => {
    const result = await loginWithVipps();
    if (result.type === 'success') {
      const { user, ...tokens } = result.session;
      await saveSession(tokens);
      setState({ status: 'signedIn', user });
    }
    return result;
  }, []);

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
    () => ({ state, signInWithVipps, signOut, reloadUser }),
    [state, signInWithVipps, signOut, reloadUser],
  );
  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export function useAuth(): AuthContextValue {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error('useAuth must be used inside AuthProvider');
  return ctx;
}
