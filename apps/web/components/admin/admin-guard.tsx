"use client";

import { usePathname, useRouter } from "next/navigation";
import { useEffect, type ReactNode } from "react";
import { Skeleton } from "@/components/ui/skeleton";
import { useAuth } from "@/lib/auth/auth-context";
import { AdminHeader } from "./admin-header";
import { Forbidden } from "./forbidden";

function AdminSkeleton() {
  return (
    <div role="status" aria-label="Loading" className="space-y-4 p-4">
      <Skeleton className="h-10 w-full" />
      <Skeleton className="h-8 w-1/3" />
      <Skeleton className="h-32 w-full" />
    </div>
  );
}

/**
 * Guards everything under /admin, client-side (the API enforces the same rule on every request;
 * this only decides what to show).
 *  - loading: skeleton
 *  - anonymous: redirect to /login?next=<current path>
 *  - authenticated but not ADMIN: a 403 page. Not a redirect, so there is no redirect loop.
 */
export function AdminGuard({ children }: { children: ReactNode }) {
  const { status, user } = useAuth();
  const router = useRouter();
  const pathname = usePathname();

  useEffect(() => {
    if (status === "anonymous") {
      const next = pathname + window.location.search;
      router.replace(`/login?next=${encodeURIComponent(next)}`);
    }
  }, [status, pathname, router]);

  if (status !== "authenticated" || !user) return <AdminSkeleton />;

  return (
    <>
      <AdminHeader />
      {user.role === "ADMIN" ? children : <Forbidden />}
    </>
  );
}
