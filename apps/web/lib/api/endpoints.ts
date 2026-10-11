import type { ApiClient } from "./client";
import { adminUsersListSchema, loginResponseSchema, meResponseSchema, type Role } from "./schemas";

// Thin typed wrappers over the client for the endpoints the web app uses.

export async function login(client: ApiClient, email: string, password: string) {
  const data = await client.request("/auth/login", {
    method: "POST",
    body: { email, password },
    schema: loginResponseSchema,
    skipAuthRefresh: true, // a 401 here means wrong credentials, not an expired session
  });
  client.setAccessToken(data.access_token);
  return data.user;
}

/** Revokes the session server-side and clears the cookie. Always clears the in-memory token. */
export async function logout(client: ApiClient) {
  try {
    await client.request("/auth/logout", { method: "POST", skipAuthRefresh: true });
  } finally {
    client.setAccessToken(null);
  }
}

export function getMe(client: ApiClient) {
  return client.request("/auth/me", { schema: meResponseSchema });
}

export interface ListAdminUsersParams {
  search?: string;
  role?: Role;
  page?: number;
  pageSize?: number;
}

export function listAdminUsers(client: ApiClient, params: ListAdminUsersParams = {}) {
  return client.request("/admin/users", { query: { ...params }, schema: adminUsersListSchema });
}
