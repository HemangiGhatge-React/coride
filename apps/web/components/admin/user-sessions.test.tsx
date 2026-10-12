import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { render, screen, waitFor, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { ApiError, listUserSessions, revokeAllSessions, revokeSession, type UserSession } from "@/lib/api";
import { formatDate, formatDateTime } from "@/lib/format";
import { UserSessions } from "./user-sessions";

vi.mock("@/lib/api", async (importOriginal) => ({
  ...(await importOriginal<typeof import("@/lib/api")>()),
  listUserSessions: vi.fn(),
  revokeSession: vi.fn(),
  revokeAllSessions: vi.fn(),
}));

const list = vi.mocked(listUserSessions);
const revokeOne = vi.mocked(revokeSession);
const revokeAll = vi.mocked(revokeAllSessions);

const DAY = 24 * 3600 * 1000;
const CHROME = "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/130.0.0.0 Safari/537.36";
const IPHONE =
  "Mozilla/5.0 (iPhone; CPU iPhone OS 18_0 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/18.0 Mobile/15E148 Safari/604.1";

const session = (n: number, over: Partial<UserSession> = {}): UserSession => ({
  familyId: `fam-${n}`,
  createdAt: new Date(Date.now() - 9 * DAY).toISOString(),
  lastUsedAt: new Date(Date.now() - 2 * DAY).toISOString(),
  userAgent: CHROME,
  ...over,
});

const three = [
  session(1),
  session(2, { userAgent: IPHONE, lastUsedAt: new Date(Date.now() - 3 * 3600 * 1000).toISOString() }),
  session(3, { userAgent: "CoRide/1.0 (Android 15; Pixel 8)", lastUsedAt: new Date(Date.now() - 5 * DAY).toISOString() }),
];

function renderSessions(props: { isOwnProfile?: boolean } = {}) {
  const client = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  const invalidate = vi.spyOn(client, "invalidateQueries");
  render(
    <QueryClientProvider client={client}>
      <UserSessions userId="u1" userName="Kari Nordmann" isOwnProfile={props.isOwnProfile ?? false} />
    </QueryClientProvider>,
  );
  return { client, invalidate };
}

const everywhere = () => screen.getByRole("button", { name: "Sign out everywhere" });

beforeEach(() => {
  list.mockReset();
  revokeOne.mockReset();
  revokeAll.mockReset();
  list.mockResolvedValue(three);
  revokeOne.mockResolvedValue(undefined);
  revokeAll.mockResolvedValue(undefined);
});

describe("UserSessions: list", () => {
  it("shows a device label, relative last-used time with the exact time in a tooltip, and the signed-in date", async () => {
    renderSessions();
    const items = await screen.findAllByRole("listitem");
    expect(items).toHaveLength(3);

    const first = within(items[0]);
    expect(first.getByText("Chrome on Windows")).toBeInTheDocument();
    const lastUsed = first.getByText("2 days ago");
    expect(lastUsed.tagName).toBe("TIME");
    expect(lastUsed).toHaveAttribute("title", formatDateTime(three[0].lastUsedAt!));
    expect(lastUsed).toHaveAttribute("datetime", three[0].lastUsedAt!);
    expect(first.getByText(formatDate(three[0].createdAt))).toBeInTheDocument();

    expect(within(items[1]).getByText("Safari on iPhone")).toBeInTheDocument();
    expect(within(items[1]).getByText("3 hours ago")).toBeInTheDocument();
    expect(within(items[2]).getByText("CoRide Android app")).toBeInTheDocument();
  });

  it("labels sessions without a user agent or last-used time (old sessions) gracefully", async () => {
    list.mockResolvedValue([session(9, { userAgent: null, lastUsedAt: null })]);
    renderSessions();
    const item = within(await screen.findByRole("listitem"));
    expect(item.getByText("Unknown device")).toBeInTheDocument();
    expect(item.getByText("Last used: unknown")).toBeInTheDocument();
  });

  it("explains what revoking does, honestly, under the heading", async () => {
    renderSessions();
    await screen.findAllByRole("listitem");
    expect(
      screen.getByText("Revoking ends the session's refresh token immediately. Access already issued stays valid for up to 15 minutes."),
    ).toBeInTheDocument();
  });

  it("shows 'No active sessions.' and disables Sign out everywhere when there are none", async () => {
    list.mockResolvedValue([]);
    renderSessions();
    expect(await screen.findByText("No active sessions.")).toBeInTheDocument();
    expect(everywhere()).toBeDisabled();
  });

  it("shows a loading state, and an error with Try again", async () => {
    list.mockRejectedValueOnce(new ApiError(500, "HTTP_500", "Internal server error"));
    renderSessions();
    expect(screen.getByRole("status", { name: "Loading sessions" })).toBeInTheDocument();
    const alert = await screen.findByRole("alert");
    expect(alert).toHaveTextContent("Could not load sessions: Internal server error");
    await userEvent.click(within(alert).getByRole("button", { name: "Try again" }));
    expect(await screen.findAllByRole("listitem")).toHaveLength(3);
  });

  it("shows a compact notice, not the data, when the API says FORBIDDEN", async () => {
    list.mockRejectedValue(new ApiError(403, "FORBIDDEN", "no"));
    renderSessions();
    expect(await screen.findByRole("alert")).toHaveTextContent("Your account doesn't have admin access.");
    expect(screen.queryByRole("listitem")).not.toBeInTheDocument();
    expect(everywhere()).toBeDisabled();
  });
});

describe("UserSessions: revoking one session", () => {
  it("confirms with the device named, calls the API only after Confirm, and cancelling does nothing", async () => {
    renderSessions();
    await screen.findAllByRole("listitem");

    await userEvent.click(screen.getByRole("button", { name: /Revoke session: Chrome on Windows/ }));
    const dialog = screen.getByRole("dialog", { name: "Sign Kari Nordmann out of Chrome on Windows?" });
    expect(dialog).toHaveAccessibleDescription(/ends the session's refresh token immediately/);
    expect(dialog).not.toHaveAccessibleDescription(/your own account/);
    expect(revokeOne).not.toHaveBeenCalled();

    await userEvent.click(within(dialog).getByRole("button", { name: "Cancel" }));
    expect(screen.queryByRole("dialog")).not.toBeInTheDocument();
    expect(revokeOne).not.toHaveBeenCalled();
    expect(screen.getByRole("button", { name: /Revoke session: Chrome on Windows/ })).toHaveFocus(); // back on the trigger
  });

  it("is not optimistic: waits for the server, then refetches everything and announces 'Session revoked'", async () => {
    let finish!: () => void;
    revokeOne.mockImplementation(() => new Promise<undefined>((resolve) => (finish = () => resolve(undefined))));
    const { invalidate } = renderSessions();
    await screen.findAllByRole("listitem");

    await userEvent.click(screen.getByRole("button", { name: /Revoke session: Chrome on Windows/ }));
    await userEvent.click(screen.getByRole("button", { name: "Revoke session" }));

    // The server has not answered: the row is still there, the dialog is busy, nothing was refetched.
    expect(revokeOne).toHaveBeenCalledWith(expect.anything(), "fam-1");
    expect(screen.getByRole("button", { name: "Revoking…" })).toBeDisabled();
    expect(screen.getAllByRole("listitem")).toHaveLength(3);
    expect(invalidate).not.toHaveBeenCalled();
    expect(list).toHaveBeenCalledTimes(1);

    list.mockResolvedValue(three.slice(1)); // the next read no longer has it
    finish();

    expect(await screen.findByText("Session revoked")).toHaveAttribute("role", "status");
    await waitFor(() => expect(invalidate).toHaveBeenCalledWith({ queryKey: ["admin", "users"] }));
    await waitFor(() => expect(screen.getAllByRole("listitem")).toHaveLength(2));
    expect(list).toHaveBeenCalledTimes(2);
    expect(screen.queryByRole("dialog")).not.toBeInTheDocument();
    expect(screen.getByRole("heading", { name: "Active sessions" })).toHaveFocus(); // the row is gone, so focus lands here
  });

  it("the whole users query family is refreshed, so the list and the detail's session count update too", async () => {
    const { client } = renderSessions();
    await screen.findAllByRole("listitem");
    const detailKey = ["admin", "users", "detail", "u1"];
    const listKey = ["admin", "users", "list", { search: "", role: "ALL", page: 1 }];
    client.setQueryData(detailKey, { activeSessionCount: 3 });
    client.setQueryData(listKey, { items: [], total: 0 });

    await userEvent.click(screen.getByRole("button", { name: /Revoke session: Chrome on Windows/ }));
    await userEvent.click(screen.getByRole("button", { name: "Revoke session" }));
    await screen.findByText("Session revoked");

    expect(client.getQueryState(detailKey)?.isInvalidated).toBe(true);
    expect(client.getQueryState(listKey)?.isInvalidated).toBe(true);
  });

  it("a session that had already ended gets a plain message and the list is refreshed", async () => {
    revokeOne.mockRejectedValue(new ApiError(404, "SESSION_NOT_FOUND", "Session not found"));
    renderSessions();
    await screen.findAllByRole("listitem");
    list.mockResolvedValue(three.slice(1));

    await userEvent.click(screen.getByRole("button", { name: /Revoke session: Chrome on Windows/ }));
    await userEvent.click(screen.getByRole("button", { name: "Revoke session" }));

    expect(await screen.findByRole("alert")).toHaveTextContent("That session had already ended.");
    await waitFor(() => expect(screen.getAllByRole("listitem")).toHaveLength(2));
  });

  it("other failures are shown next to the list and the dialog closes", async () => {
    revokeOne.mockRejectedValue(new ApiError(0, "NETWORK_ERROR", "Cannot reach the server"));
    renderSessions();
    await screen.findAllByRole("listitem");
    await userEvent.click(screen.getByRole("button", { name: /Revoke session: Chrome on Windows/ }));
    await userEvent.click(screen.getByRole("button", { name: "Revoke session" }));

    expect(await screen.findByRole("alert")).toHaveTextContent("Can't reach the server");
    expect(screen.queryByRole("dialog")).not.toBeInTheDocument();
    expect(screen.getAllByRole("listitem")).toHaveLength(3);
  });
});

describe("UserSessions: Sign out everywhere", () => {
  it("states the count in the dialog, calls revoke-all after Confirm, refetches and announces", async () => {
    const { invalidate } = renderSessions();
    await screen.findAllByRole("listitem");

    await userEvent.click(everywhere());
    const dialog = screen.getByRole("dialog", { name: "End all 3 sessions for Kari Nordmann?" });
    expect(revokeAll).not.toHaveBeenCalled();

    list.mockResolvedValue([]);
    await userEvent.click(within(dialog).getByRole("button", { name: "End all sessions" }));

    expect(revokeAll).toHaveBeenCalledWith(expect.anything(), "u1");
    expect(await screen.findByText("All sessions ended")).toHaveAttribute("role", "status");
    await waitFor(() => expect(invalidate).toHaveBeenCalledWith({ queryKey: ["admin", "users"] }));
    expect(await screen.findByText("No active sessions.")).toBeInTheDocument();
    expect(everywhere()).toBeDisabled();
  });

  it("words the dialog correctly for a single session", async () => {
    list.mockResolvedValue([three[0]]);
    renderSessions();
    await screen.findAllByRole("listitem");
    await userEvent.click(everywhere());
    const dialog = screen.getByRole("dialog", { name: "End the active session for Kari Nordmann?" });
    expect(within(dialog).getByRole("button", { name: "End session" })).toBeInTheDocument();
  });

  it("Esc closes the dialog without calling the API, and focus returns to the button", async () => {
    renderSessions();
    await screen.findAllByRole("listitem");
    await userEvent.click(everywhere());
    await userEvent.keyboard("{Escape}");
    expect(screen.queryByRole("dialog")).not.toBeInTheDocument();
    expect(everywhere()).toHaveFocus();
    expect(revokeAll).not.toHaveBeenCalled();
  });
});

describe("UserSessions: your own profile", () => {
  it("warns in both dialogs that you may be signed out on this device too", async () => {
    renderSessions({ isOwnProfile: true });
    await screen.findAllByRole("listitem");

    await userEvent.click(screen.getByRole("button", { name: /Revoke session: Chrome on Windows/ }));
    expect(screen.getByRole("dialog")).toHaveAccessibleDescription(/your own account, so you may be signed out on this device too/);
    await userEvent.click(screen.getByRole("button", { name: "Cancel" }));

    await userEvent.click(everywhere());
    expect(screen.getByRole("dialog", { name: "End all 3 sessions for Kari Nordmann?" })).toHaveAccessibleDescription(
      /your own account, so you may be signed out on this device too/,
    );
  });

  it("does not show the warning for somebody else's sessions", async () => {
    renderSessions({ isOwnProfile: false });
    await screen.findAllByRole("listitem");
    await userEvent.click(everywhere());
    expect(screen.getByRole("dialog")).not.toHaveAccessibleDescription(/your own account/);
  });
});
