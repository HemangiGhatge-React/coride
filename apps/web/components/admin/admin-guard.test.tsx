import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import type { ReactNode } from "react";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { AuthContext, type AuthContextValue } from "@/lib/auth/auth-context";
import { AdminGuard } from "./admin-guard";

const replace = vi.fn();
vi.mock("next/navigation", () => ({
  useRouter: () => ({ replace }),
  usePathname: () => "/admin/users",
}));

const logout = vi.fn(async () => undefined);
const renderWith = (value: Partial<AuthContextValue>, children: ReactNode = <p>secret admin content</p>) =>
  render(
    <AuthContext.Provider value={{ status: "loading", user: null, login: vi.fn(), logout, ...value }}>
      <AdminGuard>{children}</AdminGuard>
    </AuthContext.Provider>,
  );

const person = (role: "ADMIN" | "DRIVER") => ({ id: "u1", email: `${role.toLowerCase()}@example.test`, name: "P", role });

beforeEach(() => {
  replace.mockClear();
  logout.mockClear();
});

describe("AdminGuard", () => {
  it("a signed-in non-ADMIN sees the 403 page, not the admin content, and is not redirected", () => {
    renderWith({ status: "authenticated", user: person("DRIVER") });

    expect(screen.getByRole("heading", { name: "Your account doesn't have admin access" })).toBeInTheDocument();
    expect(screen.queryByText("secret admin content")).not.toBeInTheDocument();
    expect(replace).not.toHaveBeenCalled(); // no redirect loop
    // They can still see who they are and log out to switch accounts.
    expect(screen.getByText("driver@example.test")).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Log out" })).toBeInTheDocument();
  });

  it("an ADMIN sees the content with their email and a Log out button", async () => {
    renderWith({ status: "authenticated", user: person("ADMIN") });

    expect(screen.getByText("secret admin content")).toBeInTheDocument();
    expect(screen.queryByText(/doesn't have admin access/)).not.toBeInTheDocument();
    expect(screen.getByText("admin@example.test")).toBeInTheDocument();

    await userEvent.click(screen.getByRole("button", { name: "Log out" }));
    expect(logout).toHaveBeenCalledTimes(1);
  });

  it("shows a skeleton while loading, with no content and no redirect", () => {
    renderWith({ status: "loading" });

    expect(screen.getByRole("status", { name: "Loading" })).toBeInTheDocument();
    expect(screen.queryByText("secret admin content")).not.toBeInTheDocument();
    expect(replace).not.toHaveBeenCalled();
  });

  it("redirects an anonymous visitor to /login with the page they wanted as ?next", () => {
    renderWith({ status: "anonymous" });

    expect(replace).toHaveBeenCalledTimes(1);
    expect(replace).toHaveBeenCalledWith("/login?next=%2Fadmin%2Fusers");
    expect(screen.queryByText("secret admin content")).not.toBeInTheDocument();
  });
});
