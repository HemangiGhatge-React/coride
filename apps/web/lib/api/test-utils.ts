import { vi } from "vitest";

export const json = (body: unknown, status = 200) =>
  new Response(JSON.stringify(body), { status, headers: { "Content-Type": "application/json" } });

/** A fetch fake that records calls (with the bearer token it was sent) and answers with `handler`. */
export function fakeFetch(
  handler: (url: string, init: RequestInit, token: string | null) => Response | Promise<Response>,
) {
  const calls: { url: string; init: RequestInit; token: string | null }[] = [];
  const fn = vi.fn(async (url: string, init: RequestInit = {}) => {
    const auth = new Headers(init.headers).get("Authorization");
    const token = auth ? auth.replace("Bearer ", "") : null;
    calls.push({ url, init, token });
    return handler(url, init, token);
  });
  return { fn, calls, count: (path: string) => calls.filter((c) => c.url === path).length };
}
