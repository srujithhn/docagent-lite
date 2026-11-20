import { act, cleanup, fireEvent, render, screen, waitFor } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({ run: vi.fn(), rpc: vi.fn(), track: vi.fn() }));
vi.mock("@tanstack/react-start", () => ({ useServerFn: () => mocks.run }));
vi.mock("@/lib/checklist.functions", () => ({ generateChecklist: vi.fn() }));
vi.mock("@/hooks/use-auth", () => ({ useAuth: () => ({ user: null }) }));
vi.mock("@/integrations/supabase/client", () => ({ supabase: { rpc: mocks.rpc } }));
vi.mock("@tanstack/react-router", async (importOriginal) => ({
  ...await importOriginal<typeof import("@tanstack/react-router")>(),
  Link: ({ children }: { children: React.ReactNode }) => <a>{children}</a>,
}));
import { Route } from "@/routes/checklist";
const Checklist = Route.options.component as React.ComponentType;
const result = {
  checklistId: "test-checklist", fallback: false, idMasked: false,
  source: { task_name: "New PAN card", official_url: "https://example.org", last_verified: "2026-11-19", status_note: "Draft" },
  output: { headline: "PAN checklist", show_checklist: true, groups: [], warnings: [], not_in_sources: null },
};
afterEach(() => { cleanup(); delete window.__lovableEvents; });
beforeEach(() => {
  vi.clearAllMocks();
  window.__lovableEvents = { track: mocks.track };
  mocks.run.mockResolvedValue(result);
  mocks.rpc.mockResolvedValue({ error: null });
});

async function generate() {
  render(<Checklist />);
  fireEvent.click(screen.getByRole("radio", { name: "New PAN card" }));
  fireEvent.click(screen.getByRole("button", { name: "Get my checklist" }));
  await screen.findByText("PAN checklist");
}

describe("Checklist funnel and feedback", () => {
  it("shows the result even when track throws", async () => {
    mocks.track.mockImplementation(() => { throw new Error("collector unavailable"); });
    await generate();
    expect(mocks.run).toHaveBeenCalledTimes(1);
    expect(screen.getByText("Was this checklist correct?")).toBeTruthy();
  });
  it("emits task, click, and shown events without the typed situation", async () => {
    mocks.track.mockImplementation(() => null);
    render(<Checklist />);
    fireEvent.change(screen.getByRole("textbox"), { target: { value: "I have Aadhaar. Private example text" } });
    fireEvent.click(screen.getByRole("radio", { name: "New PAN card" }));
    fireEvent.click(screen.getByRole("button", { name: "Get my checklist" }));
    await screen.findByText("PAN checklist");
    expect(mocks.track.mock.calls).toEqual([
      ["project.task_selected", { task_key: "pan_new" }],
      ["project.generate_clicked", { task_key: "pan_new" }],
      ["project.checklist_shown", { task_key: "pan_new", source: "ai" }],
    ]);
  });
  it("records fallback and only a bounded failure category", async () => {
    mocks.run.mockResolvedValue({ ...result, fallback: true });
    await generate();
    expect(mocks.track).toHaveBeenCalledWith("project.checklist_shown", { task_key: "pan_new", source: "fallback" });
    expect(mocks.track).toHaveBeenCalledWith("project.generate_failed", { task_key: "pan_new", kind: "ai_unavailable" });
  });
  it("disables submission in flight and performs exactly one conflict-ignore upsert", async () => {
    let finish: ((value: { error: null }) => void) | undefined;
    mocks.rpc.mockImplementation(() => new Promise((resolve) => { finish = resolve; }));
    await generate();
    fireEvent.click(screen.getByRole("button", { name: "Yes, correct" }));
    const submit = screen.getByRole("button", { name: "Send feedback" });
    fireEvent.click(submit);
    fireEvent.click(submit);
    expect(submit).toBeDisabled();
    expect(mocks.rpc).toHaveBeenCalledTimes(1);
    expect(mocks.rpc).toHaveBeenCalledWith("submit_checklist_feedback", { p_checklist_id: "test-checklist", p_session_id: localStorage.getItem("docagent_session"), p_is_correct: true, p_task_key: "pan_new", p_comment: "" });
    await act(async () => finish?.({ error: null }));
    await screen.findByText("Thanks — that helps us improve.");
    expect(mocks.track).toHaveBeenCalledWith("project.feedback_submitted", { task_key: "pan_new", is_correct: true });
  });
  it("allows retry when the feedback request fails", async () => {
    mocks.rpc.mockRejectedValueOnce(new Error("insert failed"));
    await generate();
    fireEvent.click(screen.getByRole("button", { name: "No, not correct" }));
    fireEvent.click(screen.getByRole("button", { name: "Send feedback" }));
    await waitFor(() => expect(screen.getByRole("button", { name: "Send feedback" })).toBeEnabled());
    fireEvent.click(screen.getByRole("button", { name: "Send feedback" }));
    await screen.findByText("Thanks — that helps us improve.");
    expect(mocks.rpc).toHaveBeenCalledTimes(2);
  });
});