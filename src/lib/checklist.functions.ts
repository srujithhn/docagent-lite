import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";

const SYSTEM_PROMPT =
  "You help Indian students prepare documents. Answer ONLY from the SOURCE TEXT. Group the checklist into: Identity, Address, Date of birth, Photos and forms, Other. For each group list the accepted documents and mark which fit the user's situation. Add short warnings for likely problems (e.g. address on ID doesn't match current address). If the user asks about something not in the SOURCE TEXT, say 'Not in our sources yet' and point to the official link. Never invent fees, dates or rules. Output JSON." +
  "\n\nFor each item, set doc_type to the closest match from this list, or null if none: Aadhaar, PAN, Passport, Driving licence, Voter ID, 10th marksheet, 12th marksheet, Birth certificate, Bank passbook, Income certificate, Caste certificate. Set fits_situation to true/false only if the user's situation tells you, otherwise null. Keep notes under 20 words. Leave a group's items empty if the SOURCE TEXT says nothing for it.";

const outputSchema = z.object({
  groups: z.array(
    z.object({
      name: z.enum(["Identity", "Address", "Date of birth", "Photos and forms", "Other"]),
      items: z.array(
        z.object({
          document: z.string(),
          doc_type: z.string().nullable(),
          fits_situation: z.boolean().nullable(),
          note: z.string().nullable(),
        }),
      ),
    }),
  ),
  warnings: z.array(z.string()),
  not_in_sources: z.string().nullable(),
});

export type ChecklistOutput = z.infer<typeof outputSchema>;

export const generateChecklist = createServerFn({ method: "POST" })
  .inputValidator((input: { taskKey: string; situation: string; sessionId: string }) => ({
    taskKey: String(input.taskKey).slice(0, 64),
    situation: String(input.situation ?? "").slice(0, 500),
    sessionId: String(input.sessionId ?? "").slice(0, 64),
  }))
  .handler(async ({ data }) => {
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const { getRequest } = await import("@tanstack/react-start/server");
    const { createOpenAI } = await import("@ai-sdk/openai");
    const { streamText, Output, NoObjectGeneratedError } = await import("ai");
    const { createLovableAiGatewayRunIdFetch } = await import("./ai/run-id");

    const { data: source, error } = await supabaseAdmin
      .from("sources")
      .select("*")
      .eq("task_key", data.taskKey)
      .maybeSingle();
    if (error || !source) throw new Error("Unknown task");

    // Optional sign-in: attach user_id when a valid bearer token is present.
    let userId: string | null = null;
    const auth = getRequest().headers.get("authorization");
    if (auth?.startsWith("Bearer ")) {
      const { data: u } = await supabaseAdmin.auth.getUser(auth.slice(7));
      userId = u.user?.id ?? null;
    }

    const apiKey = process.env["LOVABLE_API_KEY"];
    if (!apiKey) throw new Error("AI is not configured");
    const runIdFetch = createLovableAiGatewayRunIdFetch();
    const provider = createOpenAI({
      baseURL: "https://ai.gateway.lovable.dev/v1",
      apiKey,
      headers: { "Lovable-API-Key": apiKey, "X-Lovable-AIG-SDK": "vercel-ai-sdk" },
      fetch: runIdFetch.fetch,
    });

    const result = streamText({
      model: provider.responses("openai/gpt-6-astra"),
      instructions: SYSTEM_PROMPT,
      messages: [
        {
          role: "user",
          content: `TASK: ${source.task_name}\nOFFICIAL LINK: ${source.official_url}\n\nSOURCE TEXT:\n${source.source_text}\n\nUSER SITUATION:\n${data.situation || "(not given)"}`,
        },
      ],
      output: Output.object({ schema: outputSchema }),
      maxRetries: 0,
      providerOptions: {
        openai: {
          forceReasoning: true,
          reasoningEffort: "low",
          reasoningSummary: "auto",
          store: false,
          include: ["reasoning.encrypted_content"],
        },
      },
    });

    let output: ChecklistOutput;
    try {
      output = await result.output;
    } catch (e) {
      if (NoObjectGeneratedError.isInstance(e)) throw new Error("The AI reply could not be read. Please try again.");
      const status = (e as { statusCode?: number }).statusCode;
      if (status === 429) throw new Error("Too many requests right now. Please wait a minute and try again.");
      if (status === 402) throw new Error("AI credits have run out for this app.");
      throw new Error("Could not generate the checklist. Please try again.");
    }

    const { data: row } = await supabaseAdmin
      .from("checklists")
      .insert({ task_key: source.task_key, user_id: userId, session_id: data.sessionId || null })
      .select("id")
      .single();

    return {
      checklistId: row?.id ?? null,
      source: {
        task_name: source.task_name,
        official_url: source.official_url,
        last_verified: source.last_verified,
        status_note: source.status_note,
      },
      output,
    };
  });
