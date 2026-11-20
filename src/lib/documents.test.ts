import { describe, expect, it, vi } from "vitest";
import type { supabase } from "@/integrations/supabase/client";
import { saveDocument } from "./documents";
import { DOC_TYPES } from "./tasks";

function mockClient(existing: unknown, insertError: unknown = null) {
  const query = {
    select: vi.fn().mockReturnThis(), eq: vi.fn().mockReturnThis(),
    order: vi.fn().mockReturnThis(), limit: vi.fn().mockReturnThis(),
    maybeSingle: vi.fn().mockResolvedValue({ data: existing, error: null }),
    single: vi.fn().mockResolvedValue({ data: { id: "existing" }, error: null }),
    insert: vi.fn().mockResolvedValue({ error: insertError }),
    update: vi.fn().mockReturnThis(),
  };
  return { query, client: { from: vi.fn(() => query) } as unknown as typeof supabase };
}

describe("Document saves", () => {
  it.each(DOC_TYPES)("does not insert %s when already saved by the user", async (docType) => {
    const existing = { id: "existing", doc_type: docType, expiry_date: "2027-04-01" };
    const { client, query } = mockClient(existing);
    expect(await saveDocument(client, "owner", docType, "2028-04-01")).toEqual({ duplicate: existing });
    expect(query.insert).not.toHaveBeenCalled();
    expect(query.eq).toHaveBeenCalledWith("user_id", "owner");
    expect(query.eq).toHaveBeenCalledWith("doc_type", docType);
  });

  it("updates only the existing row's expiry date without inserting or deleting", async () => {
    const { client, query } = mockClient(null);
    await saveDocument(client, "owner", "Passport", "2028-04-01", "existing");
    expect(query.update).toHaveBeenCalledWith({ expiry_date: "2028-04-01" });
    expect(query.eq).toHaveBeenCalledWith("id", "existing");
    expect(query.eq).toHaveBeenCalledWith("user_id", "owner");
    expect(query.insert).not.toHaveBeenCalled();
  });

  it("offers the existing document when another save wins the race", async () => {
    const existing = { id: "existing", doc_type: "Passport", expiry_date: null };
    const { client, query } = mockClient(null, { code: "23505" });
    query.maybeSingle.mockResolvedValueOnce({ data: null, error: null })
      .mockResolvedValueOnce({ data: existing, error: null });
    expect(await saveDocument(client, "owner", "Passport", "")).toEqual({ duplicate: existing });
  });
});