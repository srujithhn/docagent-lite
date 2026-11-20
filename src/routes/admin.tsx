import { createFileRoute } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/use-auth";

export const Route = createFileRoute("/admin")({
  head: () => ({
    meta: [
      { title: "Admin metrics — DocAgent Lite" },
      { name: "description", content: "Usage metrics for DocAgent Lite." },
      { name: "robots", content: "noindex" },
      { property: "og:title", content: "Admin metrics — DocAgent Lite" },
      { property: "og:description", content: "Usage metrics for DocAgent Lite." },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary" },
    ],
  }),
  component: Admin,
});

type Metrics = {
  signups: number;
  checklists_total: number;
  per_task: { task_name: string; count: number }[];
  feedback_total: number;
  thumbs_up: number;
  returning_users: number;
  per_day: { day: string; count: number }[];
};

function Admin() {
  const { user, loading } = useAuth();
  const [m, setM] = useState<Metrics | null>(null);
  const [denied, setDenied] = useState(false);
  useEffect(() => {
    let active = true;
    setM(null);
    setDenied(false);
    if (loading) return;
    async function load() {
      const { data: auth } = await supabase.auth.getUser();
      if (!active) return;
      if (!auth.user) { setDenied(true); return; }
      const { data, error } = await supabase.rpc("admin_metrics");
      if (!active) return;
      if (error || !data) setDenied(true);
      else setM(data as unknown as Metrics);
    }
    load().catch(() => { if (active) setDenied(true); });
    return () => { active = false; };
  }, [user?.id, loading]);

  if (denied) return <p className="text-lg">Not authorised</p>;
  if (!m) return <p className="text-muted-foreground">Loading…</p>;
  const max = Math.max(1, ...m.per_day.map((d) => d.count));
  const share = m.feedback_total ? Math.round((m.thumbs_up / m.feedback_total) * 100) : 0;

  return (
    <div className="space-y-8">
      <h1 className="text-3xl font-semibold">Admin metrics</h1>
      <div className="grid grid-cols-2 gap-3">
        <Stat label="Sign-ups" value={m.signups} />
        <Stat label="Checklists created" value={m.checklists_total} />
        <Stat label="Thumbs up" value={`${share}%`} sub={`${m.thumbs_up} of ${m.feedback_total}`} />
        <Stat label="Came back after 7+ days" value={m.returning_users} />
      </div>
      <div className="rounded-2xl border border-border p-5">
        <h2 className="text-lg font-semibold">Checklists per task</h2>
        <ul className="mt-3 space-y-2">
          {m.per_task.map((t) => (
            <li key={t.task_name} className="flex justify-between"><span>{t.task_name}</span><span className="font-bold">{t.count}</span></li>
          ))}
        </ul>
      </div>
      <div className="rounded-2xl border border-border p-5">
        <h2 className="text-lg font-semibold">Checklists per day (last 30 days)</h2>
        <div className="mt-4 flex h-40 items-end gap-1">
          {m.per_day.map((d) => (
            <div key={d.day} title={`${d.day}: ${d.count}`} className="flex-1 rounded-t bg-primary" style={{ height: `${Math.max(2, (d.count / max) * 100)}%`, opacity: d.count ? 1 : 0.2 }} />
          ))}
        </div>
        <div className="mt-2 flex justify-between text-xs text-muted-foreground">
          <span>{m.per_day[0]?.day}</span><span>{m.per_day.at(-1)?.day}</span>
        </div>
      </div>
    </div>
  );
}

function Stat({ label, value, sub }: { label: string; value: number | string; sub?: string }) {
  return (
    <div className="rounded-2xl border border-border bg-card p-5 shadow-soft">
      <p className="text-sm text-muted-foreground">{label}</p>
      <p className="mt-1 font-display text-3xl font-semibold">{value}</p>
      {sub && <p className="text-xs text-muted-foreground">{sub}</p>}
    </div>
  );
}
