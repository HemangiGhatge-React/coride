import { Suspense } from "react";
import { UserDetail } from "@/components/admin/user-detail";
import { Skeleton } from "@/components/ui/skeleton";

export default function AdminUserDetailPage() {
  // useSearchParams (the ?from= back link) needs a Suspense boundary during prerendering.
  return (
    <Suspense
      fallback={
        <div role="status" aria-label="Loading user" className="mx-auto max-w-3xl space-y-4 p-6">
          <Skeleton className="h-7 w-48" />
          <Skeleton className="h-40 w-full" />
        </div>
      }
    >
      <UserDetail />
    </Suspense>
  );
}
