import { createFileRoute } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { ShieldCheck, Trash2 } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { supabase } from "@/integrations/supabase/client";
import { DOC_TYPES } from "@/lib/tasks";

export const Route = createFileRoute("/_authenticated/documents")({
  head: () => ({
    meta: [
      { title: "My documents — DocAgent Lite" },
      { name: "description", content: "Keep a list of the documents you hold and when they expire." },
      { property: "og:title", content: "My documents — DocAgent Lite" },
      { property: "og:description", content: "Keep a list of the documents you hold and when they expire." },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary" },
    ],
  }),
  component: Documents,
});

type Doc = { id: string; doc_type: string; expiry_date: string | null };

function Documents() {
  const [docs, setDocs] = useState<Doc[]>([]);
  const [type, setType] = useState<string>("");
  const [expiry, setExpiry] = useState("");

  async function load() {
    const { data } = await supabase.from("user_documents").select("id, doc_type, expiry_date").order("created_at");
    setDocs(data ?? []);
  }
  useEffect(() => { load(); }, []);

  async function add(e: React.FormEvent) {
    e.preventDefault();
    if (!type) return;
    const { data: u } = await supabase.auth.getUser();
    const { error } = await supabase.from("user_documents").insert({ doc_type: type, expiry_date: expiry || null, user_id: u.user!.id });
    if (error) { toast.error("Couldn't add that document."); return; }
    setType(""); setExpiry(""); load();
  }
  async function remove(id: string) {
    await supabase.from("user_documents").delete().eq("id", id);
    load();
  }

  return (
    <div>
      <h1 className="text-3xl font-semibold">My documents</h1>
      <p className="mt-3 flex items-center gap-2 rounded-lg bg-accent px-3 py-2 text-sm text-accent-foreground">
        <ShieldCheck className="h-4 w-4 shrink-0" /> We never ask for ID numbers or photos of your documents.
      </p>

      <form onSubmit={add} className="mt-6 grid gap-3 rounded-2xl border border-border p-5 sm:grid-cols-[1fr_auto_auto] sm:items-end">
        <div>
          <label className="mb-1 block text-sm font-bold">Document</label>
          <Select value={type} onValueChange={setType}>
            <SelectTrigger className="h-12 text-base"><SelectValue placeholder="Choose a document" /></SelectTrigger>
            <SelectContent>{DOC_TYPES.map((d) => <SelectItem key={d} value={d}>{d}</SelectItem>)}</SelectContent>
          </Select>
        </div>
        <div>
          <label className="mb-1 block text-sm font-bold" htmlFor="exp">Expiry date <span className="font-normal text-muted-foreground">(optional)</span></label>
          <Input id="exp" type="date" value={expiry} onChange={(e) => setExpiry(e.target.value)} className="h-12 text-base" />
        </div>
        <Button type="submit" size="lg" className="h-12" disabled={!type}>Add</Button>
      </form>

      <ul className="mt-6 divide-y divide-border rounded-2xl border border-border">
        {docs.length === 0 && <li className="p-5 text-muted-foreground">No documents yet. Add the ones you have.</li>}
        {docs.map((d) => (
          <li key={d.id} className="flex items-center justify-between gap-3 p-4">
            <div>
              <p className="font-semibold">{d.doc_type}</p>
              <p className="text-sm text-muted-foreground">{d.expiry_date ? `Expires ${new Date(d.expiry_date).toLocaleDateString("en-IN", { day: "numeric", month: "short", year: "numeric" })}` : "No expiry"}</p>
            </div>
            <Button variant="ghost" size="icon" aria-label={`Remove ${d.doc_type}`} onClick={() => remove(d.id)}><Trash2 /></Button>
          </li>
        ))}
      </ul>
    </div>
  );
}
