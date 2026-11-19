import { createFileRoute, Link } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { CalendarPlus } from "lucide-react";
import { Button } from "@/components/ui/button";
import { supabase } from "@/integrations/supabase/client";
import { buildIcs, expiringWithin } from "@/lib/tasks";

export const Route = createFileRoute("/_authenticated/expiring")({
  head: () => ({
    meta: [
      { title: "Expiring soon — DocAgent Lite" },
      { name: "description", content: "Documents expiring in the next 90 days, with calendar reminders." },
      { property: "og:title", content: "Expiring soon — DocAgent Lite" },
      { property: "og:description", content: "Documents expiring in the next 90 days, with calendar reminders." },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary" },
    ],
  }),
  component: Expiring,
});

type Doc = { id: string; doc_type: string; expiry_date: string | null };

function download(doc: Doc) {
  const blob = new Blob([buildIcs(doc.doc_type, doc.expiry_date!)], { type: "text/calendar" });
  const a = document.createElement("a");
  a.href = URL.createObjectURL(blob);
  a.download = `${doc.doc_type.replace(/\s+/g, "-").toLowerCase()}-expiry.ics`;
  a.click();
  URL.revokeObjectURL(a.href);
}

function Expiring() {
  const [docs, setDocs] = useState<Doc[] | null>(null);
  useEffect(() => {
    supabase.from("user_documents").select("id, doc_type, expiry_date").then(({ data }) => setDocs(expiringWithin(data ?? [], new Date())));
  }, []);
  const days = (d: string) => Math.round((new Date(d).getTime() - new Date(new Date().toISOString().slice(0, 10)).getTime()) / 86400000);

  return (
    <div>
      <h1 className="text-3xl font-semibold">Expiring soon</h1>
      <p className="mt-2 text-muted-foreground">Documents expiring in the next 90 days.</p>
      <ul className="mt-6 space-y-3">
        {docs?.length === 0 && (
          <li className="rounded-2xl border border-border p-5 text-muted-foreground">
            Nothing expiring soon. <Link to="/documents" className="font-semibold text-primary">Add expiry dates</Link> to your documents.
          </li>
        )}
        {docs?.map((d) => (
          <li key={d.id} className="flex flex-wrap items-center justify-between gap-3 rounded-2xl border border-border bg-card p-5 shadow-soft">
            <div>
              <p className="text-lg font-semibold">{d.doc_type}</p>
              <p className="text-sm text-warning font-bold">
                {new Date(d.expiry_date!).toLocaleDateString("en-IN", { day: "numeric", month: "short", year: "numeric" })} · in {days(d.expiry_date!)} days
              </p>
            </div>
            <Button variant="outline" onClick={() => download(d)}><CalendarPlus /> Add reminder to calendar</Button>
          </li>
        ))}
      </ul>
    </div>
  );
}
