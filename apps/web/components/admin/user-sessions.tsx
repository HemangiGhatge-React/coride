"use client";

import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useEffect, useRef, useState } from "react";
import { Button } from "@/components/ui/button";
import { Dialog } from "@/components/ui/dialog";
import { Skeleton } from "@/components/ui/skeleton";
import {
  ApiError,
  api,
  describeApiError,
  isForbidden,
  listUserSessions,
  revokeAllSessions,
  revokeSession,
  type UserSession,
} from "@/lib/api";
import { describeDevice } from "@/lib/device";
import { formatDate, formatDateTime, formatRelativeTime } from "@/lib/format";
import { USERS_QUERY_KEY } from "./users-table";

type Target = { kind: "one"; session: UserSession; device: string } | { kind: "all"; count: number };

const REVOKE_EXPLANATION =
  "Revoking ends the session's refresh token immediately. Access already issued stays valid for up to 15 minutes.";

export function UserSessions({
  userId,
  userName,
  isOwnProfile,
}: {
  userId: string;
  userName: string;
  isOwnProfile: boolean;
}) {
  const queryClient = useQueryClient();
  const headingRef = useRef<HTMLHeadingElement>(null);
  const focusHeadingAfterClose = useRef(false);
  const [target, setTarget] = useState<Target | null>(null);
  const [notice, setNotice] = useState<string | null>(null);

  const sessions = useQuery({
    queryKey: [...USERS_QUERY_KEY, "sessions", userId],
    queryFn: () => listUserSessions(api, userId),
  });

  // Not optimistic: wait for the server, then refetch the sessions, the users list and this
  // user's detail (the active-session count) together, by invalidating the shared key prefix.
  const refetchEverything = () => queryClient.invalidateQueries({ queryKey: USERS_QUERY_KEY });

  const revoke = useMutation({
    mutationFn: (t: Target) => (t.kind === "one" ? revokeSession(api, t.session.familyId) : revokeAllSessions(api, userId)),
    onMutate: () => setNotice(null),
    onSuccess: async (_data, t) => {
      setTarget(null);
      setNotice(t.kind === "one" ? "Session revoked" : "All sessions ended");
      focusHeadingAfterClose.current = true; // the row that opened the dialog is gone
      await refetchEverything();
    },
    onError: async (error) => {
      setTarget(null);
      // The session had already ended (the user signed out, or another admin revoked it): the list is stale.
      if (error instanceof ApiError && error.code === "SESSION_NOT_FOUND") await refetchEverything();
    },
  });

  // Runs after the dialog's own focus return, which finds nothing to focus when the row is gone.
  useEffect(() => {
    if (!target && focusHeadingAfterClose.current) {
      focusHeadingAfterClose.current = false;
      headingRef.current?.focus();
    }
  }, [target]);

  const list = sessions.data ?? [];
  const forbidden = isForbidden(sessions.error) || isForbidden(revoke.error);

  const ownWarning = isOwnProfile ? " This is your own account, so you may be signed out on this device too." : "";
  const dialogCopy = (() => {
    if (!target) return { title: "", confirm: "" };
    if (target.kind === "one") {
      return { title: `Sign ${userName} out of ${target.device}?`, confirm: "Revoke session" };
    }
    return target.count === 1
      ? { title: `End the active session for ${userName}?`, confirm: "End session" }
      : { title: `End all ${target.count} sessions for ${userName}?`, confirm: "End all sessions" };
  })();

  return (
    <section aria-labelledby="sessions-heading" className="space-y-3">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <h2 id="sessions-heading" ref={headingRef} tabIndex={-1} className="text-base font-semibold text-slate-900 outline-none">
          Active sessions
        </h2>
        <Button
          type="button"
          variant="secondary"
          disabled={list.length === 0 || revoke.isPending || forbidden}
          onClick={() => setTarget({ kind: "all", count: list.length })}
        >
          Sign out everywhere
        </Button>
      </div>
      <p className="text-sm text-slate-500">{REVOKE_EXPLANATION}</p>

      <p role="status" aria-live="polite" className="text-sm text-green-700">
        {notice}
      </p>
      {revoke.isError && !forbidden && (
        <p role="alert" className="text-sm text-red-700">
          {describeApiError(revoke.error)}
        </p>
      )}

      {forbidden ? (
        <p role="alert" className="rounded-lg border border-slate-200 p-4 text-sm text-slate-700">
          Your account doesn&apos;t have admin access.
        </p>
      ) : sessions.isPending ? (
        <div role="status" aria-label="Loading sessions" className="space-y-2">
          <Skeleton className="h-14 w-full" />
          <Skeleton className="h-14 w-full" />
        </div>
      ) : sessions.isError ? (
        <div role="alert" className="space-y-3 rounded-lg border border-red-200 bg-red-50 p-4">
          <p className="text-sm text-red-800">Could not load sessions: {describeApiError(sessions.error)}</p>
          <Button type="button" variant="secondary" onClick={() => void sessions.refetch()} disabled={sessions.isFetching}>
            Try again
          </Button>
        </div>
      ) : list.length === 0 ? (
        <p className="rounded-lg border border-dashed border-slate-300 p-6 text-sm text-slate-600">No active sessions.</p>
      ) : (
        <ul className="divide-y divide-slate-200 rounded-lg border border-slate-200">
          {list.map((session) => (
            <SessionRow key={session.familyId} session={session} onRevoke={(device) => setTarget({ kind: "one", session, device })} />
          ))}
        </ul>
      )}

      <Dialog
        open={target !== null}
        onClose={() => {
          if (!revoke.isPending) setTarget(null);
        }}
        title={dialogCopy.title}
        description={
          <>
            <p>{REVOKE_EXPLANATION}</p>
            {ownWarning && <p className="mt-2 font-medium text-amber-800">{ownWarning.trim()}</p>}
          </>
        }
      >
        <div className="mt-6 flex justify-end gap-3">
          <Button type="button" variant="secondary" data-autofocus disabled={revoke.isPending} onClick={() => setTarget(null)}>
            Cancel
          </Button>
          <Button type="button" disabled={revoke.isPending} onClick={() => target && revoke.mutate(target)}>
            {revoke.isPending ? "Revoking…" : dialogCopy.confirm}
          </Button>
        </div>
      </Dialog>
    </section>
  );
}

function SessionRow({ session, onRevoke }: { session: UserSession; onRevoke: (device: string) => void }) {
  const device = describeDevice(session.userAgent);
  const lastUsed = session.lastUsedAt ? formatRelativeTime(session.lastUsedAt) : null;

  return (
    <li className="flex flex-wrap items-center justify-between gap-3 px-4 py-3">
      <div className="min-w-0">
        <p className="font-medium text-slate-900">{device}</p>
        <p className="text-sm text-slate-600">
          {session.lastUsedAt ? (
            <>
              Last used{" "}
              <time dateTime={session.lastUsedAt} title={formatDateTime(session.lastUsedAt)}>
                {lastUsed}
              </time>
            </>
          ) : (
            "Last used: unknown"
          )}
          <span aria-hidden="true"> · </span>
          <span className="whitespace-nowrap">
            Signed in{" "}
            <time dateTime={session.createdAt} title={formatDateTime(session.createdAt)}>
              {formatDate(session.createdAt)}
            </time>
          </span>
        </p>
      </div>
      <Button
        type="button"
        variant="secondary"
        aria-label={`Revoke session: ${device}${lastUsed ? `, last used ${lastUsed}` : ""}`}
        onClick={() => onRevoke(device)}
      >
        Revoke
      </Button>
    </li>
  );
}

