import { cleanup, render, screen, waitFor } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

const auth = vi.hoisted(() => ({ getUser: vi.fn(), rpc: vi.fn() }));
vi.mock("@/integrations/supabase/client", () => ({ supabase: { auth: { getUser: auth.getUser }, rpc: auth.rpc } }));
vi.mock("@/hooks/use-auth", () => ({ useAuth: () => ({ user: null, loading: false }) }));
import { Route } from "@/routes/admin";

const Admin = Route.options.component as React.ComponentType;
afterEach(cleanup);
beforeEach(() => { vi.clearAllMocks(); });

describe("Owner metrics access", () => {
  it("does not fetch metrics for a signed-out visitor", async () => {
    auth.getUser.mockResolvedValue({ data: { user: null } });
    render(<Admin />);
    await waitFor(() => expect(screen.getByText("Not authorised")).toBeTruthy());
    expect(auth.rpc).not.toHaveBeenCalled();
  });

  it("does not show metrics when the backend rejects another signed-in user", async () => {
    auth.getUser.mockResolvedValue({ data: { user: { email: "student@example.com" } } });
    auth.rpc.mockResolvedValue({ data: null, error: { code: "42501" } });
    render(<Admin />);
    await waitFor(() => expect(screen.getByText("Not authorised")).toBeTruthy());
    expect(screen.queryByText("Admin metrics")).toBeNull();
  });

  it("shows metrics for srujithh@gmail.com after backend authorization", async () => {
    auth.getUser.mockResolvedValue({ data: { user: { email: "srujithh@gmail.com" } } });
    auth.rpc.mockResolvedValue({ data: { signups: 4, checklists_total: 10, per_task: [], feedback_total: 0, thumbs_up: 0, returning_users: 0, per_day: [] }, error: null });
    render(<Admin />);
    await waitFor(() => expect(screen.getByText("10")).toBeTruthy());
    expect(auth.rpc).toHaveBeenCalledWith("admin_metrics");
  });
});