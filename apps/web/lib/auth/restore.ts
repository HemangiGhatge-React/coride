import { ApiError, getMe, type ApiClient, type User } from "@/lib/api";

export const DEFAULT_RETRY_DELAYS_MS = [1000, 2000];

const sleep = (ms: number) => new Promise((resolve) => setTimeout(resolve, ms));

// A proxy/gateway that is up but whose upstream is starting or unreachable (e.g. Render waking up).
const isTransient = (e: unknown) =>
  e instanceof ApiError && (e.isNetworkError || e.status === 502 || e.status === 503 || e.status === 504);

/**
 * Restores a session on page load: the httpOnly cookie is exchanged for an access token, then the
 * user is loaded. Resolves to the user, or null when there is no valid session.
 *
 * Network failures and gateway errors are retried (the client's connection notice is shown meanwhile);
 * a 401/403 from the refresh means there is no session and does not retry. The refresh goes through
 * client.refresh(), which is shared, so calling this twice (React StrictMode runs effects twice in
 * development) still sends a single request and cannot race the server-side token rotation.
 */
export async function restoreSession(
  client: ApiClient,
  retryDelaysMs: readonly number[] = DEFAULT_RETRY_DELAYS_MS,
): Promise<User | null> {
  for (let attempt = 0; ; attempt++) {
    try {
      await client.refresh();
      return await getMe(client);
    } catch (error) {
      if (isTransient(error) && attempt < retryDelaysMs.length) {
        await sleep(retryDelaysMs[attempt]);
        continue;
      }
      return null;
    }
  }
}
