"use client";

import { useRouter, useSearchParams } from "next/navigation";
import { useEffect, useId, useRef, useState, type FormEvent } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { ApiError } from "@/lib/api";
import { useAuth } from "@/lib/auth/auth-context";
import { safeNextPath } from "@/lib/safe-next";

// The API runs on a free tier that sleeps when idle; the first request after a nap can take close
// to a minute. Wake it up as soon as the login page opens, and say so if signing in is slow.
const WAKING_NOTICE_AFTER_MS = 5000;

export function LoginForm() {
  const { status, login } = useAuth();
  const router = useRouter();
  const next = safeNextPath(useSearchParams().get("next"));
  const id = useId();
  const emailId = `${id}-email`;
  const passwordId = `${id}-password`;
  const errorId = `${id}-error`;

  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [pending, setPending] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [waking, setWaking] = useState(false);
  const wakingTimer = useRef<ReturnType<typeof setTimeout> | undefined>(undefined);
  const warmedUp = useRef(false);

  // Fire-and-forget warm-up: no await, errors ignored. The ref keeps it to one request even when
  // React StrictMode runs effects twice in development.
  useEffect(() => {
    if (warmedUp.current) return;
    warmedUp.current = true;
    void fetch("/api/health", { cache: "no-store" }).catch(() => undefined);
  }, []);

  useEffect(() => () => clearTimeout(wakingTimer.current), []);

  // Already signed in (or just signed in): leave the login page.
  useEffect(() => {
    if (status === "authenticated") router.replace(next);
  }, [status, next, router]);

  async function onSubmit(event: FormEvent) {
    event.preventDefault();
    if (pending) return;
    setPending(true);
    setError(null);
    wakingTimer.current = setTimeout(() => setWaking(true), WAKING_NOTICE_AFTER_MS);
    try {
      await login(email, password);
    } catch (e) {
      setError(e instanceof ApiError ? e.message : "Something went wrong. Please try again.");
      setPending(false);
    } finally {
      clearTimeout(wakingTimer.current);
      setWaking(false);
    }
    // On success the status effect above navigates away.
  }

  return (
    <form onSubmit={onSubmit} aria-describedby={errorId} className="space-y-4">
      <div>
        <label htmlFor={emailId} className="mb-1 block text-sm font-medium">
          Email
        </label>
        <Input
          id={emailId}
          type="email"
          name="email"
          autoComplete="username"
          required
          value={email}
          onChange={(e) => setEmail(e.target.value)}
        />
      </div>
      <div>
        <label htmlFor={passwordId} className="mb-1 block text-sm font-medium">
          Password
        </label>
        <Input
          id={passwordId}
          type="password"
          name="password"
          autoComplete="current-password"
          required
          value={password}
          onChange={(e) => setPassword(e.target.value)}
        />
      </div>

      {/* Always rendered so assistive tech announces the message when it appears. */}
      <div id={errorId} aria-live="assertive" className="min-h-5 text-sm text-red-700">
        {error}
      </div>

      <Button type="submit" disabled={pending} className="w-full disabled:opacity-60">
        {pending ? "Signing in…" : "Sign in"}
      </Button>
      {/* Always rendered so the message is announced when it appears. */}
      <p role="status" aria-live="polite" className="min-h-5 text-sm text-slate-600">
        {waking ? "Waking up the server…" : ""}
      </p>
    </form>
  );
}
