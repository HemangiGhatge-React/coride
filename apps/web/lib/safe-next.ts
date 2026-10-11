export const DEFAULT_AFTER_LOGIN = "/admin";

/**
 * Validates the `next` query parameter used after login. Only same-site absolute paths are allowed,
 * so a crafted link cannot send someone to another site (`//evil.test`, `/\evil.test`,
 * `https://evil.test`), and never back to /login itself.
 */
export function safeNextPath(next: string | null | undefined): string {
  if (!next || !next.startsWith("/") || next.startsWith("//") || next.startsWith("/\\")) {
    return DEFAULT_AFTER_LOGIN;
  }
  if (/[\u0000-\u001f]/.test(next)) return DEFAULT_AFTER_LOGIN;
  if (next === "/login" || next.startsWith("/login?") || next.startsWith("/login/")) return DEFAULT_AFTER_LOGIN;
  return next;
}
