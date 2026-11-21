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
vi.mock("@ai-sdk/google", () => ({
  createGoogleGenerativeAI: () => () => "gemini-model",
}));
vi.mock("ai", async (original) => ({
  ...(await original<typeof import("ai")>()),
  streamText: mocks.stream,
}));
import { generateChecklist, isOutOfCredits } from "./checklist.functions";
const run = generateChecklist as unknown as (input: {
  data: { taskKey: string; situation: string; sessionId: string; idMasked: boolean };
}) => Promise<{
  fallback: boolean;
  idMasked: boolean;
  output: { groups: { name: string }[] };
  source: typeof mocks.source;
  steps: string[];
}>;

beforeEach(() => {
  vi.unstubAllEnvs();
  mocks.stream.mockReset();
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

const goodOutput = {
  groups: [{ name: "Identity", items: [] }],
  warnings: [],
  not_in_sources: null,
  show_checklist: true,
  headline: null,
};

function failingStream(statusCode: number) {
  return (options: { onError: (e: { error: unknown }) => void }) => {
    options.onError({
      error: new Error("stream broke", { cause: { statusCode, message: "upstream failure" } }),
    });
    return { output: Promise.reject(new Error("No readable output")) };
  };
}

describe("Own Gemini key as backup", () => {
  const input = {
    data: { taskKey: "bank_kyc", situation: "I have PAN", sessionId: "session", idMasked: false },
  };

  it("uses the Gemini key when the gateway is out of credits (402)", async () => {
    vi.stubEnv("GEMINI_API_KEY", "test-gemini-key");
    mocks.stream
      .mockImplementationOnce(failingStream(402))
      .mockImplementationOnce(() => ({ output: Promise.resolve(goodOutput) }));
    const result = await run(input);
    expect(mocks.stream).toHaveBeenCalledTimes(2);
    expect(mocks.stream.mock.calls[1]?.[0].model).toBe("gemini-model");
    expect(result.fallback).toBe(false);
  });

  it("does not try Gemini for other errors such as 429", async () => {
    vi.stubEnv("GEMINI_API_KEY", "test-gemini-key");
    const log = vi.spyOn(console, "error").mockImplementation(() => {});
    mocks.stream.mockImplementation(failingStream(429));
    const result = await run(input);
    expect(mocks.stream).toHaveBeenCalledTimes(1);
    expect(result.fallback).toBe(true);
    log.mockRestore();
  });

  it("shows the official list when out of credits and no Gemini key is set", async () => {
    const log = vi.spyOn(console, "error").mockImplementation(() => {});
    mocks.stream.mockImplementation(failingStream(402));
    const result = await run(input);
    expect(mocks.stream).toHaveBeenCalledTimes(1);
    expect(result.fallback).toBe(true);
    log.mockRestore();
  });

  it("detects 402 anywhere in the error chain", () => {
    expect(isOutOfCredits(new Error("x", { cause: { statusCode: 402 } }))).toBe(true);
    expect(isOutOfCredits({ statusCode: 429 })).toBe(false);
    expect(isOutOfCredits(null)).toBe(false);
  });
});

describe("Official steps in the response", () => {
  it("returns the source's steps even when the AI fails", async () => {
    const original = mocks.source.source_text;
    mocks.source.source_text = `${original}\nSteps:\n1. Bring your OVD to the bank.\n2. Complete KYC.`;
    mocks.stream.mockImplementation(() => {
      throw new Error("gateway down");
    });
    try {
      const result = await run({
        data: { taskKey: "bank_kyc", situation: "", sessionId: "s", idMasked: false },
      });
      expect(result.steps).toEqual(["Bring your OVD to the bank.", "Complete KYC."]);
      expect(result.fallback).toBe(true);
    } finally {
      mocks.source.source_text = original;
    }
  });

  it("returns no steps for a source without a steps block", async () => {
    mocks.stream.mockImplementation(() => {
      throw new Error("gateway down");
    });
    const result = await run({
      data: { taskKey: "bank_kyc", situation: "", sessionId: "s", idMasked: false },
    });
    expect(result.steps).toEqual([]);
  });
});
