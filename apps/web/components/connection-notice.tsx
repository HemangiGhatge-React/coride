"use client";

import { useSyncExternalStore } from "react";
import { api, type ApiClient } from "@/lib/api";

/**
 * Non-blocking notice shown while requests cannot reach the server. The live region is always
 * mounted so that screen readers announce the text when it appears.
 */
export function ConnectionNotice({ client = api }: { client?: ApiClient }) {
  const problem = useSyncExternalStore(client.subscribeConnection, client.getConnectionProblem, () => false);
  return (
    <div role="status" aria-live="polite" className="pointer-events-none fixed inset-x-0 top-0 z-50 flex justify-center">
      {problem && (
        <p className="pointer-events-auto mt-2 rounded-md border border-amber-300 bg-amber-50 px-3 py-1.5 text-sm text-amber-900 shadow-sm">
          Connection problem, retrying…
        </p>
      )}
    </div>
  );
}
