# Docagent Lite

Build "DocAgent Lite": a mobile-first web app that tells Indian college students exactly which documents they need for a government task, which ones they already have, and reminds them before anything expires. Use Lovable Cloud (auth + database) and Lovable AI for the AI step, so no API key ever sits in the browser. Calm, clean design (white background, one accent colour, large readable text), works well on a phone.

TAGLINE: "Know exactly which documents you need, before you join the queue."

PAGES AND FEATURES

1. Landing page: tagline, a one-line explanation, a "Get my checklist" button. Trying the checklist must NOT require sign-in.

2. Checklist generator (no login needed):
- User picks ONE task from 5 cards: "Fresh passport (adult)", "Learner's licence (Karnataka)", "New PAN card", "National Scholarship Portal application", "Open a bank account (KYC)".
- Optional text box: "Tell us your situation in one or two lines" (example placeholder: "I'm 19, I live in a PG in Bengaluru, my Aadhaar has my hometown address").
- An edge function calls Lovable AI with ONLY the source text for that task from the `sources` table (below) plus the user's situation. System prompt: "You help Indian students prepare documents. Answer ONLY from the SOURCE TEXT. Group the checklist into: Identity, Address, Date of birth, Photos and forms, Other. For each group list the accepted documents and mark which fit the user's situation. Add short warnings for likely problems (e.g. address on ID doesn't match current address). If the user asks about something not in the SOURCE TEXT, say 'Not in our sources yet' and point to the official link. Never invent fees, dates or rules. Output JSON."
- Render the checklist as tidy grouped cards with checkboxes. Every checklist shows: the official source link, the source's 'last verified' date, and a banner: "Always confirm on the official site before you go."
- Under each checklist: "Was this checklist correct?" thumbs up / thumbs down + optional comment, saved to a `feedback` table.
- Log every generated checklist to a `checklists` table (task, created_at, user_id if signed in, anonymous session id otherwise).

3. My documents (sign-in with email magic link):
- User adds documents from a pick list (Aadhaar, PAN, Passport, Driving licence, Voter ID, 10th marksheet, 12th marksheet, Birth certificate, Bank passbook, Income certificate, Caste certificate, Other) with an OPTIONAL expiry date.
- There is NO field for ID numbers and NO file upload. Show a small privacy note: "We never ask for ID numbers or photos of your documents."
- When a signed-in user generates a checklist, mark items they already hold in green and missing ones in amber.

4. Expiring soon:
- List the user's documents expiring within 90 days, soonest first.
- "Add reminder to calendar" button downloads an .ics file with two alerts: 90 days and 30 days before expiry.

5. Admin metrics page at /admin, visible only to srujithh@gmail.com:
- Total sign-ups, checklists created (total and per task), share of thumbs-up, and number of users who came back 7+ days after their first visit. Simple cards plus a per-day count of checklists for the last 30 days.

DATA
- `sources` table: task_key, task_name, official_url, source_text, last_verified (date). Seed with these 5 rows (last_verified 2026-11-19; mark each as "Draft: verify against the official page"):

a) passport_fresh_adult | Fresh passport (adult) | https://www.passportindia.gov.in | "Applicants need proof of present address, proof of date of birth and identity documents. Proof of present address: one document such as Aadhaar, Voter ID, water/electricity/telephone/gas bill, bank account passbook or statement, rent agreement, or Income Tax assessment order. The address on the proof must match the address in the application form. Proof of date of birth: one document such as birth certificate, school leaving or matriculation certificate, PAN card, Aadhaar, driving licence or voter ID with the full date of birth. Carry originals and self-attested photocopies to the Passport Seva Kendra. Use the official Document Advisor on Passport Seva for your exact case."

b) learner_licence_ka | Learner's licence (Karnataka) | https://sarathi.parivahan.gov.in | "Apply on the Parivahan Sarathi portal. Documents: Form 2 (application for learner's licence), proof of age, proof of address, recent passport-size photographs, and Form 1 (self-declaration of physical fitness). Form 1A medical certificate is needed for transport vehicles and for older applicants. Accepted age proof includes birth certificate, school leaving certificate, Aadhaar or passport; address proof includes Aadhaar, passport, voter ID or utility bills. Minimum age is 18 for a motor vehicle with gears, 16 for gearless vehicles up to 50cc with guardian consent."

c) pan_new | New PAN card | https://www.incometaxindia.gov.in | "Individuals need proof of identity, proof of address and proof of date of birth. Accepted documents include Aadhaar, Indian passport, driving licence and voter ID. The name on every document must match the name in the application exactly. Rules changed in 2026: check whether Aadhaar alone is accepted for date of birth or whether a separate proof of date of birth is needed. Apply through the Protean (NSDL) or UTIITSL portals."

d) nsp_scholarship | National Scholarship Portal application | https://scholarships.gov.in | "Register once on NSP (One-Time Registration). Commonly needed: Aadhaar (or Aadhaar enrolment receipt), a bank account in the student's own name seeded with Aadhaar for direct benefit transfer, income certificate, caste or community certificate if applying under a category, previous year marksheet, fee receipt, bonafide or student certificate from the institution, passport-size photo. Exact documents depend on the scheme. Note: Karnataka state scholarships go through the state SSP portal, not NSP."

e) bank_kyc | Open a bank account (KYC) | https://www.rbi.org.in | "Banks need PAN (or Form 60 if you have no PAN) and one Officially Valid Document (OVD): passport, driving licence, proof of possession of Aadhaar, voter ID, NREGA job card signed by a state official, or letter from the National Population Register. If the OVD shows your current address, it works as both identity and address proof. People without any OVD can open a 'small account' with limits."

- `user_documents` (user_id, doc_type, expiry_date, created_at), `checklists`, `feedback` tables with row-level security so users only see their own data; admin page reads aggregates only.

FOOTER: "DocAgent Lite is a student project. It is not affiliated with any government body." plus a link to a short privacy page.

Build it end to end with the seed data in place, then make sure the checklist flow works for all 5 tasks without signing in.

This project was built with [Lovable](https://lovable.dev).

**Live app**: https://docagent-lite.lovable.app

## Build with Lovable

Continue developing this project in the [Lovable editor](https://lovable.dev/projects/eeb7aade-2dac-484a-a11c-913bc09faaec).

- **Ship faster**: describe what you want to build and Lovable handles the code.
- **Stay in sync**: every change made in Lovable is committed straight to this repository.
- **Full ownership**: this code is yours. Push to `main` on GitHub and your changes sync back into Lovable, ready for your next prompt.

## Development

Prefer working locally? You need Node.js and npm — [install with nvm](https://github.com/nvm-sh/nvm#installing-and-updating).

```sh
git clone <this-repository-url>
cd <repository-name>
npm i
npm run dev
```
