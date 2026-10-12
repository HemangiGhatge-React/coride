"use client";

import { keepPreviousData, useQuery } from "@tanstack/react-query";
import Link from "next/link";
import { usePathname, useRouter, useSearchParams } from "next/navigation";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Skeleton } from "@/components/ui/skeleton";
import { Table, TableCaption, TableCell, TableHead, TableRow } from "@/components/ui/table";
import { api, describeApiError, listAdminUsers, type AdminUser } from "@/lib/api";
import { formatDate, pluralize } from "@/lib/format";
import {
  PAGE_SIZE,
  hasActiveFilters,
  parseUsersQuery,
  toSearchString,
  type RoleFilter,
  type UsersQuery,
} from "@/lib/users-query";

const SEARCH_DEBOUNCE_MS = 300;
const SKELETON_ROWS = 6;

export const USERS_QUERY_KEY = ["admin", "users"] as const;

export function RoleBadge({ role }: { role: AdminUser["role"] }) {
  return <Badge tone={role === "ADMIN" ? "accent" : "neutral"}>{role === "ADMIN" ? "Admin" : "Driver"}</Badge>;
}

/**
 * The users table. All of its state (search, role filter, page) lives in the URL query string:
 * typing in the search box updates the URL after a 300 ms pause, and back/forward restore the
 * previous view, including the text in the box.
 */
export function UsersTable() {
  const router = useRouter();
  const pathname = usePathname();
  const searchParams = useSearchParams();
  const query = useMemo(() => parseUsersQuery(searchParams), [searchParams]);

  // The URL this component last navigated to itself. A URL change that is not this one came from
  // outside (browser back/forward), and must win over anything typed or pending.
  const ownHref = useRef<string | null>(null);
  const currentHref = `${pathname}${toSearchString(query)}`;

  const navigate = useCallback(
    (next: Partial<UsersQuery>, mode: "push" | "replace" = "push") => {
      const href = `${pathname}${toSearchString({ ...query, ...next })}`;
      if (href === currentHref) return;
      ownHref.current = href;
      if (mode === "replace") router.replace(href);
      else router.push(href);
    },
    [pathname, query, currentHref, router],
  );

  // --- search box: local text, debounced into the URL -------------------------------------------
  const [text, setText] = useState(query.search);
  const timer = useRef<ReturnType<typeof setTimeout> | undefined>(undefined);
  // The timer must use the *latest* navigate and query, not the ones from when typing started:
  // otherwise changing the role during the 300 ms pause would be reverted.
  const latest = useRef({ navigate, query });
  useEffect(() => {
    latest.current = { navigate, query };
  }, [navigate, query]);

  useEffect(() => {
    if (ownHref.current === currentHref) {
      ownHref.current = null; // our own navigation arriving: nothing to reconcile
      return;
    }
    // Back/forward (or first render): show the URL's search, and drop any pending update, which
    // belongs to the view we just left and would otherwise undo the navigation.
    clearTimeout(timer.current);
    setText(query.search);
  }, [currentHref, query.search]);

  useEffect(() => () => clearTimeout(timer.current), []);

  function onSearchChange(value: string) {
    setText(value);
    clearTimeout(timer.current);
    timer.current = setTimeout(() => {
      const search = value.trim();
      if (search === latest.current.query.search) return;
      latest.current.navigate({ search, page: 1 }, "replace"); // replace: typing must not flood the history
    }, SEARCH_DEBOUNCE_MS);
  }

  function clearFilters() {
    clearTimeout(timer.current);
    setText("");
    navigate({ search: "", role: "ALL", page: 1 });
  }

  // --- data -------------------------------------------------------------------------------------
  const result = useQuery({
    queryKey: [...USERS_QUERY_KEY, "list", query],
    queryFn: () =>
      listAdminUsers(api, {
        search: query.search || undefined,
        role: query.role === "ALL" ? undefined : query.role,
        page: query.page,
        pageSize: PAGE_SIZE,
      }),
    placeholderData: keepPreviousData, // keep showing the old page while the next one loads
  });
  const { data } = result;
  const totalPages = data ? Math.max(1, Math.ceil(data.total / PAGE_SIZE)) : 1;

  // A link or reload with a page past the end (e.g. after filtering) lands on the last page.
  useEffect(() => {
    if (data && !result.isPlaceholderData && query.page > totalPages) navigate({ page: totalPages }, "replace");
  }, [data, result.isPlaceholderData, query.page, totalPages, navigate]);

  const filtersActive = hasActiveFilters(query);
  const showError = result.isError && !(data && result.isPlaceholderData);
  const refreshing = result.isFetching && !!data;

  const count = (() => {
    if (showError) return "Could not load users.";
    if (!data) return "Loading users…";
    if (data.total === 0) return filtersActive ? "No users match your filters." : "No users yet.";
    const from = (data.page - 1) * PAGE_SIZE + 1;
    const to = Math.min(data.page * PAGE_SIZE, data.total);
    if (data.total === 1) return `Showing ${pluralize(1, "user")}`;
    // A one-row last page reads "Showing 21 of 21 users", not "21–21".
    return `Showing ${from === to ? from : `${from}–${to}`} of ${pluralize(data.total, "user")}`;
  })();

  return (
    <section aria-labelledby="users-heading" className="mx-auto max-w-5xl space-y-5 p-6">
      <div>
        <h1 id="users-heading" className="text-xl font-semibold text-slate-900">
          Users
        </h1>
        <p role="status" aria-live="polite" className="mt-1 text-sm text-slate-600">
          {count}
        </p>
      </div>

      <div className="flex flex-wrap items-end gap-4">
        <div className="min-w-56 flex-1">
          <label htmlFor="user-search" className="mb-1 block text-sm font-medium text-slate-700">
            Search users
          </label>
          <Input
            id="user-search"
            type="search"
            placeholder="Name or email"
            autoComplete="off"
            value={text}
            onChange={(e) => onSearchChange(e.target.value)}
          />
        </div>
        <div>
          <label htmlFor="user-role" className="mb-1 block text-sm font-medium text-slate-700">
            Role
          </label>
          <select
            id="user-role"
            value={query.role}
            onChange={(e) => navigate({ role: e.target.value as RoleFilter, page: 1 })}
            className="rounded-md border border-slate-300 bg-white px-3 py-2 text-sm text-slate-900"
          >
            <option value="ALL">All roles</option>
            <option value="DRIVER">Driver</option>
            <option value="ADMIN">Admin</option>
          </select>
        </div>
      </div>

      {showError ? (
        <div role="alert" className="space-y-3 rounded-lg border border-red-200 bg-red-50 p-4">
          <p className="text-sm text-red-800">Could not load users: {describeApiError(result.error)}</p>
          <Button type="button" variant="secondary" onClick={() => void result.refetch()} disabled={result.isFetching}>
            Try again
          </Button>
        </div>
      ) : !data ? (
        <TableSkeleton />
      ) : data.total === 0 ? (
        <div className="rounded-lg border border-dashed border-slate-300 p-8 text-center">
          {filtersActive ? (
            <>
              <p className="text-slate-800">
                No users match{query.search ? <> “{query.search}”</> : null}
                {query.role !== "ALL" ? <> with the role {query.role === "ADMIN" ? "Admin" : "Driver"}</> : null}.
              </p>
              <Button type="button" variant="secondary" className="mt-4" onClick={clearFilters}>
                Clear filters
              </Button>
            </>
          ) : (
            <p className="text-slate-800">There are no users yet.</p>
          )}
        </div>
      ) : (
        <>
          <div aria-busy={refreshing} className={refreshing ? "opacity-60 transition-opacity" : "transition-opacity"}>
            <Table>
              <TableCaption>Users, newest first</TableCaption>
              <thead>
                <tr>
                  <TableHead>Name</TableHead>
                  <TableHead>Email</TableHead>
                  <TableHead>Role</TableHead>
                  <TableHead className="text-right">Active sessions</TableHead>
                  <TableHead>Created</TableHead>
                </tr>
              </thead>
              <tbody>
                {data.items.map((user) => (
                  <UserRow key={user.id} user={user} from={toSearchString(query)} />
                ))}
              </tbody>
            </Table>
          </div>

          {data.total > PAGE_SIZE && (
            <nav aria-label="Pagination" className="flex items-center justify-between gap-4">
              <Button
                type="button"
                variant="secondary"
                disabled={query.page <= 1}
                onClick={() => navigate({ page: query.page - 1 })}
              >
                Previous
              </Button>
              <span className="text-sm text-slate-600">
                Page {data.page} of {totalPages}
              </span>
              <Button
                type="button"
                variant="secondary"
                disabled={query.page >= totalPages}
                onClick={() => navigate({ page: query.page + 1 })}
              >
                Next
              </Button>
            </nav>
          )}
        </>
      )}
    </section>
  );
}

function UserRow({ user, from }: { user: AdminUser; from: string }) {
  const router = useRouter();
  // `from` carries the table's query string, so the detail page's back link restores this exact view.
  const href = `/admin/users/${encodeURIComponent(user.id)}${from ? `?from=${encodeURIComponent(from)}` : ""}`;

  return (
    <TableRow
      className="cursor-pointer hover:bg-slate-50"
      // Mouse convenience only: keyboard and screen-reader users use the name link.
      onClick={(event) => {
        if ((event.target as HTMLElement).closest("a, button")) return;
        router.push(href);
      }}
    >
      <TableCell>
        <Link href={href} className="font-medium text-blue-700 underline-offset-2 hover:underline">
          {user.name}
        </Link>
      </TableCell>
      <TableCell className="text-slate-600">{user.email}</TableCell>
      <TableCell>
        <RoleBadge role={user.role} />
      </TableCell>
      <TableCell className="text-right tabular-nums">{user.activeSessionCount}</TableCell>
      <TableCell className="whitespace-nowrap text-slate-600">
        <time dateTime={user.createdAt}>{formatDate(user.createdAt)}</time>
      </TableCell>
    </TableRow>
  );
}

function TableSkeleton() {
  return (
    <div role="status" aria-label="Loading users" aria-busy="true" className="overflow-hidden rounded-lg border border-slate-200">
      {Array.from({ length: SKELETON_ROWS }, (_, i) => (
        <div key={i} className="flex items-center gap-4 border-t border-slate-200 px-4 py-3.5 first:border-t-0">
          <Skeleton className="h-4 w-1/4" />
          <Skeleton className="h-4 w-2/5" />
          <Skeleton className="h-5 w-16" />
          <Skeleton className="ml-auto h-4 w-8" />
        </div>
      ))}
    </div>
  );
}
