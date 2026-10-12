import { describe, expect, it } from "vitest";
import { formatDate, pluralize } from "./format";

describe("pluralize", () => {
  it("uses the singular only for exactly 1", () => {
    expect(pluralize(0, "user")).toBe("0 users");
    expect(pluralize(1, "user")).toBe("1 user");
    expect(pluralize(2, "user")).toBe("2 users");
    expect(pluralize(23, "user")).toBe("23 users");
    expect(pluralize(1, "person", "people")).toBe("1 person");
    expect(pluralize(3, "person", "people")).toBe("3 people");
  });
});

describe("formatDate", () => {
  it("formats an ISO date and survives garbage", () => {
    expect(formatDate("2026-10-01T10:00:00.000Z")).toMatch(/^1 Oct 2026$/);
    expect(formatDate("not a date")).toBe("—");
  });
});
