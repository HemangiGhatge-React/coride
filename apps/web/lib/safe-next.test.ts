import { describe, expect, it } from "vitest";
import { safeNextPath } from "./safe-next";

describe("safeNextPath", () => {
  it("keeps same-site paths, including query strings", () => {
    expect(safeNextPath("/admin/users")).toBe("/admin/users");
    expect(safeNextPath("/admin/users?page=2&search=a")).toBe("/admin/users?page=2&search=a");
  });

  it.each([null, undefined, "", "admin", "https://evil.test", "//evil.test", String.raw`/\evil.test`,"javascript:alert(1)", "/a\nb"])(
    "falls back to /admin for %j",
    (value) => expect(safeNextPath(value as string | null | undefined)).toBe("/admin"),
  );

  it("never sends the user back to the login page", () => {
    expect(safeNextPath("/login")).toBe("/admin");
    expect(safeNextPath("/login?next=%2Fadmin")).toBe("/admin");
  });
});
