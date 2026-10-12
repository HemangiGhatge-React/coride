import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { render, screen, waitFor, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { ApiError, getAdminUser, listUserSessions, updateUserRole, type AdminUser } from "@/lib/api";
import { AuthContext } from "@/lib/auth/auth-context";
import { formatDate } from "@/lib/format";
import { fakeNavigation } from "@/lib/test-utils/navigation";
import { UserDetail } from "./user-detail";

vi.mock("next/navigation", async () => (await import("@/lib/test-utils/navigation")).navigationModule);
vi.mock("@/lib/api", async (importOriginal) => ({
  ...(await importOriginal<typeof import("@/lib/api")>()),
  getAdminUser: vi.fn(),
  updateUserRole: vi.fn(),
  listUserSessions: vi.fn(),
}));

const getUser = vi.mocked(getAdminUser);
const setRole = vi.mocked(updateUserRole);

const ME = "11111111-1111-4111-8111-111111111111";
const KARI = "22222222-2222-4222-8222-222222222222";

const kari = (over: Partial<AdminUser> = {}): AdminUser => ({
  id: KARI,
  email: "kari.nordmann@demo.coride.no",
  name: "Kari Nordmann",
  role: "DRIVER",
  createdAt: "2026-09-14T08:30:00.000Z",
  activeSessionCount: 3,
  ...over,
});

function renderDetail(userId: string = KARI) {
  fakeNavigation.params = { id: userId };
  const client = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  const invalidate = vi.spyOn(client, "invalidateQueries");
  render(
    <QueryClientProvider client={client}>
      <AuthContext.Provider
        value={{
          status: "authenticated",
          user: { id: ME, email: "me@example.test", name: "Me", role: "ADMIN" },
          login: vi.fn(),
          logout: vi.fn(),
        }}
      >
        <UserDetail />
      </AuthContext.Provider>
    </QueryClientProvider>,
  );
  return { client, invalidate };
}

const roleSelect = () => screen.getByLabelText("Role");
const trigger = () => screen.getByRole("button", { name: "Change role" });

beforeEach(() => {
  vi.mocked(listUserSessions).mockResolvedValue([]); // the sessions section has its own tests
  getUser.mockReset();
  setRole.mockReset();
  getUser.mockResolvedValue(kari());
  fakeNavigation.reset(`/admin/users/${KARI}`);
});

describe("UserDetail: page", () => {
  it("shows name, email, role badge, created date, active session count and the sessions placeholder", async () => {
    renderDetail();
    expect(await screen.findByRole("heading", { level: 1, name: "Kari Nordmann" })).toBeInTheDocument();
    expect(screen.getByText("kari.nordmann@demo.coride.no")).toBeInTheDocument();
    expect(screen.getByText(formatDate(kari().createdAt))).toBeInTheDocument(); // e.g. "14 Sept 2026"
    expect(screen.getByText("Active sessions", { selector: "dt" }).nextElementSibling).toHaveTextContent("3");
    expect(screen.getByRole("heading", { level: 2, name: "Active sessions" })).toBeInTheDocument();
    expect(getUser).toHaveBeenCalledWith(expect.anything(), KARI);
  });

  it("the back link keeps the table's query parameters, and ignores anything it doesn't know", async () => {
    fakeNavigation.reset(`/admin/users/${KARI}?from=${encodeURIComponent("?search=kari&role=ADMIN&page=2&evil=https://x.test")}`);
    renderDetail();
    const link = await screen.findByRole("link", { name: "Back to users" });
    expect(link).toHaveAttribute("href", "/admin/users?search=kari&role=ADMIN&page=2");
  });

  it("the back link falls back to the plain table without ?from", async () => {
    renderDetail();
    expect(await screen.findByRole("link", { name: "Back to users" })).toHaveAttribute("href", "/admin/users");
  });

  it("shows a loading state, then 'User not found' with a way back for a 404", async () => {
    getUser.mockRejectedValue(new ApiError(404, "USER_NOT_FOUND", "User not found"));
    renderDetail();
    expect(screen.getByRole("status", { name: "Loading user" })).toBeInTheDocument();
    expect(await screen.findByRole("heading", { name: "User not found" })).toBeInTheDocument();
    expect(screen.getByRole("link", { name: "Back to users" })).toBeInTheDocument();
  });

  it("shows an error with Try again for other failures", async () => {
    getUser.mockRejectedValueOnce(new ApiError(500, "HTTP_500", "Internal server error"));
    renderDetail();
    const alert = await screen.findByRole("alert");
    expect(alert).toHaveTextContent("Could not load this user: Internal server error");
    await userEvent.click(within(alert).getByRole("button", { name: "Try again" }));
    expect(await screen.findByRole("heading", { name: "Kari Nordmann" })).toBeInTheDocument();
  });

  it("shows the 403 page when the API says FORBIDDEN", async () => {
    getUser.mockRejectedValue(new ApiError(403, "FORBIDDEN", "You do not have permission"));
    renderDetail();
    expect(await screen.findByRole("heading", { name: "Your account doesn't have admin access" })).toBeInTheDocument();
  });
});

describe("UserDetail: changing the role", () => {
  it("asks for confirmation that states exactly what changes, and calls the API only after Confirm", async () => {
    renderDetail();
    await screen.findByRole("heading", { name: "Kari Nordmann" });
    expect(trigger()).toBeDisabled(); // nothing chosen yet

    await userEvent.selectOptions(roleSelect(), "ADMIN");
    await userEvent.click(trigger());

    const dialog = screen.getByRole("dialog", { name: "Make Kari Nordmann an Admin?" });
    expect(dialog).toHaveAccessibleDescription(/Their role changes from Driver to Admin/);
    expect(setRole).not.toHaveBeenCalled();

    // Cancel does nothing.
    await userEvent.click(within(dialog).getByRole("button", { name: "Cancel" }));
    expect(setRole).not.toHaveBeenCalled();
    expect(screen.queryByRole("dialog")).not.toBeInTheDocument();
  });

  it("words a demotion correctly ('a Driver')", async () => {
    getUser.mockResolvedValue(kari({ role: "ADMIN" }));
    renderDetail();
    await screen.findByRole("heading", { name: "Kari Nordmann" });
    await userEvent.selectOptions(roleSelect(), "DRIVER");
    await userEvent.click(trigger());
    const dialog = screen.getByRole("dialog", { name: "Make Kari Nordmann a Driver?" });
    expect(dialog).toHaveAccessibleDescription(/lose access to the admin area/);
    expect(within(dialog).getByRole("button", { name: "Make Driver" })).toBeInTheDocument();
  });

  it("is not optimistic: the old role stays until the server answers, then both queries are invalidated", async () => {
    let answer!: (u: AdminUser) => void;
    setRole.mockImplementation(() => new Promise((resolve) => (answer = resolve as (u: AdminUser) => void)));
    const { invalidate } = renderDetail();
    await screen.findByRole("heading", { name: "Kari Nordmann" });

    await userEvent.selectOptions(roleSelect(), "ADMIN");
    await userEvent.click(trigger());
    await userEvent.click(screen.getByRole("button", { name: "Make Admin" }));

    // Waiting for the server: the dialog is still open and busy, the badge still says Driver.
    expect(setRole).toHaveBeenCalledWith(expect.anything(), KARI, "ADMIN");
    expect(screen.getByRole("button", { name: "Changing…" })).toBeDisabled();
    expect(screen.getByRole("button", { name: "Cancel" })).toBeDisabled();
    const header = screen.getByRole("heading", { level: 1 }).parentElement as HTMLElement;
    expect(within(header).getByText("Driver")).toBeInTheDocument();
    expect(invalidate).not.toHaveBeenCalled();

    // The server confirms; the next read of the user already has the new role.
    getUser.mockResolvedValue(kari({ role: "ADMIN" }));
    answer(kari({ role: "ADMIN" }));

    expect(await screen.findByText("Kari Nordmann is now an Admin.")).toHaveAttribute("role", "status");
    await waitFor(() => expect(invalidate).toHaveBeenCalledWith({ queryKey: ["admin", "users"] }));
    expect(screen.queryByRole("dialog")).not.toBeInTheDocument();
    expect(within(header).getByText("Admin")).toBeInTheDocument();
    await waitFor(() => expect(getUser).toHaveBeenCalledTimes(2)); // the detail was refetched
    expect(roleSelect()).toHaveValue("ADMIN");
    expect(roleSelect()).toHaveFocus(); // the trigger is disabled now, so focus goes to the select
  });

  it("success also refreshes the users list queries (prefix invalidation)", async () => {
    setRole.mockResolvedValue(kari({ role: "ADMIN" }));
    const { client } = renderDetail();
    await screen.findByRole("heading", { name: "Kari Nordmann" });

    // A cached list, as if the admin had come from the table.
    client.setQueryData(["admin", "users", "list", { search: "", role: "ALL", page: 1 }], { items: [], total: 0 });
    await userEvent.selectOptions(roleSelect(), "ADMIN");
    await userEvent.click(trigger());
    await userEvent.click(screen.getByRole("button", { name: "Make Admin" }));

    await screen.findByText("Kari Nordmann is now an Admin.");
    await waitFor(() =>
      expect(client.getQueryState(["admin", "users", "list", { search: "", role: "ALL", page: 1 }])?.isInvalidated).toBe(true),
    );
  });

  it("LAST_ADMIN shows 'At least one admin must remain.' next to the control and keeps the page usable", async () => {
    getUser.mockResolvedValue(kari({ role: "ADMIN" }));
    setRole.mockRejectedValue(new ApiError(409, "LAST_ADMIN", "This would leave the system without an administrator"));
    renderDetail();
    await screen.findByRole("heading", { name: "Kari Nordmann" });

    await userEvent.selectOptions(roleSelect(), "DRIVER");
    await userEvent.click(trigger());
    await userEvent.click(screen.getByRole("button", { name: "Make Driver" }));

    expect(await screen.findByRole("alert")).toHaveTextContent("At least one admin must remain.");
    expect(screen.queryByRole("dialog")).not.toBeInTheDocument();
    expect(trigger()).toHaveFocus(); // back on the control that opened the dialog
    expect(roleSelect()).toHaveAccessibleDescription("At least one admin must remain.");
    // The stale error goes away as soon as another choice is made.
    await userEvent.selectOptions(roleSelect(), "ADMIN");
    expect(screen.queryByRole("alert")).not.toBeInTheDocument();
  });

  it("CANNOT_CHANGE_OWN_ROLE from the server is shown in plain words (the server check still applies)", async () => {
    setRole.mockRejectedValue(new ApiError(409, "CANNOT_CHANGE_OWN_ROLE", "You cannot change your own role"));
    renderDetail();
    await screen.findByRole("heading", { name: "Kari Nordmann" });

    await userEvent.selectOptions(roleSelect(), "ADMIN");
    await userEvent.click(trigger());
    await userEvent.click(screen.getByRole("button", { name: "Make Admin" }));

    expect(await screen.findByRole("alert")).toHaveTextContent("You can't change your own role.");
  });

  it("FORBIDDEN from the role change replaces the page with the 403 view", async () => {
    setRole.mockRejectedValue(new ApiError(403, "FORBIDDEN", "You do not have permission"));
    renderDetail();
    await screen.findByRole("heading", { name: "Kari Nordmann" });

    await userEvent.selectOptions(roleSelect(), "ADMIN");
    await userEvent.click(trigger());
    await userEvent.click(screen.getByRole("button", { name: "Make Admin" }));

    expect(await screen.findByRole("heading", { name: "Your account doesn't have admin access" })).toBeInTheDocument();
  });

  it("a network failure is explained and the dialog closes so the admin can retry", async () => {
    setRole.mockRejectedValue(new ApiError(0, "NETWORK_ERROR", "Cannot reach the server"));
    renderDetail();
    await screen.findByRole("heading", { name: "Kari Nordmann" });
    await userEvent.selectOptions(roleSelect(), "ADMIN");
    await userEvent.click(trigger());
    await userEvent.click(screen.getByRole("button", { name: "Make Admin" }));
    expect(await screen.findByRole("alert")).toHaveTextContent("Can't reach the server");
    expect(trigger()).toBeEnabled();
  });
});

describe("UserDetail: your own profile", () => {
  it("disables the role controls and explains why", async () => {
    getUser.mockResolvedValue(kari({ id: ME, name: "Me Myself", email: "me@example.test", role: "ADMIN" }));
    renderDetail(ME);
    await screen.findByRole("heading", { name: "Me Myself" });

    expect(roleSelect()).toBeDisabled();
    expect(trigger()).toBeDisabled();
    expect(screen.getByText("You can't change your own role.")).toBeInTheDocument();
    expect(roleSelect()).toHaveAccessibleDescription("You can't change your own role.");
    expect(setRole).not.toHaveBeenCalled();
  });
});

describe("UserDetail: confirmation dialog focus", () => {
  it("returns focus to the Change role button when the dialog is cancelled or closed with Esc", async () => {
    renderDetail();
    await screen.findByRole("heading", { name: "Kari Nordmann" });
    await userEvent.selectOptions(roleSelect(), "ADMIN");

    await userEvent.click(trigger());
    expect(screen.getByRole("button", { name: "Cancel" })).toHaveFocus(); // safe default for a consequential action
    await userEvent.click(screen.getByRole("button", { name: "Cancel" }));
    expect(trigger()).toHaveFocus();

    await userEvent.click(trigger());
    await userEvent.keyboard("{Escape}");
    expect(screen.queryByRole("dialog")).not.toBeInTheDocument();
    expect(trigger()).toHaveFocus();
    expect(setRole).not.toHaveBeenCalled();
  });

  it("keeps focus inside the dialog while it is open", async () => {
    renderDetail();
    await screen.findByRole("heading", { name: "Kari Nordmann" });
    await userEvent.selectOptions(roleSelect(), "ADMIN");
    await userEvent.click(trigger());

    const dialog = screen.getByRole("dialog");
    for (let i = 0; i < 5; i++) {
      await userEvent.tab();
      expect(dialog).toContainElement(document.activeElement as HTMLElement);
    }
  });
});
