import type { supabase } from "@/integrations/supabase/client";

export type DocumentEntry = { id: string; doc_type: string; expiry_date: string | null };

export async function saveDocument(
  client: typeof supabase,
  userId: string,
  docType: string,
  expiry: string,
  existingId?: string,
) {
  if (existingId) {
    const { data, error } = await client.from("user_documents")
      .update({ expiry_date: expiry || null }).eq("id", existingId).eq("user_id", userId)
      .select("id").single();
    if (error) throw error;
    if (!data) throw new Error("Document not found");
    return { duplicate: null };
  }

  const findExisting = async () => {
    const { data, error } = await client.from("user_documents")
      .select("id, doc_type, expiry_date").eq("user_id", userId).eq("doc_type", docType)
      .order("created_at").limit(1).maybeSingle();
    if (error) throw error;
    return data;
  };
  const existing = await findExisting();
  if (existing) return { duplicate: existing };

  const { error } = await client.from("user_documents").insert({
    user_id: userId, doc_type: docType, expiry_date: expiry || null,
  });
  if (error?.code === "23505") {
    const duplicate = await findExisting();
    if (duplicate) return { duplicate };
  }
  if (error) throw error;
  return { duplicate: null };
}