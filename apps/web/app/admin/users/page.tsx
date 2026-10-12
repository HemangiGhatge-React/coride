import { Suspense } from "react";
import { Skeleton } from "@/components/ui/skeleton";
import { UsersTable } from "@/components/admin/users-table";

export default function AdminUsersPage() {
  // useSearchParams (URL-driven table state) needs a Suspense boundary during prerendering.
  return (
    <Suspense
      fallback={
        <div role="status" aria-label="Loading users" className="mx-auto max-w-5xl space-y-4 p-6">
          <Skeleton className="h-7 w-24" />
          <Skeleton className="h-64 w-full" />
        </div>
      }
    >
      <UsersTable />
    </Suspense>
  );
}
