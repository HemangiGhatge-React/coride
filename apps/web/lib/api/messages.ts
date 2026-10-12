import { ApiError, INVALID_RESPONSE, NETWORK_ERROR } from "./errors";

// Plain-language messages for the API error codes the UI knows how to explain. Anything else falls
// back to the server's own message, so an unexpected failure is still shown, not swallowed.
const MESSAGES: Record<string, string> = {
  CANNOT_CHANGE_OWN_ROLE: "You can't change your own role.",
  LAST_ADMIN: "At least one admin must remain.",
  USER_NOT_FOUND: "This user no longer exists.",
  SESSION_NOT_FOUND: "That session had already ended.",
  FORBIDDEN: "Your account doesn't have admin access.",
  [NETWORK_ERROR]: "Can't reach the server. Check your connection and try again.",
  [INVALID_RESPONSE]: "The server sent an unexpected response. Please try again.",
};

export function describeApiError(error: unknown): string {
  if (error instanceof ApiError) return MESSAGES[error.code] ?? error.message;
  return "Something went wrong. Please try again.";
}

/** The API refused the action for this account (e.g. the admin was demoted while the page was open). */
export const isForbidden = (error: unknown): boolean =>
  error instanceof ApiError && error.status === 403 && error.code === "FORBIDDEN";

export const isNotFound = (error: unknown): boolean =>
  error instanceof ApiError && error.status === 404;
