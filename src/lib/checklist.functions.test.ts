import { beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({
  stream: vi.fn(),
  insert: vi.fn(),
  source: {
    task_key: "bank_kyc",
    task_name: "Open a bank account (KYC)",
    official_url: "https://www.rbi.org.in",
    source_text: "Banks need PAN. Bring one Officially Valid Document.",
    last_verified: "2026-11-20",
    status_note: "Draft: verify against the official page",
  },
}));
vi.mock("@tanstack/react-start", () => ({
  createServerFn: () => ({ inputValidator: () => ({ handler: (handler: unknown) => handler }) }),
}));
vi.mock("@tanstack/react-start/server", () => ({ getRequest: () => ({ headers: new Headers() }) }));
vi.mock("@/integrations/supabase/client.server", () => ({
  supabaseAdmin: {
    from: () => ({
      select: () => ({
        eq: () => ({ maybeSingle: async () => ({ data: mocks.source, error: null }) }),
      }),
      insert: mocks.insert,
    }),
  },
}));
vi.mock("@ai-sdk/openai", () => ({
  createOpenAI: () => ({ responses: () => "openai/gpt-6-astra" }),
}));
vi.mock("ai", async (original) => ({
  ...(await original<typeof import("ai")>()),
  streamText: mocks.stream,
}));
import { generateChecklist } from "./checklist.functions";
const run = generateChecklist as unknown as (input: {
  data: { taskKey: string; situation: string; sessionId: string; idMasked: boolean };
}) => Promise<{
  fallback: boolean;
  idMasked: boolean;
  output: { groups: { name: string }[] };
  source: typeof mocks.source;
}>;

beforeEach(() => {
  vi.stubEnv("LOVABLE_API_KEY", "test-only-key");
  mocks.insert.mockReturnValue({
    select: () => ({ single: async () => ({ data: { id: "checklist" } }) }),
  });
});

describe("Checklist server failure recovery", () => {
  it.each([402, 429])(
    "returns real source metadata when a stream wraps status %s",
    async (statusCode) => {
      const log = vi.spyOn(console, "error").mockImplementation(() => {});
      const original = new Error("stream broke", {
        cause: { statusCode, message: "upstream failure" },
      });
      mocks.stream.mockImplementation((options) => {
        options.onError({ error: original });
        return { output: Promise.reject(new Error("No readable output")) };
      });
      const result = await run({
        data: {
          taskKey: "bank_kyc",
          situation: "I have PAN",
          sessionId: "session",
          idMasked: true,
        },
      });
      expect(result.fallback).toBe(true);
      expect(result.idMasked).toBe(true);
      expect(result.source.official_url).toBe("https://www.rbi.org.in");
      expect(result.source.last_verified).toBe("2026-11-20");
      expect(result.source.status_note).toBe(mocks.source.status_note);
      expect(result.output.groups[0]?.name).toBe("Official document list");
      expect(log).toHaveBeenCalledWith(
        "Checklist AI failed",
        expect.objectContaining({ statusCode, message: "stream broke" }),
      );
      log.mockRestore();
    },
  );
});
