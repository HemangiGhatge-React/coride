import { QueryClient } from "@tanstack/react-query";
import { ApiError } from "@/lib/api";

/**
 * Retry policy for queries: keep retrying while the server is unreachable (the connection notice is
 * showing), retry server errors a couple of times, never retry 4xx (they will not change).
 */
export function shouldRetry(failureCount: number, error: unknown): boolean {
  if (!(error instanceof ApiError)) return false;
  if (error.isNetworkError) return failureCount < 5;
  if (error.status >= 500) return failureCount < 2;
  return false;
}

export function makeQueryClient() {
  return new QueryClient({
    defaultOptions: {
      queries: { retry: shouldRetry, refetchOnWindowFocus: false },
    },
  });
}
