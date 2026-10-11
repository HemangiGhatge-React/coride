"use client";

import { useQuery } from "@tanstack/react-query";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import { api, listAdminUsers } from "@/lib/api";

// Placeholder: proves the whole chain (proxy -> refresh cookie -> access token -> /admin/users).
// The real table comes next.
export default function AdminUsersPage() {
  const { data, error, isPending, refetch, isFetching } = useQuery({
    queryKey: ["admin", "users", "count"],
    queryFn: () => listAdminUsers(api, { page: 1, pageSize: 1 }),
  });

  return (
    <main className="mx-auto max-w-3xl p-6">
      <h1 className="mb-4 text-xl font-semibold">Users</h1>
      <Card>
        {isPending && !error ? (
          <div role="status" aria-label="Loading users">
            <Skeleton className="h-6 w-40" />
          </div>
        ) : error ? (
          <div className="space-y-3" role="alert">
            <p className="text-red-700">Could not load users: {error.message}</p>
            <Button type="button" onClick={() => void refetch()} disabled={isFetching}>
              Try again
            </Button>
          </div>
        ) : (
          <p>
            Total users: <strong data-testid="user-count">{data.total}</strong>
          </p>
        )}
      </Card>
    </main>
  );
}
