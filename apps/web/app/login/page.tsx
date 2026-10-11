import { Suspense } from "react";
import { LoginForm } from "@/components/login-form";

export default function LoginPage() {
  return (
    <main className="mx-auto w-full max-w-sm p-6 pt-16">
      <h1 className="mb-6 text-2xl font-semibold">Sign in to CoRide admin</h1>
      {/* useSearchParams needs a Suspense boundary during prerendering. */}
      <Suspense>
        <LoginForm />
      </Suspense>
    </main>
  );
}
