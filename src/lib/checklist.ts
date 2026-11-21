import { z } from "zod";

export const outputSchema = z.object({
  groups: z.array(
    z.object({
      name: z.enum([
        "Identity",
        "Address",
        "Date of birth",
        "Photos and forms",
        "Other",
        "Official document list",
      ]),
      items: z.array(
        z.object({
          document: z.string(),
          doc_type: z.string().nullable(),
          fits_situation: z.boolean().nullable(),
          mentioned_by_user: z.boolean().nullable(),
          note: z.string().nullable(),
        }),
      ),
    }),
  ),
  warnings: z.array(z.string()),
  not_in_sources: z.string().nullable(),
  show_checklist: z.boolean(),
  headline: z.string().nullable(),
});
export type ChecklistOutput = z.infer<typeof outputSchema>;

export function maskIds(text: string) {
  const masked = text
    .replace(/\b[A-Z]{5}[0-9]{4}[A-Z]\b/gi, "[ID removed]")
    .replace(/(?<!\d)\d(?:[\s-]*\d){11}(?![\s-]*\d)/g, "[ID removed]")
    .replace(/\d{9,}/g, "[ID removed]");
  return { text: masked, masked: masked !== text };
}

export function documentStatus(
  held: Set<string> | null,
  item: { doc_type: string | null; mentioned_by_user: boolean | null },
) {
  if (item.mentioned_by_user === true || (item.doc_type && held?.has(item.doc_type))) return "have";
  return held && item.doc_type ? "missing" : null;
}

/** A source's "Steps:" block starts on its own line, followed by numbered lines ("1. ..."). */
const STEPS_HEADING = /\r?\n[ \t]*Steps[^\r\n:]*:[ \t]*(?=\r?\n)/;

/** The numbered official steps at the end of a source, or [] when the source has none. */
export function officialSteps(sourceText: string): string[] {
  const match = STEPS_HEADING.exec(sourceText);
  if (!match) return [];
  return sourceText
    .slice(match.index + match[0].length)
    .split(/\r?\n/)
    .map((line) => /^\s*\d+[.)]\s+(.+?)\s*$/.exec(line)?.[1])
    .filter((step): step is string => !!step);
}

/** The source without its steps block, so the no-AI document list only lists documents. */
export function documentText(sourceText: string): string {
  const match = STEPS_HEADING.exec(sourceText);
  return match ? sourceText.slice(0, match.index) : sourceText;
}

export function officialFallback(sourceText: string): ChecklistOutput {
  const items = documentText(sourceText)
    .split(/(?:\r?\n)+|(?<=[.!?])\s+(?=[A-Z])|;\s*/)
    .map((text) => text.replace(/^\s*[-•]\s*/, "").trim())
    .filter(Boolean);
  return {
    show_checklist: true,
    headline: null,
    warnings: [],
    not_in_sources: null,
    groups: [
      {
        name: "Official document list",
        items: items.map((document) => ({
          document,
          doc_type: null,
          fits_situation: null,
          mentioned_by_user: null,
          note: null,
        })),
      },
    ],
  };
}

export async function withOfficialFallback(
  sourceText: string,
  run: () => Promise<ChecklistOutput>,
  log: (error: unknown) => void,
) {
  try {
    return { output: outputSchema.parse(await run()), fallback: false };
  } catch (error) {
    log(error);
    return { output: officialFallback(sourceText), fallback: true };
  }
}
