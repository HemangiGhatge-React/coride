"use client";

import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { ArrowLeft } from "lucide-react";
import Link from "next/link";
import { useParams, useSearchParams } from "next/navigation";
import { useEffect, useId, useRef, useState } from "react";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Dialog } from "@/components/ui/dialog";
import { Skeleton } from "@/components/ui/skeleton";
import {
  api,
  describeApiError,
  getAdminUser,
  isForbidden,
  isNotFound,
  updateUserRole,
  type AdminUser,
  type Role,
} from "@/lib/api";
import { useAuth } from "@/lib/auth/auth-context";
import { formatDate } from "@/lib/format";
import { parseUsersQuery, toSearchString } from "@/lib/users-query";
import { Forbidden } from "./forbidden";
import { UserSessions } from "./user-sessions";
import { RoleBadge, USERS_QUERY_KEY } from "./users-table";

const roleLabel = (role: Role) => (role === "ADMIN" ? "Admin" : "Driver");
const withArticle = (role: Role) => (role === "ADMIN" ? "an Admin" : "a Driver");

/** The table's query string, rebuilt from the three known parameters only (never echoed raw). */
function backHref(from: string | null): string {
  const query = parseUsersQuery(new URLSearchParams(from ?? ""));
  return `/admin/users${toSearchString(query)}`;
}

export function UserDetail() {
  const { id } = useParams<{ id: string }>();
  const searchParams = useSearchParams();
  const back = backHref(searchParams.get("from"));
  const { user: me } = useAuth();

  const query = useQuery({
    queryKey: [...USERS_QUERY_KEY, "detail", id],
    queryFn: () => getAdminUser(api, id),
  });

  const backLink = (
    <Link href={back} className="inline-flex items-center gap-1.5 text-sm text-blue-700 hover:underline">
      <ArrowLeft aria-hidden="true" className="size-4" />
      Back to users
    </Link>
  );

  if (query.isPending) {
    return (
      <div role="status" aria-label="Loading user" className="mx-auto max-w-3xl space-y-4 p-6">
        <Skeleton className="h-5 w-32" />
        <Skeleton className="h-8 w-56" />
        <Skeleton className="h-40 w-full" />
      </div>
    );
  }

  if (query.isError) {
    if (isForbidden(query.error)) return <Forbidden />;
    return (
      <main className="mx-auto max-w-3xl space-y-4 p-6">
        {backLink}
        {isNotFound(query.error) ? (
          <div role="alert" className="rounded-lg border border-slate-200 p-6">
            <h1 className="text-lg font-semibold text-slate-900">User not found</h1>
            <p className="mt-1 text-sm text-slate-600">{describeApiError(query.error)}</p>
          </div>
        ) : (
          <div role="alert" className="space-y-3 rounded-lg border border-red-200 bg-red-50 p-4">
            <p className="text-sm text-red-800">Could not load this user: {describeApiError(query.error)}</p>
            <Button type="button" variant="secondary" onClick={() => void query.refetch()} disabled={query.isFetching}>
              Try again
            </Button>
          </div>
        )}
      </main>
    );
  }

  return <UserDetailBody user={query.data} backLink={backLink} isOwnProfile={me?.id === query.data.id} />;
}

function UserDetailBody({
  user,
  backLink,
  isOwnProfile,
}: {
  user: AdminUser;
  backLink: React.ReactNode;
  isOwnProfile: boolean;
}) {
  const queryClient = useQueryClient();
  const selectId = useId();
  const hintId = useId();
  const errorId = useId();
  const selectRef = useRef<HTMLSelectElement>(null);

  // What the admin picked in the select, or null to show the server's role. Deriving `selected`
  // this way means a refetch (after a change, or a change made elsewhere) is reflected without
  // syncing state in an effect.
  const [choice, setChoice] = useState<Role | null>(null);
  const selected = choice ?? user.role;
  const [confirming, setConfirming] = useState(false);
  const [notice, setNotice] = useState<string | null>(null);
  const focusSelectAfterClose = useRef(false);

  const change = useMutation({
    mutationFn: (role: Role) => updateUserRole(api, user.id, role),
    onMutate: () => setNotice(null),
    onSuccess: async (updated) => {
      setConfirming(false);
      setNotice(`${updated.name} is now ${withArticle(updated.role)}.`);
      // Show the server's answer right away (so the select does not flicker back to the old role
      // while the refetch below is in flight).
      queryClient.setQueryData<AdminUser>([...USERS_QUERY_KEY, "detail", user.id], (old) =>
        old ? { ...old, role: updated.role } : old,
      );
      setChoice(null);
      focusSelectAfterClose.current = true; // the trigger button is disabled now that the role matches
      // Not optimistic: the server has answered. Refresh the list and this user together.
      await queryClient.invalidateQueries({ queryKey: USERS_QUERY_KEY });
    },
    onError: () => setConfirming(false), // the message appears next to the control
  });

  // Runs after the dialog's own focus return (which is a no-op on the now-disabled trigger).
  useEffect(() => {
    if (!confirming && focusSelectAfterClose.current) {
      focusSelectAfterClose.current = false;
      selectRef.current?.focus();
    }
  }, [confirming]);

  // The server refused the action for this account (e.g. demoted in another tab): show the 403 view.
  if (change.isError && isForbidden(change.error)) return <Forbidden />;

  const unchanged = selected === user.role;
  const controlsDisabled = isOwnProfile || change.isPending;

  return (
    <main className="mx-auto max-w-3xl space-y-6 p-6">
      {backLink}

      <header className="space-y-2">
        <div className="flex flex-wrap items-center gap-3">
          <h1 className="text-2xl font-semibold text-slate-900">{user.name}</h1>
          <RoleBadge role={user.role} />
        </div>
        <p className="text-slate-600">{user.email}</p>
        <dl className="flex flex-wrap gap-x-8 gap-y-1 pt-2 text-sm">
          <div className="flex gap-2">
            <dt className="text-slate-500">Created</dt>
            <dd className="text-slate-800">
              <time dateTime={user.createdAt}>{formatDate(user.createdAt)}</time>
            </dd>
          </div>
          <div className="flex gap-2">
            <dt className="text-slate-500">Active sessions</dt>
            <dd className="text-slate-800 tabular-nums">{user.activeSessionCount}</dd>
          </div>
        </dl>
      </header>

      <Card className="space-y-4">
        <h2 className="text-base font-semibold text-slate-900">Role</h2>
        <div className="flex flex-wrap items-end gap-3">
          <div>
            <label htmlFor={selectId} className="mb-1 block text-sm font-medium text-slate-700">
              Role
            </label>
            <select
              id={selectId}
              ref={selectRef}
              value={selected}
              disabled={controlsDisabled}
              aria-describedby={[isOwnProfile ? hintId : null, change.isError ? errorId : null].filter(Boolean).join(" ") || undefined}
              onChange={(e) => {
                setChoice(e.target.value as Role);
                change.reset(); // a stale error should not stay next to a different choice
              }}
              className="rounded-md border border-slate-300 bg-white px-3 py-2 text-sm text-slate-900 disabled:bg-slate-100 disabled:text-slate-500"
            >
              <option value="DRIVER">Driver</option>
              <option value="ADMIN">Admin</option>
            </select>
          </div>
          <Button
            type="button"
            disabled={controlsDisabled || unchanged}
            aria-describedby={isOwnProfile ? hintId : undefined}
            onClick={() => setConfirming(true)}
          >
            Change role
          </Button>
        </div>

        {isOwnProfile && (
          <p id={hintId} className="text-sm text-slate-600">
            You can&apos;t change your own role.
          </p>
        )}
        {change.isError && (
          <p id={errorId} role="alert" className="text-sm text-red-700">
            {describeApiError(change.error)}
          </p>
        )}
        <p role="status" aria-live="polite" className="text-sm text-green-700">
          {notice}
        </p>
      </Card>

      <UserSessions userId={user.id} userName={user.name} isOwnProfile={isOwnProfile} />

      <Dialog
        open={confirming}
        onClose={() => {
          if (!change.isPending) setConfirming(false);
        }}
        title={`Make ${user.name} ${withArticle(selected)}?`}
        description={
          selected === "ADMIN"
            ? `${user.name} will be able to view and manage all users and sessions. Their role changes from ${roleLabel(user.role)} to Admin.`
            : `${user.name} will lose access to the admin area immediately. Their role changes from ${roleLabel(user.role)} to Driver.`
        }
      >
        <div className="mt-6 flex justify-end gap-3">
          <Button type="button" variant="secondary" data-autofocus disabled={change.isPending} onClick={() => setConfirming(false)}>
            Cancel
          </Button>
          <Button type="button" disabled={change.isPending} onClick={() => change.mutate(selected)}>
            {change.isPending ? "Changing…" : `Make ${roleLabel(selected)}`}
          </Button>
        </div>
      </Dialog>
    </main>
  );
}
