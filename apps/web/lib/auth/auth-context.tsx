"use client";

import { useQueryClient } from "@tanstack/react-query";
import { createContext, useCallback, useContext, useEffect, useMemo, useState, type ReactNode } from "react";
import { api, login as apiLogin, logout as apiLogout, type ApiClient, type User } from "@/lib/api";
import { DEFAULT_RETRY_DELAYS_MS, restoreSession } from "./restore";

export type AuthStatus = "loading" | "authenticated" | "anonymous";

export interface AuthContextValue {
  status: AuthStatus;
  user: User | null;
  /** Rejects with an ApiError (e.g. 401 "Invalid credentials") so the form can show it. */
  login: (email: string, password: string) => Promise<void>;
  logout: () => Promise<void>;
}

type AuthState = Pick<AuthContextValue, "status" | "user">;

const LOADING: AuthState = { status: "loading", user: null };
const ANONYMOUS: AuthState = { status: "anonymous", user: null };

/** Exported so tests can render components with a fixed auth state. */
export const AuthContext = createContext<AuthContextValue | null>(null);

export function useAuth(): AuthContextValue {
  const value = useContext(AuthContext);
  if (!value) throw new Error("useAuth must be used inside <AuthProvider>");
  return value;
}

export function AuthProvider({
  children,
  client = api,
  retryDelaysMs = DEFAULT_RETRY_DELAYS_MS,
}: {
  children: ReactNode;
  client?: ApiClient;
  retryDelaysMs?: readonly number[];
}) {
  const queryClient = useQueryClient();
  const [state, setState] = useState<AuthState>(LOADING);

  useEffect(() => {
    let active = true;

    // The server rejected the session (401/403 from /auth/refresh): drop cached data, show logged out.
    const unsubscribe = client.subscribeAuthLost(() => {
      queryClient.clear();
      if (active) setState(ANONYMOUS);
    });

    restoreSession(client, retryDelaysMs).then((user) => {
      if (active) setState(user ? { status: "authenticated", user } : ANONYMOUS);
    });

    return () => {
      active = false;
      unsubscribe();
    };
  }, [client, queryClient, retryDelaysMs]);

  const login = useCallback(
    async (email: string, password: string) => {
      const user = await apiLogin(client, email, password);
      queryClient.clear();
      setState({ status: "authenticated", user });
    },
    [client, queryClient],
  );

  const logout = useCallback(async () => {
    try {
      await apiLogout(client);
    } catch {
      // If the server cannot be reached the cookie survives, so a reload may sign in again;
      // the in-memory session is dropped either way.
    }
    queryClient.clear();
    setState(ANONYMOUS);
  }, [client, queryClient]);

  const value = useMemo<AuthContextValue>(() => ({ ...state, login, logout }), [state, login, logout]);
  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}
