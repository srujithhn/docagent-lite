import { QueryClient } from "@tanstack/react-query";
import { act, cleanup, render } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";

type Session = { user: { id: string } } | null;
const mocks = vi.hoisted(() => ({
  callback: undefined as ((event: string, session: Session) => void) | undefined,
  track: vi.fn(), invalidate: vi.fn(), subscribe: vi.fn(() => () => {}),
}));
vi.mock("@/integrations/supabase/client", () => ({ supabase: { auth: {
  onAuthStateChange: (callback: (event: string, session: Session) => void) => {
    mocks.callback = callback;
    return { data: { subscription: { unsubscribe: () => {} } } };
  },
} } }));
vi.mock("@/components/SiteHeader", () => ({ SiteHeader: () => null, SiteFooter: () => null }));
vi.mock("@/components/ui/sonner", () => ({ Toaster: () => null }));
vi.mock("@tanstack/react-router", async (importOriginal) => ({
  ...await importOriginal<typeof import("@tanstack/react-router")>(),
  useRouter: () => ({ invalidate: mocks.invalidate, subscribe: mocks.subscribe }),
  Outlet: () => null,
}));
import { Route } from "@/routes/__root";
const Root = Route.options.component as React.ComponentType;
afterEach(() => { cleanup(); vi.restoreAllMocks(); vi.clearAllMocks(); delete window.__lovableEvents; });

describe("Successful sign-in tracking", () => {
  it("counts a new sign-in once, without email or identity properties", () => {
    vi.spyOn(Route, "useRouteContext").mockReturnValue({ queryClient: new QueryClient() });
    window.__lovableEvents = { track: mocks.track };
    render(<Root />);
    act(() => mocks.callback?.("INITIAL_SESSION", null));
    act(() => mocks.callback?.("SIGNED_IN", { user: { id: "account" } }));
    act(() => mocks.callback?.("SIGNED_IN", { user: { id: "account" } }));
    expect(mocks.track.mock.calls).toEqual([["project.signin_success"]]);
  });
  it("does not count restored sessions or token refreshes as sign-ins", () => {
    vi.spyOn(Route, "useRouteContext").mockReturnValue({ queryClient: new QueryClient() });
    window.__lovableEvents = { track: mocks.track };
    render(<Root />);
    act(() => mocks.callback?.("INITIAL_SESSION", { user: { id: "account" } }));
    act(() => mocks.callback?.("TOKEN_REFRESHED", { user: { id: "account" } }));
    act(() => mocks.callback?.("SIGNED_IN", { user: { id: "account" } }));
    expect(mocks.track).not.toHaveBeenCalled();
  });
  it("keeps session invalidation working when tracking fails", () => {
    vi.spyOn(Route, "useRouteContext").mockReturnValue({ queryClient: new QueryClient() });
    mocks.track.mockImplementation(() => { throw new Error("collector failed"); });
    window.__lovableEvents = { track: mocks.track };
    render(<Root />);
    expect(() => act(() => mocks.callback?.("SIGNED_IN", { user: { id: "account" } }))).not.toThrow();
    expect(mocks.invalidate).toHaveBeenCalled();
  });
});