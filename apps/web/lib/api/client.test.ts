import { describe, expect, it, vi } from "vitest";
import { createApiClient } from "./client";
import { getMe, listAdminUsers, login } from "./endpoints";
import { ApiError, NETWORK_ERROR } from "./errors";
import { fakeFetch, json } from "./test-utils";

const user = { id: "u1", email: "a@example.test", name: "A", role: "ADMIN" };
const usersList = {
  items: [{ ...user, createdAt: "2026-10-01T00:00:00.000Z", activeSessionCount: 1 }],
  total: 1,
  page: 1,
  pageSize: 20,
};

describe("api client: refresh on 401", () => {
  it("3 parallel requests that get 401 trigger exactly one refresh, and all 3 are retried and succeed", async () => {
    let releaseRefresh!: () => void;
    const refreshGate = new Promise<void>((resolve) => (releaseRefresh = resolve));

    const f = fakeFetch(async (url, _init, token) => {
      if (url === "/api/auth/refresh") {
        await refreshGate; // keep the refresh in flight while the other 401s arrive
        return json({ access_token: "new" });
      }
      return token === "new" ? json(usersList) : json({ statusCode: 401, message: "Unauthorized" }, 401);
    });
    const client = createApiClient({ fetch: f.fn });
    client.setAccessToken("expired");

    const results = Promise.all([
      listAdminUsers(client),
      listAdminUsers(client, { page: 2 }),
      listAdminUsers(client, { search: "x" }),
    ]);
    // Let all three first attempts fail with 401 and join the shared refresh.
    await vi.waitFor(() => expect(f.calls.filter((c) => c.token === "expired")).toHaveLength(3));
    releaseRefresh();

    const [a, b, c] = await results;
    expect(a.total).toBe(1);
    expect(b.total).toBe(1);
    expect(c.total).toBe(1);

    expect(f.count("/api/auth/refresh")).toBe(1);
    const retries = f.calls.filter((c) => c.url.startsWith("/api/admin/users") && c.token === "new");
    expect(retries).toHaveLength(3);
    expect(client.getAccessToken()).toBe("new");
  });

  it("a request that fails after another request already refreshed reuses the new token (no second refresh)", async () => {
    let releaseSlow!: () => void;
    const slowGate = new Promise<void>((resolve) => (releaseSlow = resolve));
    let slowCalls = 0;

    const f = fakeFetch(async (url, _init, token) => {
      if (url === "/api/auth/refresh") return json({ access_token: "new" });
      if (url === "/api/slow" && token === "old") {
        slowCalls++;
        await slowGate; // 401 arrives only after the refresh has finished
        return json({ message: "Unauthorized" }, 401);
      }
      return token === "new" ? json({ ok: true }) : json({ message: "Unauthorized" }, 401);
    });
    const client = createApiClient({ fetch: f.fn });
    client.setAccessToken("old");

    const slow = client.request("/slow");
    await vi.waitFor(() => expect(slowCalls).toBe(1));
    await client.request("/fast"); // 401 -> refresh -> retry
    expect(f.count("/api/auth/refresh")).toBe(1);

    releaseSlow();
    await slow;
    expect(f.count("/api/auth/refresh")).toBe(1);
  });

  it("only retries once: a 401 after the refresh is surfaced as an ApiError", async () => {
    const f = fakeFetch((url) =>
      url === "/api/auth/refresh" ? json({ access_token: "new" }) : json({ statusCode: 401, message: "Unauthorized" }, 401),
    );
    const client = createApiClient({ fetch: f.fn });
    client.setAccessToken("old");

    await expect(getMe(client)).rejects.toMatchObject({ status: 401 });
    expect(f.count("/api/auth/me")).toBe(2);
    expect(f.count("/api/auth/refresh")).toBe(1);
  });
});

describe("api client: refresh failure", () => {
  it("a 401 from /auth/refresh clears the token, notifies subscribers once and rejects with the API code", async () => {
    const f = fakeFetch((url) =>
      url === "/api/auth/refresh"
        ? json({ statusCode: 401, message: "REFRESH_TOKEN_REUSED", error: "Unauthorized" }, 401)
        : json({ message: "Unauthorized" }, 401),
    );
    const client = createApiClient({ fetch: f.fn });
    client.setAccessToken("old");
    const lost = vi.fn();
    client.subscribeAuthLost(lost);

    await expect(Promise.all([getMe(client), getMe(client)])).rejects.toMatchObject({
      status: 401,
      code: "REFRESH_TOKEN_REUSED",
    });
    expect(lost).toHaveBeenCalledTimes(1); // one shared refresh, one notification
    expect(client.getAccessToken()).toBeNull();
  });

  it("a network error during refresh does NOT log out", async () => {
    const f = fakeFetch((url) => {
      if (url === "/api/auth/refresh") throw new TypeError("Failed to fetch");
      return json({ message: "Unauthorized" }, 401);
    });
    const client = createApiClient({ fetch: f.fn });
    client.setAccessToken("old");
    const lost = vi.fn();
    client.subscribeAuthLost(lost);

    const error = await getMe(client).catch((e) => e);
    expect(error).toBeInstanceOf(ApiError);
    expect(error).toMatchObject({ status: 0, code: NETWORK_ERROR });
    expect(lost).not.toHaveBeenCalled();
    expect(client.getAccessToken()).toBe("old");
    expect(client.getConnectionProblem()).toBe(true);
  });

  it("a 5xx during refresh does NOT log out", async () => {
    const f = fakeFetch((url) =>
      url === "/api/auth/refresh" ? json({ statusCode: 502, message: "Bad Gateway" }, 502) : json({}, 401),
    );
    const client = createApiClient({ fetch: f.fn });
    client.setAccessToken("old");
    const lost = vi.fn();
    client.subscribeAuthLost(lost);

    await expect(getMe(client)).rejects.toMatchObject({ status: 502 });
    expect(lost).not.toHaveBeenCalled();
  });
});

describe("api client: requests and errors", () => {
  it("always sends X-Client: web and credentials: include, and the bearer token when it has one", async () => {
    const f = fakeFetch(() => json(usersList));
    const client = createApiClient({ fetch: f.fn });
    client.setAccessToken("tok");
    await listAdminUsers(client, { search: "ann", page: 2, pageSize: undefined });

    const { url, init, token } = f.calls[0];
    expect(url).toBe("/api/admin/users?search=ann&page=2");
    expect(new Headers(init.headers).get("X-Client")).toBe("web");
    expect(init.credentials).toBe("include");
    expect(token).toBe("tok");
  });

  it("parses { statusCode, error, code, message } into an ApiError with the code", async () => {
    const f = fakeFetch(() =>
      json({ statusCode: 409, error: "Conflict", code: "CANNOT_CHANGE_OWN_ROLE", message: "You cannot change your own role" }, 409),
    );
    const client = createApiClient({ fetch: f.fn });
    const error = await client.request("/admin/users/x/role", { method: "PATCH", body: { role: "DRIVER" } }).catch((e) => e);
    expect(error).toBeInstanceOf(ApiError);
    expect(error).toMatchObject({ status: 409, code: "CANNOT_CHANGE_OWN_ROLE", message: "You cannot change your own role" });
  });

  it("joins validation message arrays, and falls back to HTTP_<status> for non-JSON errors", async () => {
    const validation = createApiClient({
      fetch: fakeFetch(() => json({ statusCode: 400, error: "Bad Request", message: ["email must be an email", "password too short"] }, 400)).fn,
    });
    await expect(validation.request("/x")).rejects.toMatchObject({
      code: "HTTP_400",
      message: "email must be an email; password too short",
    });

    const html = createApiClient({ fetch: fakeFetch(() => new Response("<html>Bad gateway</html>", { status: 502 })).fn });
    await expect(html.request("/x")).rejects.toMatchObject({ status: 502, code: "HTTP_502" });
  });

  it("login does not try to refresh on 401 (wrong password), and surfaces the API message", async () => {
    const f = fakeFetch(() => json({ statusCode: 401, error: "Unauthorized", message: "Invalid credentials" }, 401));
    const client = createApiClient({ fetch: f.fn });
    await expect(login(client, "a@example.test", "nope")).rejects.toMatchObject({ status: 401, message: "Invalid credentials" });
    expect(f.count("/api/auth/refresh")).toBe(0);
  });

  it("login keeps the access token in memory only: nothing in web storage", async () => {
    const f = fakeFetch(() => json({ access_token: "secret-access-token", user }));
    const client = createApiClient({ fetch: f.fn });
    await login(client, "a@example.test", "pw");

    expect(client.getAccessToken()).toBe("secret-access-token");
    for (const store of [localStorage, sessionStorage]) {
      const dump = JSON.stringify(Object.entries(store));
      expect(store.length).toBe(0);
      expect(dump).not.toContain("secret-access-token");
    }
  });

  it("rejects a response that does not match the schema", async () => {
    const client = createApiClient({ fetch: fakeFetch(() => json({ nope: true })).fn });
    client.setAccessToken("t");
    await expect(getMe(client)).rejects.toMatchObject({ code: "INVALID_RESPONSE" });
  });
});
