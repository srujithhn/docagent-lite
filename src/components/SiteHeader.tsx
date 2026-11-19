import { Link } from "@tanstack/react-router";
import { useAuth, ADMIN_EMAIL } from "@/hooks/use-auth";
import { supabase } from "@/integrations/supabase/client";

export function SiteHeader() {
  const { user } = useAuth();
  const linkCls = "rounded-full px-3 py-1.5 text-sm font-semibold text-muted-foreground hover:text-foreground";
  const active = { className: "rounded-full px-3 py-1.5 text-sm font-semibold bg-accent text-accent-foreground" };
  return (
    <header className="sticky top-0 z-20 border-b border-border bg-background/95 backdrop-blur">
      <div className="mx-auto flex max-w-3xl items-center justify-between gap-2 px-4 py-3">
        <Link to="/" className="font-display text-xl font-semibold text-foreground">
          DocAgent <span className="text-primary">Lite</span>
        </Link>
        <nav className="flex flex-wrap items-center justify-end gap-1">
          <Link to="/checklist" className={linkCls} activeProps={active}>Checklist</Link>
          <Link to="/documents" className={linkCls} activeProps={active}>My documents</Link>
          <Link to="/expiring" className={linkCls} activeProps={active}>Expiring</Link>
          {user?.email?.toLowerCase() === ADMIN_EMAIL && (
            <Link to="/admin" className={linkCls} activeProps={active}>Admin</Link>
          )}
          {user ? (
            <button className={linkCls} onClick={() => supabase.auth.signOut()}>Sign out</button>
          ) : (
            <Link to="/auth" className={linkCls} activeProps={active}>Sign in</Link>
          )}
        </nav>
      </div>
    </header>
  );
}

export function SiteFooter() {
  return (
    <footer className="mt-16 border-t border-border">
      <div className="mx-auto max-w-3xl px-4 py-8 text-sm text-muted-foreground">
        <p>DocAgent Lite is a student project. It is not affiliated with any government body.</p>
        <Link to="/privacy" className="mt-2 inline-block font-semibold text-primary underline-offset-4 hover:underline">
          Privacy
        </Link>
      </div>
    </footer>
  );
}
