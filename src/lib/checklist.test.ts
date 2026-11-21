import { describe, expect, it, vi } from "vitest";
import {
  maskIds,
  documentStatus,
  officialFallback,
  officialSteps,
  documentText,
  withOfficialFallback,
  outputSchema,
} from "./checklist";
import { aiErrorDetails } from "./ai/checklist-errors";
import { APICallError } from "ai";

describe("Situation privacy", () => {
  it.each([
    "123456789012",
    "1234 5678 9012",
    "1234-5678-9012",
    "ABCDE1234F",
    "abcde1234f",
    "987654321",
    "1234567890123456",
  ])("removes ID %s", (id) => {
    expect(maskIds(`I have Aadhaar ${id} and PAN`)).toEqual({
      text: "I have Aadhaar [ID removed] and PAN",
      masked: true,
    });
  });
  it("preserves document names and age", () => {
    expect(maskIds("I'm 19 and I have Aadhaar and PAN")).toEqual({
      text: "I'm 19 and I have Aadhaar and PAN",
      masked: false,
    });
  });
});
describe("Document ownership", () => {
  it("uses declared PAN ownership even when missing from saved documents", () => {
    expect(documentStatus(new Set(["Aadhaar"]), { doc_type: "PAN", mentioned_by_user: true })).toBe(
      "have",
    );
  });
  it("uses declared ownership when signed out", () => {
    expect(documentStatus(null, { doc_type: "PAN", mentioned_by_user: true })).toBe("have");
    expect(documentStatus(null, { doc_type: "Aadhaar", mentioned_by_user: null })).toBeNull();
  });
  it("keeps saved ownership and missing saved documents", () => {
    expect(documentStatus(new Set(["PAN"]), { doc_type: "PAN", mentioned_by_user: null })).toBe(
      "have",
    );
    expect(documentStatus(new Set(), { doc_type: "PAN", mentioned_by_user: null })).toBe("missing");
  });
});
describe("Official fallback", () => {
  it.each([402, 429, 500])("returns source bullets for wrapped status %s", async (statusCode) => {
    const error = new Error("stream failed", { cause: { statusCode, message: "real failure" } });
    const log = vi.fn();
    const result = await withOfficialFallback(
      "Carry Aadhaar. Carry PAN; Bring originals.",
      async () => {
        throw error;
      },
      log,
    );
    expect(result.fallback).toBe(true);
    const group = result.output.groups[0];
    if (!group) throw new Error("Missing official list");
    expect(group.name).toBe("Official document list");
    expect(group.items.map((x) => x.document)).toEqual([
      "Carry Aadhaar.",
      "Carry PAN",
      "Bring originals.",
    ]);
    expect(
      group.items.every((x) => x.fits_situation === null && x.mentioned_by_user === null),
    ).toBe(true);
    expect(log).toHaveBeenCalledWith(error);
    expect(aiErrorDetails(error)["statusCode"]).toBe(statusCode);
  });
  it.each([
    new Error("timeout"),
    new Error("unreadable output"),
    new Error("AI is not configured"),
  ])("falls back on any failure", async (error) => {
    expect(
      (
        await withOfficialFallback(
          "Use PAN.",
          async () => {
            throw error;
          },
          vi.fn(),
        )
      ).fallback,
    ).toBe(true);
  });
  it("recognizes API errors inside stream causes without logging IDs", () => {
    const cause = new APICallError({
      message: "credits",
      url: "https://example.com",
      requestBodyValues: {},
      statusCode: 402,
      responseBody: "123456789012",
      isRetryable: false,
    });
    const details = aiErrorDetails(new Error("stream", { cause }));
    expect(details["statusCode"]).toBe(402);
    expect(details["cause"]).toMatchObject({ isRetryable: false, responseBody: "[ID removed]" });
  });
  it("requires headline and checklist visibility on AI answers", () => {
    const output = officialFallback("Use PAN.");
    expect(
      outputSchema.parse({ ...output, headline: "Not eligible", show_checklist: false })
        .show_checklist,
    ).toBe(false);
    expect(outputSchema.safeParse({ groups: [], warnings: [], not_in_sources: null }).success).toBe(
      false,
    );
  });
});

describe("Official steps", () => {
  const source =
    "Carry Aadhaar. Bring PAN.\nSteps:\n1. Register on the portal.\n2. Pay the fee online.\n3) Book a slot and take the test.";

  it("reads the numbered steps after the Steps heading", () => {
    expect(officialSteps(source)).toEqual([
      "Register on the portal.",
      "Pay the fee online.",
      "Book a slot and take the test.",
    ]);
  });

  it("accepts a named heading and Windows line endings", () => {
    expect(
      officialSteps("Docs.\r\nSteps on Sarathi:\r\n1. Fill in Form 2.\r\n2. Upload documents."),
    ).toEqual(["Fill in Form 2.", "Upload documents."]);
  });

  it("returns no steps when the source has no steps block", () => {
    expect(officialSteps("Steps: register, pay the fee, then book a slot.")).toEqual([]);
    expect(officialSteps("Banks need PAN.")).toEqual([]);
  });

  it("keeps steps out of the no-AI document list", () => {
    expect(documentText(source)).toBe("Carry Aadhaar. Bring PAN.");
    const items = officialFallback(source).groups[0]?.items.map((i) => i.document);
    expect(items).toEqual(["Carry Aadhaar.", "Bring PAN."]);
  });
});
