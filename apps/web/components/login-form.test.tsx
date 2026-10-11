import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { ApiError } from "@/lib/api";
import { AuthContext, type AuthContextValue } from "@/lib/auth/auth-context";
import { LoginForm } from "./login-form";

const replace = vi.fn();
let search = "";
vi.mock("next/navigation", () => ({
  useRouter: () => ({ replace }),
  useSearchParams: () => new URLSearchParams(search),
}));

const renderForm = (value: Partial<AuthContextValue>) =>
  render(
    <AuthContext.Provider value={{ status: "anonymous", user: null, login: vi.fn(), logout: vi.fn(), ...value }}>
      <LoginForm />
    </AuthContext.Provider>,
  );

async function fillAndSubmit() {
  await userEvent.type(screen.getByLabelText("Email"), "admin@example.test");
  await userEvent.type(screen.getByLabelText("Password"), "hunter2hunter2");
  await userEvent.click(screen.getByRole("button", { name: /sign in|signing in/i }));
}

beforeEach(() => {
  replace.mockClear();
  search = "";
});

describe("LoginForm", () => {
  it("has labelled fields and submits the credentials", async () => {
    const login = vi.fn(async () => undefined);
    renderForm({ login });
    await fillAndSubmit();
    expect(login).toHaveBeenCalledWith("admin@example.test", "hunter2hunter2");
  });

  it("shows the API's error message in an aria-live region", async () => {
    const login = vi.fn(async () => {
      throw new ApiError(401, "HTTP_401", "Invalid credentials");
    });
    renderForm({ login });
    await fillAndSubmit();

    const message = await screen.findByText("Invalid credentials");
    expect(message.closest("[aria-live]")).toHaveAttribute("aria-live", "assertive");
    // The form is usable again for another attempt.
    expect(screen.getByRole("button", { name: "Sign in" })).toBeEnabled();
  });

  it("disables the submit button while the request is pending", async () => {
    let finish!: () => void;
    const login = vi.fn(() => new Promise<void>((resolve) => (finish = resolve)));
    renderForm({ login });
    await fillAndSubmit();

    const button = screen.getByRole("button", { name: "Signing in…" });
    expect(button).toBeDisabled();
    await userEvent.click(button);
    expect(login).toHaveBeenCalledTimes(1); // no double submit

    finish();
    await waitFor(() => expect(login).toHaveBeenCalledTimes(1));
  });

  it("goes to ?next once authenticated, but never to an external URL", () => {
    search = "next=%2Fadmin%2Fusers";
    renderForm({ status: "authenticated", user: { id: "1", email: "a@b.test", name: "A", role: "ADMIN" } });
    expect(replace).toHaveBeenCalledWith("/admin/users");

    replace.mockClear();
    search = "next=https%3A%2F%2Fevil.test";
    renderForm({ status: "authenticated", user: { id: "1", email: "a@b.test", name: "A", role: "ADMIN" } });
    expect(replace).toHaveBeenCalledWith("/admin");
  });
});
