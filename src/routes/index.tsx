import { createFileRoute, Link } from "@tanstack/react-router";
import { Button } from "@/components/ui/button";
import { TASKS } from "@/lib/tasks";

export const Route = createFileRoute("/")({
  head: () => ({
    meta: [
      { title: "DocAgent Lite — document checklists for Indian students" },
      { name: "description", content: "Know exactly which documents you need for a passport, PAN, licence, scholarship or bank KYC — before you join the queue." },
      { property: "og:title", content: "DocAgent Lite" },
      { property: "og:description", content: "Know exactly which documents you need, before you join the queue." },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary" },
    ],
  }),
  component: Index,
});

function Index() {
  return (
    <div className="py-8 sm:py-16">
      <p className="text-sm font-bold uppercase tracking-widest text-primary">For college students in India</p>
      <h1 className="mt-4 text-4xl font-semibold leading-tight text-foreground sm:text-5xl">
        Know exactly which documents you need, before you join the queue.
      </h1>
      <p className="mt-5 max-w-xl text-lg text-muted-foreground">
        Pick a government task, tell us your situation in a line, and get a clear checklist based on official sources.
      </p>
      <Button asChild size="lg" className="mt-8 h-14 rounded-full px-8 text-lg">
        <Link to="/checklist">Get my checklist</Link>
      </Button>
      <p className="mt-3 text-sm text-muted-foreground">No sign-in needed.</p>

      <ul className="mt-14 grid gap-3 sm:grid-cols-2">
        {TASKS.map((t) => (
          <li key={t.key} className="flex items-center gap-3 rounded-xl border border-border bg-card px-4 py-3 text-base">
            <span aria-hidden className="text-2xl">{t.emoji}</span>
            {t.name}
          </li>
        ))}
      </ul>
    </div>
  );
}
