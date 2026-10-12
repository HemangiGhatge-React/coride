import { describe, expect, it } from "vitest";
import { ApiError, NETWORK_ERROR } from "./errors";
import { describeApiError, isForbidden, isNotFound } from "./messages";

describe("describeApiError", () => {
  it.each([
    ["CANNOT_CHANGE_OWN_ROLE", "You can't change your own role."],
    ["LAST_ADMIN", "At least one admin must remain."],
    ["USER_NOT_FOUND", "This user no longer exists."],
    [NETWORK_ERROR, "Can't reach the server. Check your connection and try again."],
  ])("maps %s to a plain message", (code, message) => {
    expect(describeApiError(new ApiError(409, code, "raw server text"))).toBe(message);
  });

  it("falls back to the server's message for codes it does not know, and to a generic one for non-API errors", () => {
    expect(describeApiError(new ApiError(500, "HTTP_500", "Internal server error"))).toBe("Internal server error");
    expect(describeApiError(new TypeError("boom"))).toBe("Something went wrong. Please try again.");
  });

  it("recognises FORBIDDEN and not-found", () => {
    expect(isForbidden(new ApiError(403, "FORBIDDEN", "no"))).toBe(true);
    expect(isForbidden(new ApiError(403, "HTTP_403", "no"))).toBe(false);
    expect(isForbidden(new ApiError(409, "FORBIDDEN", "no"))).toBe(false);
    expect(isNotFound(new ApiError(404, "USER_NOT_FOUND", "x"))).toBe(true);
    expect(isNotFound(new ApiError(409, "LAST_ADMIN", "x"))).toBe(false);
  });
});
