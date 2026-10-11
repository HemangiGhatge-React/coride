export function Forbidden() {
  return (
    <main className="mx-auto max-w-xl p-6">
      <h1 className="text-xl font-semibold">Your account doesn&apos;t have admin access</h1>
      <p className="mt-2 text-sm text-slate-600">
        You are signed in, but this area is only for administrators. Log out and sign in with an admin account,
        or ask an administrator to change your role.
      </p>
    </main>
  );
}
