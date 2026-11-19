import { createFileRoute } from "@tanstack/react-router";

export const Route = createFileRoute("/privacy")({
  head: () => ({
    meta: [
      { title: "Privacy — DocAgent Lite" },
      { name: "description", content: "What DocAgent Lite stores and what it never asks for." },
      { property: "og:title", content: "Privacy — DocAgent Lite" },
      { property: "og:description", content: "What DocAgent Lite stores and what it never asks for." },
      { property: "og:type", content: "article" },
      { name: "twitter:card", content: "summary" },
    ],
  }),
  component: Privacy,
});

function Privacy() {
  return (
    <article className="space-y-4">
      <h1 className="text-3xl font-semibold">Privacy</h1>
      <p>We never ask for ID numbers or photos of your documents.</p>
      <ul className="list-disc space-y-2 pl-6 text-muted-foreground">
        <li>If you sign in, we store your email address so we can send you a sign-in link.</li>
        <li>"My documents" only stores the document type (for example "PAN") and an optional expiry date.</li>
        <li>We log which task a checklist was made for, and when, to improve the app. The situation you type is sent to our AI step to build the checklist and is not saved.</li>
        <li>Feedback you give (thumbs up/down and an optional comment) is saved.</li>
      </ul>
      <p className="text-muted-foreground">This is a student project and is not affiliated with any government body.</p>
    </article>
  );
}
