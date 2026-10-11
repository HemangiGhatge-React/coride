"use client";

import { QueryClientProvider } from "@tanstack/react-query";
import { useState, type ReactNode } from "react";
import { AuthProvider } from "@/lib/auth/auth-context";
import { makeQueryClient } from "@/lib/query";
import { ConnectionNotice } from "./connection-notice";

export function Providers({ children }: { children: ReactNode }) {
  const [queryClient] = useState(makeQueryClient);
  return (
    <QueryClientProvider client={queryClient}>
      <AuthProvider>
        <ConnectionNotice />
        {children}
      </AuthProvider>
    </QueryClientProvider>
  );
}
