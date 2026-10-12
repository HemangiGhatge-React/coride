"use client";

import { useState } from "react";
import { Button } from "@/components/ui/button";
import { useAuth } from "@/lib/auth/auth-context";

export function AdminHeader() {
  const { user, logout } = useAuth();
  const [pending, setPending] = useState(false);

  return (
    <header className="flex items-center justify-between gap-4 border-b bg-white px-4 py-3">
      <span className="font-semibold">CoRide admin</span>
      <div className="flex items-center gap-3 text-sm">
        {user && <span aria-label="Signed in as">{user.email}</span>}
        <Button
          variant="secondary"
          type="button"
          disabled={pending}
          onClick={async () => {
            setPending(true);
            await logout();
          }}
        >
          Log out
        </Button>
      </div>
    </header>
  );
}
