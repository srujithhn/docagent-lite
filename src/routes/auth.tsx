import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/use-auth";

export const Route = createFileRoute("/auth")({
  head: () => ({
    meta: [
      { title: "Sign in — DocAgent Lite" },
      { name: "description", content: "Sign in with a one-time email link to save your documents and expiry reminders." },
      { property: "og:title", content: "Sign in — DocAgent Lite" },
      { property: "og:description", content: "Sign in with a one-time email link." },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary" },
    ],
  }),
  component: AuthPage,
});

function AuthPage() {
  const { user } = useAuth();
  const navigate = useNavigate();
  const [email, setEmail] = useState("");
  const [state, setState] = useState<"idle" | "sending" | "sent">("idle");
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (user) navigate({ to: "/documents" });
  }, [user, navigate]);

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    setState("sending");
    const { error } = await supabase.auth.signInWithOtp({
      email: email.trim(),
      options: { emailRedirectTo: `${window.location.origin}/auth` },
    });
    if (error) {
      setError(error.message);
      setState("idle");
    } else setState("sent");
  }

  return (
    <div className="mx-auto max-w-md">
      <h1 className="text-3xl font-semibold">Sign in</h1>
      <p className="mt-2 text-muted-foreground">We'll email you a link. No password needed.</p>
      {state === "sent" ? (
        <div className="mt-8 rounded-xl border border-border bg-accent p-5">
          <p className="font-bold">Check your email</p>
          <p className="mt-1 text-muted-foreground">Open the link we sent to {email} on this device.</p>
        </div>
      ) : (
        <form onSubmit={submit} className="mt-8 space-y-4">
          <Input type="email" required placeholder="you@college.edu" value={email} onChange={(e) => setEmail(e.target.value)} className="h-12 text-base" />
          {error && <p className="text-sm text-destructive">{error}</p>}
          <Button type="submit" size="lg" className="h-12 w-full text-base" disabled={state === "sending"}>
            {state === "sending" ? "Sending…" : "Email me a sign-in link"}
          </Button>
        </form>
      )}
    </div>
  );
}
