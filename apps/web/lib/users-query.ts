// The users table keeps its state in the URL (?search=&role=&page=), so reload, back/forward and
// shared links all reproduce the same view. These helpers are the only place that reads or writes it.

export const PAGE_SIZE = 10;
export const MAX_SEARCH_LENGTH = 100; // matches the API's limit

export type RoleFilter = "ALL" | "DRIVER" | "ADMIN";

export interface UsersQuery {
  search: string;
  role: RoleFilter;
  page: number;
}

export const DEFAULT_QUERY: UsersQuery = { search: "", role: "ALL", page: 1 };

/** Anything unexpected in the URL falls back to the default instead of reaching the API. */
export function parseUsersQuery(params: { get(name: string): string | null }): UsersQuery {
  const search = (params.get("search") ?? "").trim().slice(0, MAX_SEARCH_LENGTH);
  const roleParam = params.get("role");
  const role: RoleFilter = roleParam === "DRIVER" || roleParam === "ADMIN" ? roleParam : "ALL";
  const pageParam = Number(params.get("page"));
  const page = Number.isInteger(pageParam) && pageParam >= 1 ? pageParam : 1;
  return { search, role, page };
}

/** "?search=ann&role=ADMIN&page=2", or "" when everything is the default. */
export function toSearchString(query: UsersQuery): string {
  const params = new URLSearchParams();
  if (query.search) params.set("search", query.search);
  if (query.role !== "ALL") params.set("role", query.role);
  if (query.page > 1) params.set("page", String(query.page));
  const qs = params.toString();
  return qs ? `?${qs}` : "";
}

export const hasActiveFilters = (query: UsersQuery) => query.search !== "" || query.role !== "ALL";
