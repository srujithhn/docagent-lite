import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { useEffect, useRef, useState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/use-auth";
import { suggestEmailFix } from "@/lib/email";

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
  const sending = useRef(false);
  const viewed = useRef(false);
  const suggestedEmail = suggestEmailFix(email);

  useEffect(() => {
    if (viewed.current) return;
    viewed.current = true;
    // Only fixed internal paths, never query strings or external referrers.
    let from: string | null = null;
    try {
      from = sessionStorage.getItem("docagent_auth_from");
      sessionStorage.removeItem("docagent_auth_from");
    } catch { /* Storage is optional. */ }
    try {
      window.__lovableEvents?.track?.("project.auth_viewed", from === "/documents" || from === "/expiring" ? { from } : {});
    } catch { /* Analytics must never interrupt sign-in. */ }
  }, []);

  useEffect(() => {
    if (user) navigate({ to: "/documents" });
  }, [user, navigate]);

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    if (sending.current) return;
    sending.current = true;
    setError(null);
    setState("sending");
    try {
      const { error } = await supabase.auth.signInWithOtp({
        email: email.trim(),
        options: { emailRedirectTo: `${window.location.origin}/auth` },
      });
      if (error) throw error;
      setState("sent");
      try {
        window.__lovableEvents?.track?.("project.signup_submitted");
      } catch { /* Analytics must never interrupt sign-in. */ }
    } catch (error) {
      setError(error instanceof Error ? error.message : "Couldn't send your sign-in link. Please try again.");
      setState("idle");
    } finally {
      sending.current = false;
    }
  }

  return (
    <div className="mx-auto max-w-md">
      <h1 className="text-3xl font-semibold">Sign in</h1>
      <p className="mt-2 text-muted-foreground">We'll email you a link. No password needed.</p>
      <p className="mt-4 text-muted-foreground">Sign in to save your documents and get expiry reminders. You don't need an account to <Link to="/checklist" className="font-semibold text-primary underline underline-offset-4">get a checklist</Link>.</p>
      {state === "sent" ? (
        <div className="mt-8 rounded-xl border border-border bg-accent p-5">
          <p className="font-bold">Check your email</p>
          <p className="mt-1 text-muted-foreground">Open the link we sent to {email} on this device.</p>
        </div>
      ) : (
        <form onSubmit={submit} className="mt-8 space-y-4">
          <Input type="email" aria-label="Email address" required placeholder="you@college.edu" value={email} onChange={(e) => setEmail(e.target.value)} className="h-12 text-base" />
          {suggestedEmail && <Button type="button" variant="link" className="h-auto max-w-full whitespace-normal break-all p-0 text-left" onClick={() => setEmail(suggestedEmail)}>Did you mean {suggestedEmail}?</Button>}
          {error && <p className="text-sm text-destructive">{error}</p>}
          <Button type="submit" size="lg" className="h-12 w-full text-base" disabled={state === "sending"}>
            {state === "sending" ? "Sending…" : "Email me a sign-in link"}
          </Button>
        </form>
      )}
    </div>
  );
}
