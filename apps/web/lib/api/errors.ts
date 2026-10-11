/** Error code used when the request never reached the server (offline, DNS, proxy down). */
export const NETWORK_ERROR = "NETWORK_ERROR";
/** Error code used when a response did not match the expected schema. */
export const INVALID_RESPONSE = "INVALID_RESPONSE";

/**
 * Error returned by the API. The API's error body is `{ statusCode, error, code, message }`;
 * `code` is a stable identifier (e.g. `CANNOT_CHANGE_OWN_ROLE`) that UI logic can rely on.
 * `status` is 0 for network failures.
 */
export class ApiError extends Error {
  readonly status: number;
  readonly code: string;

  constructor(status: number, code: string, message: string) {
    super(message);
    this.name = "ApiError";
    this.status = status;
    this.code = code;
  }

  get isNetworkError(): boolean {
    return this.status === 0;
  }
}

const isRecord = (v: unknown): v is Record<string, unknown> =>
  typeof v === "object" && v !== null && !Array.isArray(v);

/** Builds an ApiError from a non-2xx response, tolerating non-JSON bodies. */
export async function apiErrorFromResponse(res: Response): Promise<ApiError> {
  let body: unknown;
  try {
    body = await res.json();
  } catch {
    body = undefined;
  }
  const b = isRecord(body) ? body : {};

  // class-validator errors arrive as an array of strings.
  const message = Array.isArray(b.message)
    ? b.message.filter((m): m is string => typeof m === "string").join("; ")
    : typeof b.message === "string"
      ? b.message
      : res.statusText || `Request failed (${res.status})`;

  // Domain errors carry `code`. Some auth errors only put a SCREAMING_SNAKE identifier in `message`
  // (e.g. INVALID_REFRESH_TOKEN), so fall back to that before a generic HTTP_<status>.
  const code =
    typeof b.code === "string"
      ? b.code
      : typeof b.message === "string" && /^[A-Z][A-Z0-9_]+$/.test(b.message)
        ? b.message
        : `HTTP_${res.status}`;

  return new ApiError(res.status, code, message);
}
