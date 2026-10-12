import { describe, expect, it } from "vitest";
import { DEFAULT_QUERY, hasActiveFilters, parseUsersQuery, toSearchString } from "./users-query";

const parse = (qs: string) => parseUsersQuery(new URLSearchParams(qs));

describe("users query <-> URL", () => {
  it("reads search, role and page", () => {
    expect(parse("?search=%20Kari%20&role=ADMIN&page=3")).toEqual({ search: "Kari", role: "ADMIN", page: 3 });
  });

  it("falls back to defaults for missing or invalid values", () => {
    expect(parse("")).toEqual(DEFAULT_QUERY);
    expect(parse("?role=KING&page=0")).toEqual(DEFAULT_QUERY);
    expect(parse("?page=-2")).toEqual(DEFAULT_QUERY);
    expect(parse("?page=1.5")).toEqual(DEFAULT_QUERY);
    expect(parse("?page=abc")).toEqual(DEFAULT_QUERY);
    expect(parse("?role=admin")).toEqual(DEFAULT_QUERY); // case-sensitive on purpose
  });

  it("limits the search length", () => {
    expect(parse(`?search=${"a".repeat(500)}`).search).toHaveLength(100);
  });

  it("writes only non-default values, and round-trips", () => {
    expect(toSearchString(DEFAULT_QUERY)).toBe("");
    expect(toSearchString({ search: "", role: "ALL", page: 1 })).toBe("");
    expect(toSearchString({ search: "ola nordmann", role: "DRIVER", page: 2 })).toBe("?search=ola+nordmann&role=DRIVER&page=2");
    const q = { search: "æøå & co", role: "ADMIN" as const, page: 4 };
    expect(parse(toSearchString(q))).toEqual(q);
  });

  it("knows when filters are active (page does not count)", () => {
    expect(hasActiveFilters({ search: "", role: "ALL", page: 5 })).toBe(false);
    expect(hasActiveFilters({ search: "x", role: "ALL", page: 1 })).toBe(true);
    expect(hasActiveFilters({ search: "", role: "ADMIN", page: 1 })).toBe(true);
  });
});
