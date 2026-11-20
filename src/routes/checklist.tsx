import { createFileRoute, Link } from "@tanstack/react-router";
import { useServerFn } from "@tanstack/react-start";
import { useEffect, useRef, useState } from "react";
import { ThumbsDown, ThumbsUp, ExternalLink, AlertTriangle, Check, CircleDashed } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Checkbox } from "@/components/ui/checkbox";
import { generateChecklist, type ChecklistOutput } from "@/lib/checklist.functions";
import { TASKS, GROUPS, getSessionId, type TaskKey } from "@/lib/tasks";
import { useAuth } from "@/hooks/use-auth";
import { supabase } from "@/integrations/supabase/client";
import { cn } from "@/lib/utils";
import { documentStatus, maskIds } from "@/lib/checklist";

export const Route = createFileRoute("/checklist")({
  head: () => ({
    meta: [
      { title: "Get your document checklist — DocAgent Lite" },
      { name: "description", content: "Choose a task like a passport, PAN or bank KYC and get a grouped document checklist from official sources." },
      { property: "og:title", content: "Get your document checklist — DocAgent Lite" },
      { property: "og:description", content: "A grouped document checklist from official sources, no sign-in needed." },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary" },
    ],
  }),
  component: ChecklistPage,
});

type Result = Awaited<ReturnType<typeof generateChecklist>>;

function ChecklistPage() {
  const run = useServerFn(generateChecklist);
  const { user } = useAuth();
  const [task, setTask] = useState<TaskKey | null>(null);
  const [situation, setSituation] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [result, setResult] = useState<Result | null>(null);
  const [held, setHeld] = useState<Set<string> | null>(null);

  useEffect(() => {
    if (!user) return setHeld(null);
    supabase.from("user_documents").select("doc_type").then(({ data }) => setHeld(new Set((data ?? []).map((d) => d.doc_type))));
  }, [user]);

  async function submit() {
    if (!task) return;
    try {
      window.__lovableEvents?.track?.("project.generate_clicked", { task_key: task });
    } catch { /* Analytics must never block generation. */ }
    setLoading(true);
    setError(null);
    setResult(null);
    const safeSituation = maskIds(situation);
    setSituation(safeSituation.text);
    try {
      const nextResult = await run({ data: { taskKey: task, situation: safeSituation.text, idMasked: safeSituation.masked, sessionId: getSessionId() } });
      setResult(nextResult);
      try {
        window.__lovableEvents?.track?.("project.checklist_shown", { task_key: task, source: nextResult.fallback ? "fallback" : "ai" });
        if (nextResult.fallback) window.__lovableEvents?.track?.("project.generate_failed", { task_key: task, kind: "ai_unavailable" });
      } catch { /* Analytics must never hide a checklist. */ }
      setTimeout(() => document.getElementById("result")?.scrollIntoView({ behavior: "smooth" }), 50);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Something went wrong.");
      try {
        window.__lovableEvents?.track?.("project.generate_failed", { task_key: task, kind: "request_failed" });
      } catch { /* Never send error messages or user input. */ }
    } finally {
      setLoading(false);
    }
  }

  return (
    <div>
      <h1 className="text-3xl font-semibold">What do you need to do?</h1>
      <p className="mt-2 text-muted-foreground">Pick one task.</p>
      <div className="mt-6 grid gap-3 sm:grid-cols-2" role="radiogroup">
        {TASKS.map((t) => (
          <button
            key={t.key}
            role="radio"
            aria-checked={task === t.key}
            onClick={() => {
              setTask(t.key);
              try {
                window.__lovableEvents?.track?.("project.task_selected", { task_key: t.key });
              } catch { /* Analytics must never block task selection. */ }
            }}
            className={cn(
              "flex items-center gap-3 rounded-xl border-2 bg-card px-4 py-4 text-left text-base font-semibold transition",
              task === t.key ? "border-primary bg-accent text-accent-foreground" : "border-border hover:border-primary/40",
            )}
          >
            <span aria-hidden className="text-2xl">{t.emoji}</span>
            {t.name}
          </button>
        ))}
      </div>

      <label className="mt-8 block font-bold" htmlFor="situation">Tell us your situation in one or two lines <span className="font-normal text-muted-foreground">(optional)</span></label>
      <Textarea
        id="situation"
        maxLength={500}
        value={situation}
        onChange={(e) => setSituation(e.target.value)}
        placeholder="I'm 19, I live in a PG in Bengaluru, my Aadhaar has my hometown address"
        className="mt-2 min-h-24 text-base"
      />
      <Button size="lg" className="mt-5 h-14 w-full rounded-full text-lg sm:w-auto sm:px-10" disabled={!task || loading} onClick={submit}>
        {loading ? "Building your checklist…" : "Get my checklist"}
      </Button>
      {!user && (
        <p className="mt-3 text-sm text-muted-foreground">
          <Link to="/auth" className="font-semibold text-primary underline-offset-4 hover:underline">Sign in</Link> to see which documents you already have.
        </p>
      )}
      {error && <p className="mt-4 rounded-lg bg-warning-soft p-4 text-foreground">{error}</p>}

      {result && task && <ChecklistView key={result.checklistId} result={result} held={held} taskKey={task} userId={user?.id ?? null} />}
    </div>
  );
}

function ChecklistView({ result, held, taskKey, userId }: { result: Result; held: Set<string> | null; taskKey: string; userId: string | null }) {
  const { output, source } = result;
  const groups = [...GROUPS, "Official document list"].map((g) => output.groups.find((x) => x.name === g)).filter((g): g is ChecklistOutput["groups"][number] => !!g && g.items.length > 0);
  return (
    <section id="result" className="mt-12 scroll-mt-20 space-y-5">
      {result.idMasked && <p role="status" className="text-sm text-muted-foreground">We removed an ID number from what you typed. Please never type ID numbers here; this app only needs document names.</p>}
      {output.headline && <h2 className="break-words text-2xl font-semibold">{output.headline}</h2>}
      {result.fallback && <div role="status" className="rounded-xl border border-warning/40 bg-warning-soft p-4 font-bold">Our AI is busy right now. Here is the official list for this task. Your situation was not checked.</div>}
      <div className="rounded-xl border border-warning/40 bg-warning-soft p-4 font-bold">
        Always confirm on the official site before you go.
      </div>
      <div>
        <h2 className="text-2xl font-semibold">{source.task_name}</h2>
        <p className="mt-1 text-sm text-muted-foreground">
          Source:{" "}
          <a href={source.official_url} target="_blank" rel="noreferrer" className="inline-flex items-center gap-1 font-semibold text-primary underline-offset-4 hover:underline">
            {source.official_url.replace("https://", "")} <ExternalLink className="h-3.5 w-3.5" />
          </a>{" "}
          · Last verified {new Date(source.last_verified).toLocaleDateString("en-IN", { day: "numeric", month: "short", year: "numeric" })} · {source.status_note}
        </p>
      </div>

      {output.warnings.length > 0 && (
        <div className="space-y-2">
          {output.warnings.map((w, i) => (
            <p key={i} className="flex gap-2 rounded-lg bg-warning-soft p-3 text-base"><AlertTriangle className="mt-1 h-4 w-4 shrink-0 text-warning" />{w}</p>
          ))}
        </div>
      )}

      {output.show_checklist && groups.map((g) => (
        <div key={g.name} className="rounded-2xl border border-border bg-card p-5 shadow-soft">
          <h3 className="text-lg font-semibold">{g.name}</h3>
          <ul className="mt-3 space-y-3">
            {g.items.map((it, i) => {
              const status = documentStatus(userId ? held : null, it);
              const id = `${g.name}-${i}`;
              return (
                <li key={id} className={cn("flex gap-3 rounded-lg p-2", status === "have" && "bg-success-soft", status === "missing" && "bg-warning-soft")}>
                  <Checkbox id={id} className="mt-1 h-5 w-5" defaultChecked={status === "have"} />
                  <label htmlFor={id} className="flex-1">
                    <span className="font-semibold">{it.document}</span>
                    {status === "have" && <span className="ml-2 inline-flex items-center gap-1 text-sm font-bold text-success"><Check className="h-4 w-4" />You have this</span>}
                    {status === "missing" && <span className="ml-2 inline-flex items-center gap-1 text-sm font-bold text-warning"><CircleDashed className="h-4 w-4" />Not in your documents</span>}
                    {it.fits_situation === true && <span className="ml-2 text-sm text-primary">Fits your situation</span>}
                    {it.fits_situation === false && <span className="ml-2 text-sm text-muted-foreground">May not fit your situation</span>}
                    {it.note && <span className="block text-sm text-muted-foreground">{it.note}</span>}
                  </label>
                </li>
              );
            })}
          </ul>
        </div>
      ))}

      {output.not_in_sources && (
        <p className="rounded-lg border border-border p-4 text-muted-foreground">
          {output.not_in_sources}{" "}
          <a href={source.official_url} target="_blank" rel="noreferrer" className="font-semibold text-primary">Official site</a>
        </p>
      )}

      <Feedback checklistId={result.checklistId} taskKey={taskKey} />
    </section>
  );
}

function Feedback({ checklistId, taskKey }: { checklistId: string | null; taskKey: string }) {
  const [vote, setVote] = useState<boolean | null>(null);
  const [comment, setComment] = useState("");
  const [sent, setSent] = useState(false);
  const [sending, setSending] = useState(false);
  const inFlight = useRef(false);

  async function send() {
    if (vote === null || inFlight.current || sent) return;
    inFlight.current = true;
    setSending(true);
    try {
      // A narrow write-only RPC performs the conflict-ignore upsert without
      // requiring anonymous SELECT permission on feedback for ON CONFLICT.
      const { error } = await supabase.rpc("submit_checklist_feedback", {
        ...(checklistId ? { p_checklist_id: checklistId } : {}),
        p_task_key: taskKey,
        p_is_correct: vote,
        p_comment: comment.trim(),
        p_session_id: getSessionId(),
      });
      if (error) throw error;
      setSent(true);
      try {
        window.__lovableEvents?.track?.("project.feedback_submitted", { task_key: taskKey, is_correct: vote });
      } catch { /* Analytics must never turn a saved response into an error. */ }
    } catch {
      toast.error("Couldn't save your feedback.");
    } finally {
      inFlight.current = false;
      setSending(false);
    }
  }

  if (sent) return <p className="rounded-xl bg-accent p-4 font-semibold text-accent-foreground">Thanks — that helps us improve.</p>;
  return (
    <div className="rounded-2xl border border-border p-5">
      <p className="font-bold">Was this checklist correct?</p>
      <div className="mt-3 flex gap-3">
        <Button variant={vote === true ? "default" : "outline"} size="lg" disabled={sending} onClick={() => setVote(true)} aria-label="Yes, correct"><ThumbsUp /></Button>
        <Button variant={vote === false ? "default" : "outline"} size="lg" disabled={sending} onClick={() => setVote(false)} aria-label="No, not correct"><ThumbsDown /></Button>
      </div>
      {vote !== null && (
        <>
          <Textarea className="mt-3 text-base" maxLength={1000} placeholder="Anything we got wrong? (optional)" value={comment} onChange={(e) => setComment(e.target.value)} />
          <Button className="mt-3" disabled={sending} onClick={send}>{sending ? "Sending…" : "Send feedback"}</Button>
        </>
      )}
    </div>
  );
}
