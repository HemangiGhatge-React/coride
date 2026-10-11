import { createApiClient } from "./client";

export * from "./client";
export * from "./endpoints";
export * from "./errors";
export * from "./schemas";

/** The app-wide client. Its state (access token, shared refresh) lives in memory for this tab. */
export const api = createApiClient();
