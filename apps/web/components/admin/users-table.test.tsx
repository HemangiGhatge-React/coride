import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { render, screen, waitFor, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { ApiError, listAdminUsers, type AdminUser, type AdminUsersList } from "@/lib/api";
import { fakeNavigation } from "@/lib/test-utils/navigation";
import { UsersTable } from "./users-table";

vi.mock("next/navigation", async () => (await import("@/lib/test-utils/navigation")).navigationModule);
vi.mock("@/lib/api", async (importOriginal) => ({
  ...(await importOriginal<typeof import("@/lib/api")>()),
  listAdminUsers: vi.fn(),
}));

const list = vi.mocked(listAdminUsers);

const person = (n: number, over: Partial<AdminUser> = {}): AdminUser => ({
  id: `00000000-0000-4000-8000-${String(n).padStart(12, "0")}`,
  email: `user${n}@demo.coride.no`,
  name: `User ${n}`,
  role: "DRIVER",
  createdAt: "2026-10-01T10:00:00.000Z",
  activeSessionCount: 0,
  ...over,
});

/** A fake API: 23 users, filtered by search/role, paged like the real endpoint. */
const everyone: AdminUser[] = Array.from({ length: 23 }, (_, i) =>
  person(i + 1, { role: i % 5 === 0 ? "ADMIN" : "DRIVER", name: i === 2 ? "Kari Nordmann" : `User ${i + 1}` }),
);
function fakeApi(params: { search?: string; role?: string; page?: number; pageSize?: number }): AdminUsersList {
  const { search = "", role, page = 1, pageSize = 10 } = params;
  const matching = everyone.filter(
    (u) =>
      (!role || u.role === role) &&
      (!search || u.name.toLowerCase().includes(search.toLowerCase()) || u.email.toLowerCase().includes(search.toLowerCase())),
  );
  return { items: matching.slice((page - 1) * pageSize, page * pageSize), total: matching.length, page, pageSize };
}

function renderTable() {
  const client = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  return render(
    <QueryClientProvider client={client}>
      <UsersTable />
    </QueryClientProvider>,
  );
}

const lastCall = () => list.mock.calls[list.mock.calls.length - 1][1];
const searchBox = () => screen.getByRole("searchbox", { name: "Search users" });

beforeEach(() => {
  list.mockReset();
  list.mockImplementation(async (_client, params = {}) => fakeApi(params));
  fakeNavigation.reset("/admin/users");
});

describe("UsersTable: rendering", () => {
  it("renders a real table with caption, column headers and one row per user", async () => {
    fakeNavigation.reset("/admin/users");
    renderTable();

    const table = await screen.findByRole("table", { name: "Users, newest first" });
    const headers = within(table).getAllByRole("columnheader");
    expect(headers.map((h) => h.textContent)).toEqual(["Name", "Email", "Role", "Active sessions", "Created"]);
    expect(headers.every((h) => h.getAttribute("scope") === "col")).toBe(true);

    const rows = within(table).getAllByRole("row").slice(1); // minus the header row
    expect(rows).toHaveLength(10);
    const first = within(rows[0]);
    expect(first.getByRole("link", { name: "User 1" })).toBeInTheDocument();
    expect(first.getByText("user1@demo.coride.no")).toBeInTheDocument();
    expect(first.getByText("Admin")).toBeInTheDocument(); // role badge (user 1 is an admin)
    expect(first.getByText("1 Oct 2026")).toBeInTheDocument();
  });

  it("rows link to the detail page and carry the table's query so Back can restore it", async () => {
    fakeNavigation.reset("/admin/users?role=DRIVER&page=2");
    renderTable();
    const table = await screen.findByRole("table");
    const link = within(table).getAllByRole("link")[0];
    const id = fakeApi({ role: "DRIVER", page: 2 }).items[0].id;
    expect(link).toHaveAttribute("href", `/admin/users/${id}?from=${encodeURIComponent("?role=DRIVER&page=2")}`);
  });

  it("clicking a row (outside the link) opens the user; the link itself is keyboard reachable", async () => {
    renderTable();
    const link = await screen.findByRole("link", { name: "Kari Nordmann" }); // user 3 in the fixture
    await userEvent.tab(); // search box
    await userEvent.tab(); // role select
    await userEvent.tab(); // first row link
    expect(screen.getByRole("link", { name: "User 1" })).toHaveFocus();

    await userEvent.click(within(link.closest("tr") as HTMLElement).getByText("user3@demo.coride.no"));
    expect(fakeNavigation.pushed.at(-1)).toMatch(new RegExp(`^/admin/users/${person(3).id}`));
  });

  it("announces the result count in a polite live region", async () => {
    renderTable();
    const status = await screen.findByText("Showing 1–10 of 23 users");
    expect(status).toHaveAttribute("role", "status");
    expect(status).toHaveAttribute("aria-live", "polite");
  });

  it("labels the controls and shows pagination only when there is more than one page", async () => {
    fakeNavigation.reset("/admin/users?search=kari");
    renderTable();
    await screen.findByRole("link", { name: "Kari Nordmann" });
    expect(screen.getByLabelText("Role")).toBeInTheDocument();
    expect(screen.queryByRole("navigation", { name: "Pagination" })).not.toBeInTheDocument(); // 1 result
  });
});

describe("UsersTable: URL drives the query", () => {
  it("search, role and page in the URL become the API request and the control values", async () => {
    fakeNavigation.reset("/admin/users?search=user&role=DRIVER&page=2");
    renderTable();

    await screen.findByRole("table");
    expect(lastCall()).toEqual({ search: "user", role: "DRIVER", page: 2, pageSize: 10 });
    expect(searchBox()).toHaveValue("user");
    expect(screen.getByLabelText("Role")).toHaveValue("DRIVER");
    expect(screen.getByText(/Page 2 of/)).toBeInTheDocument();
  });

  it("defaults: no filters, page 1, and ignores junk in the URL", async () => {
    fakeNavigation.reset("/admin/users?role=KING&page=-4&search=");
    renderTable();
    await screen.findByRole("table");
    expect(lastCall()).toEqual({ search: undefined, role: undefined, page: 1, pageSize: 10 });
  });

  it("typing updates the URL only after a 300 ms pause, resets to page 1, and uses replace", async () => {
    fakeNavigation.reset("/admin/users?page=2");
    renderTable();
    await screen.findByRole("table");
    const historyBefore = fakeNavigation.historyLength;

    await userEvent.type(searchBox(), "kari");
    expect(fakeNavigation.search).toBe("?page=2"); // not yet: still debouncing

    await waitFor(() => expect(fakeNavigation.search).toBe("?search=kari"), { timeout: 2000 });
    expect(fakeNavigation.pushed).toEqual([]); // replaced, never pushed
    expect(fakeNavigation.replaced).toEqual(["/admin/users?search=kari"]);
    expect(fakeNavigation.historyLength).toBe(historyBefore);

    expect(await screen.findByRole("link", { name: "Kari Nordmann" })).toBeInTheDocument();
    expect(lastCall()).toMatchObject({ search: "kari", page: 1 });
  });

  it("changing the role pushes a history entry, goes back to page 1, and filters", async () => {
    fakeNavigation.reset("/admin/users?page=3");
    renderTable();
    await screen.findByRole("table");

    await userEvent.selectOptions(screen.getByLabelText("Role"), "ADMIN");

    expect(fakeNavigation.pushed).toEqual(["/admin/users?role=ADMIN"]);
    await waitFor(() => expect(lastCall()).toMatchObject({ role: "ADMIN", page: 1 }));
    const rows = within(await screen.findByRole("table")).getAllByRole("row").slice(1);
    expect(rows.every((r) => within(r).queryByText("Admin"))).toBe(true);
  });

  it("a role change made during the search debounce is not reverted by the late search update", async () => {
    renderTable();
    await screen.findByRole("table");

    await userEvent.type(searchBox(), "user");
    await userEvent.selectOptions(screen.getByLabelText("Role"), "DRIVER"); // within the 300 ms window

    await waitFor(() => expect(fakeNavigation.search).toContain("search=user"), { timeout: 2000 });
    expect(new URLSearchParams(fakeNavigation.search).get("role")).toBe("DRIVER");
  });

  it("Next and Previous move through pages via the URL, with sensible disabled states", async () => {
    renderTable();
    await screen.findByRole("table");
    const nav = screen.getByRole("navigation", { name: "Pagination" });
    expect(within(nav).getByText("Page 1 of 3")).toBeInTheDocument();
    expect(within(nav).getByRole("button", { name: "Previous" })).toBeDisabled();

    await userEvent.click(within(nav).getByRole("button", { name: "Next" }));
    expect(fakeNavigation.search).toBe("?page=2");
    await screen.findByText("Showing 11–20 of 23 users");

    await userEvent.click(within(nav).getByRole("button", { name: "Next" }));
    expect(fakeNavigation.search).toBe("?page=3");
    await screen.findByText("Showing 21–23 of 23 users");
    expect(within(nav).getByRole("button", { name: "Next" })).toBeDisabled();

    await userEvent.click(within(nav).getByRole("button", { name: "Previous" }));
    expect(fakeNavigation.search).toBe("?page=2");
  });

  it("back and forward restore the whole view, including the text in the search box, without adding history", async () => {
    renderTable();
    await screen.findByRole("table");

    await userEvent.selectOptions(screen.getByLabelText("Role"), "DRIVER"); // history entry 2
    await userEvent.type(searchBox(), "kari"); // rewrites entry 2 (replace)
    await waitFor(() => expect(fakeNavigation.url).toBe("/admin/users?search=kari&role=DRIVER"), { timeout: 2000 });
    expect(fakeNavigation.historyLength).toBe(2);

    fakeNavigation.back(); // -> the unfiltered view
    await waitFor(() => expect(screen.getByLabelText("Role")).toHaveValue("ALL"));
    expect(searchBox()).toHaveValue(""); // the typed text is gone, as in the URL
    expect(fakeNavigation.url).toBe("/admin/users");

    fakeNavigation.forward(); // -> search=kari&role=DRIVER
    await waitFor(() => expect(searchBox()).toHaveValue("kari"));
    expect(screen.getByLabelText("Role")).toHaveValue("DRIVER");

    // Restoring must not itself navigate, even after the debounce window has passed.
    await new Promise((r) => setTimeout(r, 450));
    expect(fakeNavigation.historyLength).toBe(2);
    expect(fakeNavigation.url).toBe("/admin/users?search=kari&role=DRIVER");
  });

  it("pressing Back while a search update is still pending cancels it instead of undoing the Back", async () => {
    renderTable();
    await screen.findByRole("table");
    await userEvent.selectOptions(screen.getByLabelText("Role"), "ADMIN"); // entry 2

    await userEvent.type(searchBox(), "abc"); // update to ?search=abc&role=ADMIN is pending
    fakeNavigation.back(); // user goes back before the pause is over
    await waitFor(() => expect(screen.getByLabelText("Role")).toHaveValue("ALL"));

    await new Promise((r) => setTimeout(r, 500)); // longer than the debounce
    expect(fakeNavigation.url).toBe("/admin/users"); // the stale update did not fire
    expect(searchBox()).toHaveValue("");
  });

  it("a page past the end is replaced with the last page", async () => {
    fakeNavigation.reset("/admin/users?page=99");
    renderTable();
    await waitFor(() => expect(fakeNavigation.url).toBe("/admin/users?page=3"));
    expect(await screen.findByText("Showing 21–23 of 23 users")).toBeInTheDocument();
  });
});

describe("UsersTable: result count wording", () => {
  const some = (n: number) => ({ items: everyone.slice(0, n), total: n, page: 1, pageSize: 10 });

  it.each([
    [1, "Showing 1 user"],
    [2, "Showing 1–2 of 2 users"],
    [10, "Showing 1–10 of 10 users"],
  ])("with %i total: %s", async (total, text) => {
    list.mockResolvedValue(some(total));
    renderTable();
    expect(await screen.findByText(text)).toHaveAttribute("role", "status");
  });

  it("a last page with a single row reads 'Showing 21 of 21 users'", async () => {
    fakeNavigation.reset("/admin/users?page=3");
    list.mockResolvedValue({ items: [everyone[20]], total: 21, page: 3, pageSize: 10 });
    renderTable();
    expect(await screen.findByText("Showing 21 of 21 users")).toBeInTheDocument();
  });
});

describe("UsersTable: states", () => {
  it("shows skeleton rows while the first page loads, with no table yet", async () => {
    list.mockImplementation(() => new Promise(() => {})); // never resolves
    renderTable();

    const loading = screen.getByRole("status", { name: "Loading users" });
    expect(loading).toHaveAttribute("aria-busy", "true");
    expect(screen.queryByRole("table")).not.toBeInTheDocument();
    expect(screen.getByText("Loading users…")).toBeInTheDocument();
  });

  it("keeps the previous rows (dimmed, aria-busy) while the next page loads, instead of flashing", async () => {
    renderTable();
    await screen.findByRole("link", { name: "User 1" });

    let release!: (value: AdminUsersList) => void;
    list.mockImplementationOnce(() => new Promise<AdminUsersList>((resolve) => (release = resolve)));
    await userEvent.click(screen.getByRole("button", { name: "Next" }));

    // Page 2 is still loading; page 1's rows are still on screen and no skeleton replaced them.
    expect(screen.getByRole("link", { name: "User 1" })).toBeInTheDocument();
    expect(screen.queryByRole("status", { name: "Loading users" })).not.toBeInTheDocument();
    expect(screen.getByRole("table").closest("[aria-busy]")).toHaveAttribute("aria-busy", "true");

    release(fakeApi({ page: 2 }));
    expect(await screen.findByRole("link", { name: "User 11" })).toBeInTheDocument();
    expect(screen.queryByRole("link", { name: "User 1" })).not.toBeInTheDocument();
  });

  it("shows an empty state naming the search, and Clear filters resets the URL and the box", async () => {
    fakeNavigation.reset("/admin/users?search=zzz&role=ADMIN");
    renderTable();

    expect(await screen.findByText("No users match “zzz” with the role Admin.")).toBeInTheDocument();
    expect(screen.getByText("No users match your filters.")).toHaveAttribute("role", "status");

    await userEvent.click(screen.getByRole("button", { name: "Clear filters" }));
    expect(fakeNavigation.search).toBe("");
    expect(searchBox()).toHaveValue("");
    expect(screen.getByLabelText("Role")).toHaveValue("ALL");
    expect(await screen.findByRole("table")).toBeInTheDocument();
  });

  it("shows a plain message, not a filter prompt, when there are simply no users", async () => {
    list.mockResolvedValue({ items: [], total: 0, page: 1, pageSize: 10 });
    renderTable();
    expect(await screen.findByText("There are no users yet.")).toBeInTheDocument();
    expect(screen.queryByRole("button", { name: "Clear filters" })).not.toBeInTheDocument();
  });

  it("shows an error with a Try again button that recovers", async () => {
    list.mockRejectedValueOnce(new ApiError(500, "HTTP_500", "Internal server error"));
    renderTable();

    const alert = await screen.findByRole("alert");
    expect(alert).toHaveTextContent("Could not load users: Internal server error");
    expect(screen.queryByRole("table")).not.toBeInTheDocument();

    await userEvent.click(within(alert).getByRole("button", { name: "Try again" }));
    expect(await screen.findByRole("table")).toBeInTheDocument();
    expect(screen.queryByRole("alert")).not.toBeInTheDocument();
    expect(list).toHaveBeenCalledTimes(2);
  });

  it("explains a network failure in plain language", async () => {
    list.mockRejectedValueOnce(new ApiError(0, "NETWORK_ERROR", "Cannot reach the server"));
    renderTable();
    expect(await screen.findByRole("alert")).toHaveTextContent("Can't reach the server. Check your connection and try again.");
  });
});
