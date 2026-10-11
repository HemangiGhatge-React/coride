import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { act, render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { StrictMode, type ReactNode } from "react";
import { describe, expect, it } from "vitest";
import { ConnectionNotice } from "@/components/connection-notice";
import { createApiClient } from "@/lib/api/client";
import { listAdminUsers } from "@/lib/api/endpoints";
import { fakeFetch, json } from "@/lib/api/test-utils";
import { AuthProvider, useAuth } from "./auth-context";

const admin = { id: "u1", email: "admin@example.test", name: "Admin", role: "ADMIN" };
const expired = () => json({ statusCode: 401, error: "Unauthorized", message: "INVALID_REFRESH_TOKEN" }, 401);

function Probe() {
  const { status, user, logout } = useAuth();
  return (
    <div>
      <p data-testid="status">{status}</p>
      <p data-testid="email">{user?.email ?? "-"}</p>
      <button onClick={() => void logout()}>log out</button>
    </div>
  );
}

function setup(
  handler: Parameters<typeof fakeFetch>[0],
  opts: { strict?: boolean; retryDelaysMs?: number[] } = {},
) {
  const f = fakeFetch(handler);
  const client = createApiClient({ fetch: f.fn });
  const queryClient = new QueryClient();
  const wrap = (children: ReactNode) => (
    <QueryClientProvider client={queryClient}>
      <AuthProvider client={client} retryDelaysMs={opts.retryDelaysMs ?? [0, 0]}>
        <ConnectionNotice client={client} />
        {children}
      </AuthProvider>
    </QueryClientProvider>
  );
  render(opts.strict ? <StrictMode>{wrap(<Probe />)}</StrictMode> : wrap(<Probe />));
  return { f, client };
}

const status = () => screen.getByTestId("status").textContent;

describe("AuthProvider: session restore", () => {
  it("starts as loading, then restores the session from the cookie (refresh -> /auth/me)", async () => {
    const { f, client } = setup((url) =>
      url === "/api/auth/refresh" ? json({ access_token: "tok" }) : json(admin),
    );
    expect(status()).toBe("loading");

    await waitFor(() => expect(status()).toBe("authenticated"));
    expect(screen.getByTestId("email")).toHaveTextContent("admin@example.test");
    expect(client.getAccessToken()).toBe("tok");
    // /auth/me was called with the freshly refreshed token.
    expect(f.calls.find((c) => c.url === "/api/auth/me")?.token).toBe("tok");
  });

  it("a failed refresh (401) makes the status anonymous", async () => {
    const { client } = setup(() => expired());

    await waitFor(() => expect(status()).toBe("anonymous"));
    expect(screen.getByTestId("email")).toHaveTextContent("-");
    expect(client.getAccessToken()).toBeNull();
  });

  it("sends exactly one refresh even when effects run twice (React StrictMode)", async () => {
    const { f } = setup(
      (url) => (url === "/api/auth/refresh" ? json({ access_token: "tok" }) : json(admin)),
      { strict: true },
    );

    await waitFor(() => expect(status()).toBe("authenticated"));
    expect(f.count("/api/auth/refresh")).toBe(1);
  });

  it("retries on network failures with a visible notice, and does not log out", async () => {
    let attempts = 0;
    const { f } = setup((url) => {
      if (url === "/api/auth/refresh") {
        if (++attempts < 3) throw new TypeError("Failed to fetch");
        return json({ access_token: "tok" });
      }
      return json(admin);
    });

    expect(await screen.findByText("Connection problem, retrying…")).toBeInTheDocument();
    await waitFor(() => expect(status()).toBe("authenticated"));
    expect(f.count("/api/auth/refresh")).toBe(3);
    await waitFor(() => expect(screen.queryByText("Connection problem, retrying…")).not.toBeInTheDocument());
  });

  it("gives up after the retries and shows anonymous (the login page), without a 401 having happened", async () => {
    const { f } = setup(
      () => {
        throw new TypeError("Failed to fetch");
      },
      { retryDelaysMs: [0, 0] },
    );
    await waitFor(() => expect(status()).toBe("anonymous"));
    expect(f.count("/api/auth/refresh")).toBe(3);
  });
});

describe("AuthProvider: during a session", () => {
  it("a request whose refresh is rejected moves the app to anonymous", async () => {
    let refreshCalls = 0;
    const { client } = setup((url, _init, token) => {
      if (url === "/api/auth/refresh") return ++refreshCalls === 1 ? json({ access_token: "tok" }) : expired();
      if (url === "/api/auth/me") return json(admin);
      return token === "tok" ? json({}, 401) : json({}, 401); // the access token has expired
    });
    await waitFor(() => expect(status()).toBe("authenticated"));

    await act(async () => {
      await listAdminUsers(client).catch(() => undefined);
    });

    await waitFor(() => expect(status()).toBe("anonymous"));
    expect(client.getAccessToken()).toBeNull();
  });

  it("logout calls the API, clears the in-memory token and becomes anonymous", async () => {
    const { f, client } = setup((url) => {
      if (url === "/api/auth/refresh") return json({ access_token: "tok" });
      if (url === "/api/auth/logout") return new Response(null, { status: 204 });
      return json(admin);
    });
    await waitFor(() => expect(status()).toBe("authenticated"));

    await userEvent.click(screen.getByRole("button", { name: "log out" }));

    await waitFor(() => expect(status()).toBe("anonymous"));
    expect(f.count("/api/auth/logout")).toBe(1);
    expect(client.getAccessToken()).toBeNull();
  });

  it("logout still signs out locally when the server cannot be reached", async () => {
    const { client } = setup((url) => {
      if (url === "/api/auth/refresh") return json({ access_token: "tok" });
      if (url === "/api/auth/logout") throw new TypeError("Failed to fetch");
      return json(admin);
    });
    await waitFor(() => expect(status()).toBe("authenticated"));

    await userEvent.click(screen.getByRole("button", { name: "log out" }));

    await waitFor(() => expect(status()).toBe("anonymous"));
    expect(client.getAccessToken()).toBeNull();
  });
});
