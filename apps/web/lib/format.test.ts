import { describe, expect, it } from "vitest";
import { formatDate, formatDateTime, formatRelativeTime, pluralize } from "./format";

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

describe("formatRelativeTime", () => {
  const now = Date.parse("2026-10-12T12:00:00.000Z");
  const ago = (ms: number) => new Date(now - ms).toISOString();
  const MIN = 60_000;
  const HOUR = 60 * MIN;
  const DAY = 24 * HOUR;

  it.each([
    [10_000, "just now"],
    [44_000, "just now"],
    [2 * MIN, "2 minutes ago"],
    [59 * MIN, "59 minutes ago"],
    [HOUR, "1 hour ago"],
    [5 * HOUR, "5 hours ago"],
    [DAY, "yesterday"],
    [2 * DAY, "2 days ago"],
    [6 * DAY, "6 days ago"],
    [45 * DAY, "last month"],
    [70 * DAY, "2 months ago"],
    [400 * DAY, "last year"],
  ])("%d ms ago reads %s", (ms, text) => {
    expect(formatRelativeTime(ago(ms), now)).toBe(text);
  });

  it("copes with clock skew and garbage", () => {
    expect(formatRelativeTime(new Date(now + 5_000).toISOString(), now)).toBe("just now");
    expect(formatRelativeTime("nope", now)).toBe("unknown");
  });
});

describe("formatDateTime", () => {
  it("gives day, month, year and a 24-hour time", () => {
    expect(formatDateTime("2026-10-12T12:03:00.000Z")).toMatch(/^12 Oct 2026, \d{2}:\d{2}$/);
    expect(formatDateTime("nope")).toBe("—");
  });
});
