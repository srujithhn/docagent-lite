import { cleanup, fireEvent, render, screen } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
const mocks = vi.hoisted(() => ({ otp: vi.fn(), track: vi.fn(), navigate: vi.fn() }));
vi.mock("@/integrations/supabase/client", () => ({ supabase: { auth: { signInWithOtp: mocks.otp } } }));
vi.mock("@/hooks/use-auth", () => ({ useAuth: () => ({ user: null }) }));
vi.mock("@tanstack/react-router", async (importOriginal) => ({
  ...await importOriginal<typeof import("@tanstack/react-router")>(),
  useNavigate: () => mocks.navigate,
  Link: ({ children }: { children: React.ReactNode }) => <a>{children}</a>,
}));
import { Route } from "@/routes/auth";
const Auth = Route.options.component as React.ComponentType;
beforeEach(() => {
  vi.resetAllMocks();
  sessionStorage.clear();
  window.__lovableEvents = { track: mocks.track };
  mocks.otp.mockResolvedValue({ error: null });
});
afterEach(() => { cleanup(); delete window.__lovableEvents; });

describe("Sign-in funnel and optional correction", () => {
  it("uses the one-click correction when explicitly chosen", async () => {
    render(<Auth />);
    fireEvent.change(screen.getByRole("textbox", { name: "Email address" }), { target: { value: "name@gma8l.com" } });
    fireEvent.click(screen.getByRole("button", { name: "Did you mean name@gmail.com?" }));
    fireEvent.click(screen.getByRole("button", { name: "Email me a sign-in link" }));
    await screen.findByText("Check your email");
    expect(mocks.otp).toHaveBeenCalledWith(expect.objectContaining({ email: "name@gmail.com" }));
    expect(mocks.track.mock.calls).toEqual([["project.auth_viewed", {}], ["project.signup_submitted"]]);
  });
  it("does not block submission without accepting the hint, even if tracking throws", async () => {
    mocks.track.mockImplementation(() => { throw new Error("collector failed"); });
    render(<Auth />);
    fireEvent.change(screen.getByRole("textbox", { name: "Email address" }), { target: { value: "name@gma8l.com" } });
    fireEvent.click(screen.getByRole("button", { name: "Email me a sign-in link" }));
    await screen.findByText("Check your email");
    expect(mocks.otp).toHaveBeenCalledWith(expect.objectContaining({ email: "name@gma8l.com" }));
  });
  it("tracks only an allowlisted redirect origin", () => {
    sessionStorage.setItem("docagent_auth_from", "/documents");
    render(<Auth />);
    expect(mocks.track).toHaveBeenCalledWith("project.auth_viewed", { from: "/documents" });
    expect(sessionStorage.getItem("docagent_auth_from")).toBeNull();
  });
  it("keeps sign-in usable when session storage is blocked", () => {
    const blocked = vi.spyOn(Storage.prototype, "getItem").mockImplementation(() => { throw new Error("blocked"); });
    render(<Auth />);
    expect(mocks.track).toHaveBeenCalledWith("project.auth_viewed", {});
    blocked.mockRestore();
  });
});