import { act, render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { StrictMode } from "react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
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

const healthCheck = vi.fn();

beforeEach(() => {
  replace.mockClear();
  search = "";
  healthCheck.mockReset();
  healthCheck.mockResolvedValue(new Response("{}", { status: 200 }));
  vi.stubGlobal("fetch", healthCheck); // the form's background warm-up must never hit the network in tests
});

afterEach(() => {
  vi.unstubAllGlobals();
  vi.useRealTimers();
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

describe("LoginForm: cold-start warm-up", () => {
  it("fires GET /api/health once when the page opens, without waiting for it", async () => {
    healthCheck.mockReturnValue(new Promise(() => {})); // never answers: the form must not care
    renderForm({});
    expect(healthCheck).toHaveBeenCalledTimes(1);
    expect(healthCheck).toHaveBeenCalledWith("/api/health", expect.objectContaining({ cache: "no-store" }));
    // The form is usable right away.
    expect(screen.getByRole("button", { name: "Sign in" })).toBeEnabled();
  });

  it("still fires exactly once under React StrictMode (effects run twice in development)", () => {
    render(
      <StrictMode>
        <AuthContext.Provider value={{ status: "anonymous", user: null, login: vi.fn(), logout: vi.fn() }}>
          <LoginForm />
        </AuthContext.Provider>
      </StrictMode>,
    );
    expect(healthCheck).toHaveBeenCalledTimes(1);
  });

  it("ignores a failing warm-up: no error is shown", async () => {
    healthCheck.mockRejectedValue(new TypeError("Failed to fetch"));
    renderForm({});
    await act(async () => {});
    expect(screen.getByLabelText("Email")).toBeInTheDocument();
    expect(screen.queryByText(/wrong|problem|error/i)).not.toBeInTheDocument();
  });
});

describe("LoginForm: waking up the server", () => {
  const WAKING = "Waking up the server…";

  async function submitWith(login: () => Promise<void>) {
    // shouldAdvanceTime lets Testing Library's own setTimeout(0) waits complete; the 5 s jump is manual.
    vi.useFakeTimers({ shouldAdvanceTime: true });
    const user = userEvent.setup({ advanceTimers: (ms) => void vi.advanceTimersByTime(ms) });
    renderForm({ login });
    await user.type(screen.getByLabelText("Email"), "admin@example.test");
    await user.type(screen.getByLabelText("Password"), "hunter2hunter2");
    await user.click(screen.getByRole("button", { name: "Sign in" }));
    return user;
  }

  it("appears only after 5 seconds of waiting, in a polite live region under the button", async () => {
    await submitWith(() => new Promise(() => {})); // sign-in never finishes

    expect(screen.getByRole("button", { name: "Signing in…" })).toBeDisabled();
    expect(screen.queryByText(WAKING)).not.toBeInTheDocument();

    // The clock also ticks in real time (see submitWith), so leave a margin around the 5 s threshold.
    await act(async () => void vi.advanceTimersByTime(4000));
    expect(screen.queryByText(WAKING)).not.toBeInTheDocument();

    await act(async () => void vi.advanceTimersByTime(1500));
    const notice = screen.getByText(WAKING);
    expect(notice).toHaveAttribute("role", "status");
    expect(notice).toHaveAttribute("aria-live", "polite");
  });

  it("never appears when sign-in finishes in time", async () => {
    let finish!: () => void;
    await submitWith(() => new Promise<void>((resolve) => (finish = resolve)));

    await act(async () => void vi.advanceTimersByTime(3000));
    await act(async () => finish());
    await act(async () => void vi.advanceTimersByTime(10_000));
    expect(screen.queryByText(WAKING)).not.toBeInTheDocument();
  });

  it("goes away when a slow sign-in fails, and the error is shown instead", async () => {
    let fail!: () => void;
    await submitWith(
      () => new Promise<void>((_, reject) => (fail = () => reject(new ApiError(401, "HTTP_401", "Invalid credentials")))),
    );

    await act(async () => void vi.advanceTimersByTime(6000));
    expect(screen.getByText(WAKING)).toBeInTheDocument();

    await act(async () => fail());
    expect(screen.queryByText(WAKING)).not.toBeInTheDocument();
    expect(screen.getByText("Invalid credentials")).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Sign in" })).toBeEnabled();
  });
});
