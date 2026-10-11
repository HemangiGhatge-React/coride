import type { z } from "zod";
import { ApiError, INVALID_RESPONSE, NETWORK_ERROR, apiErrorFromResponse } from "./errors";
import { refreshResponseSchema } from "./schemas";

type FetchFn = (input: string, init?: RequestInit) => Promise<Response>;

export interface ApiClientOptions {
  /** Injected in tests. Defaults to the global fetch. */
  fetch?: FetchFn;
  /** Same-origin prefix that Next proxies to the API. */
  baseUrl?: string;
}

export interface RequestOptions<S extends z.ZodType | undefined = undefined> {
  method?: "GET" | "POST" | "PATCH" | "DELETE";
  body?: unknown;
  query?: Record<string, string | number | undefined>;
  /** Validates the JSON response. Omit for 204 responses. */
  schema?: S;
  /** Do not try a token refresh on 401 (login, refresh and logout themselves). */
  skipAuthRefresh?: boolean;
}

type Result<S extends z.ZodType | undefined> = S extends z.ZodType ? z.output<S> : undefined;

/**
 * Typed fetch wrapper for the CoRide API.
 *
 * - The access token lives in this closure only (memory), never in web storage.
 * - The refresh token is an httpOnly cookie the browser sends to /api/auth/*; this code never sees it.
 * - On 401 it refreshes once and retries the request once. All concurrent 401s share ONE refresh
 *   (and so does session restore on page load), because refresh tokens rotate: two parallel
 *   refreshes with the same cookie would race and could leave a revoked token in the cookie.
 * - Only a 401/403 from the refresh endpoint means "logged out". Network errors and 5xx do not.
 */
export function createApiClient(options: ApiClientOptions = {}) {
  const baseUrl = (options.baseUrl ?? "/api").replace(/\/+$/, "");
  const doFetch: FetchFn = options.fetch ?? ((input, init) => globalThis.fetch(input, init));

  let accessToken: string | null = null;
  let refreshInFlight: Promise<string> | null = null;
  let connectionProblem = false;

  const authLostListeners = new Set<() => void>();
  const connectionListeners = new Set<() => void>();

  function setConnectionProblem(value: boolean) {
    if (connectionProblem === value) return;
    connectionProblem = value;
    connectionListeners.forEach((l) => l());
  }

  function buildUrl(path: string, query?: RequestOptions["query"]) {
    const url = `${baseUrl}${path}`;
    if (!query) return url;
    const params = new URLSearchParams();
    for (const [key, value] of Object.entries(query)) {
      if (value !== undefined && value !== "") params.set(key, String(value));
    }
    const qs = params.toString();
    return qs ? `${url}?${qs}` : url;
  }

  async function send(path: string, opts: RequestOptions<z.ZodType | undefined>, token: string | null) {
    const headers: Record<string, string> = {
      Accept: "application/json",
      // Tells the API to keep the refresh token out of JSON bodies (cookie only).
      "X-Client": "web",
    };
    if (token) headers.Authorization = `Bearer ${token}`;
    if (opts.body !== undefined) headers["Content-Type"] = "application/json";

    let res: Response;
    try {
      res = await doFetch(buildUrl(path, opts.query), {
        method: opts.method ?? "GET",
        headers,
        body: opts.body !== undefined ? JSON.stringify(opts.body) : undefined,
        credentials: "include",
      });
    } catch {
      setConnectionProblem(true);
      throw new ApiError(0, NETWORK_ERROR, "Cannot reach the server");
    }
    setConnectionProblem(false);
    return res;
  }

  async function performRefresh(): Promise<string> {
    const res = await send("/auth/refresh", { method: "POST" }, null);

    if (res.status === 401 || res.status === 403) {
      accessToken = null;
      const error = await apiErrorFromResponse(res);
      authLostListeners.forEach((l) => l());
      throw error;
    }
    if (!res.ok) throw await apiErrorFromResponse(res);

    const parsed = refreshResponseSchema.safeParse(await res.json().catch(() => undefined));
    if (!parsed.success) throw new ApiError(res.status, INVALID_RESPONSE, "Unexpected response from the server");
    accessToken = parsed.data.access_token;
    return accessToken;
  }

  /** Exchanges the refresh cookie for a new access token. Concurrent callers share one request. */
  function refresh(): Promise<string> {
    refreshInFlight ??= performRefresh().finally(() => {
      refreshInFlight = null;
    });
    return refreshInFlight;
  }

  async function request<S extends z.ZodType | undefined = undefined>(
    path: string,
    opts: RequestOptions<S> = {},
  ): Promise<Result<S>> {
    const tokenUsed = accessToken;
    let res = await send(path, opts, tokenUsed);

    if (res.status === 401 && !opts.skipAuthRefresh) {
      // If another request already refreshed while this one was in flight, just use that token.
      const token = accessToken && accessToken !== tokenUsed ? accessToken : await refresh();
      res = await send(path, opts, token);
    }

    if (!res.ok) throw await apiErrorFromResponse(res);
    if (!opts.schema) return undefined as Result<S>;

    const parsed = opts.schema.safeParse(await res.json().catch(() => undefined));
    if (!parsed.success) throw new ApiError(res.status, INVALID_RESPONSE, "Unexpected response from the server");
    return parsed.data as Result<S>;
  }

  return {
    request,
    refresh,
    getAccessToken: () => accessToken,
    setAccessToken: (token: string | null) => {
      accessToken = token;
    },
    /** Called when the server definitively rejects the session (401/403 from /auth/refresh). */
    subscribeAuthLost(listener: () => void) {
      authLostListeners.add(listener);
      return () => void authLostListeners.delete(listener);
    },
    /** For useSyncExternalStore: true while the last request failed to reach the server. */
    subscribeConnection(listener: () => void) {
      connectionListeners.add(listener);
      return () => void connectionListeners.delete(listener);
    },
    getConnectionProblem: () => connectionProblem,
  };
}

export type ApiClient = ReturnType<typeof createApiClient>;
