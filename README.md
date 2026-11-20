# DocAgent Lite

DocAgent Lite tells Indian college students which documents they need for five common government tasks. It answers only from official sources, and when the source doesn't cover a question it says "Not in our sources yet" instead of guessing.

**Live app:** https://docagent-lite.lovable.app (no sign-in needed)

## Why I built it

Students lose whole days at a Passport Seva Kendra, RTO or bank branch because one document is wrong: an Aadhaar with the hometown address, a certificate in an old surname, a bank account not linked to Aadhaar. The rules exist, but they're spread across official sites. I wanted one place that reads the rules for you, checks them against your situation, and shows its source.

## What it does

- **Five tasks:** fresh passport (adult), learner's licence (Karnataka), new PAN card, National Scholarship Portal, bank account KYC.
- **One line about your situation** ("I'm 19, I live in a PG in Bengaluru, my Aadhaar has my hometown address") turns a generic list into a checklist that marks what you already have and flags likely problems.
- **Every checklist shows its official link and the date the rules were last verified.**
- **Optional sign-in** to save which documents you hold and get calendar reminders before they expire.

## How I check that it's right

I treat the checklist like a product spec: it's only as good as its test results.

| Round | Cases | Result |
| --- | --- | --- |
| First run | 20 cases I wrote: normal, tricky, out of scope, unsafe | 7 of 20 (35%) |
| After fixes | The same 20 | 20 of 20 (100%) |
| Blind test | 10 new cases, pass rules written before running | 6 of 10 (60%) |

It never invented a rule in any round. The failures came from three places, none of them the model itself: gaps in the official content I'd given it, a UI bug that called a document "missing" right after the user said they had it, and refusals that weren't firm enough. The 100% is flattering because I fixed against those same cases; the blind 60% is the honest number. Its two misses to fix next: it drops steps it knows (like the learner's test) when the question is about something else, and it says what's missing without saying what to do next.

## What real usage taught me (first two days)

- **116 visitors, fewer than 1 in 10 reached a checklist.** I added step-by-step funnel tracking to find where people drop off.
- **One person needed three tries to sign up**, one of them with "gma8l.com". The sign-in page now suggests "Did you mean gmail.com?".
- **One click on feedback saved two or three rows.** Feedback is now limited to one per checklist per visitor.
- **The only negative review said the passport list missed education proof and police verification.** Both are now in, taken from passportindia.gov.in.

## Safety and privacy

- Aadhaar and PAN numbers are removed from what you type before anything reaches the AI.
- No document photos, uploads or ID numbers are ever stored, only document names and expiry dates.
- Requests to fake or edit a certificate are refused.
- If the AI fails, the app still shows the official document list instead of an error.

## How it's built

- **App:** built with [Lovable](https://lovable.dev): TanStack Start, React, Tailwind.
- **Data and sign-in:** Lovable Cloud (Postgres with row-level security, email magic links).
- **AI:** an OpenAI model through Lovable's AI gateway, answering in a fixed JSON format checked against a schema. If the gateway runs out of credits, the app switches to the owner's own Gemini key.
- **Tests:** 81 automated tests (Vitest), covering the fallback, ID masking and checklist rules.

## What's next

- Always show each task's official steps, so the AI can't leave them out.
- Voice input in Kannada and Hindi, for the Scaler x Wispr Flow "Build for Bharat" hackathon.
- A second blind eval round after those fixes.

## Run it locally

```sh
git clone https://github.com/srujithhn/docagent-lite
cd docagent-lite
bun install
bun run dev
bun run test
```

Built by [Srujith H N](https://www.linkedin.com/in/srujith-h-n-b7b000267), CSE at BMSIT, Bengaluru.
