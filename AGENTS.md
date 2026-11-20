<!-- LOVABLE:BEGIN -->
> [!IMPORTANT]
> This project is connected to [Lovable](https://lovable.dev). Avoid rewriting
> published git history — force pushing, or rebasing/amending/squashing commits
> that are already pushed — as it rewrites history on Lovable's side and the
> user will likely lose their project history.
>
> Commits you push to the connected branch sync back to Lovable and show up in
> the editor, so keep the branch in a working state.

## What Lovable manages

Rules outside this block are the project's own. Change the pieces below in
Lovable, not by hand. With the [Lovable MCP](https://mcp.lovable.dev)
connected, `send_message` asks Lovable to do it; otherwise ask the user to
use the editor.

- **Database.** Do not add or edit `supabase/migrations/` or `drizzle/`.
  Ask Lovable to change the schema.
- **Generated files.** Do not edit a file whose header says it is automatically
  generated.
- **AI gateway.** Keep model calls on Lovable's gateway, and keep
  `LOVABLE_API_KEY` out of browser code.
- **Connectors.** Lovable provides native connectors. `list_connectors` shows
  which are enabled; `add_connector` only returns the dashboard link. When a
  connector is enabled, calls go through the connector gateway and need
  `LOVABLE_API_KEY`. When Lovable does not provide one, users can bring their
  own key and store it in Secrets.
- **Secrets.** Lovable manages them. Do not put secret values in the repo.
<!-- LOVABLE:END -->

- Document saves use the shared save helper and a database duplicate-prevention trigger; this preserves legacy duplicates while rejecting new ones and allowing expiry-only updates.
- Admin is a public route that shows denial when signed out; its metrics RPC authorizes against the current authenticated account record before reading aggregates, so direct calls cannot bypass access control.
- Checklist schemas, source-only fallback, ID masking, and ownership resolution live in a browser-safe shared module; server-only AI diagnostics redact sensitive values, and every AI failure returns source data without retries.
- Funnel instrumentation calls the injected Lovable events global directly in existing handlers, catches analytics failures, and relies on native page views/session IDs; never collect typed text, email addresses, or ID numbers.
- Feedback uses a checklist/session unique index and a narrow write-only database RPC that validates task/session/owner and conflict-ignores repeats; anonymous callers never need SELECT or UPDATE access to feedback.
- Email correction uses a pure provider-domain edit-distance function and an optional suggestion; never silently change addresses or block submission.
