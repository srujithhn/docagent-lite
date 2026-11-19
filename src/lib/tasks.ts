export const TASKS = [
  { key: "passport_fresh_adult", name: "Fresh passport (adult)", emoji: "🛂" },
  { key: "learner_licence_ka", name: "Learner's licence (Karnataka)", emoji: "🛵" },
  { key: "pan_new", name: "New PAN card", emoji: "🪪" },
  { key: "nsp_scholarship", name: "National Scholarship Portal application", emoji: "🎓" },
  { key: "bank_kyc", name: "Open a bank account (KYC)", emoji: "🏦" },
] as const;

export type TaskKey = (typeof TASKS)[number]["key"];

export const DOC_TYPES = [
  "Aadhaar",
  "PAN",
  "Passport",
  "Driving licence",
  "Voter ID",
  "10th marksheet",
  "12th marksheet",
  "Birth certificate",
  "Bank passbook",
  "Income certificate",
  "Caste certificate",
  "Other",
] as const;

export const GROUPS = ["Identity", "Address", "Date of birth", "Photos and forms", "Other"] as const;

export function getSessionId(): string {
  const k = "docagent_session";
  let id = localStorage.getItem(k);
  if (!id) {
    id = crypto.randomUUID();
    localStorage.setItem(k, id);
  }
  return id;
}

/** Documents expiring within `days` from `today`, soonest first. */
export function expiringWithin<T extends { expiry_date: string | null }>(docs: T[], today: Date, days = 90): T[] {
  const start = new Date(today.toISOString().slice(0, 10)).getTime();
  const limit = start + days * 86400000;
  return docs
    .filter((d) => d.expiry_date && new Date(d.expiry_date).getTime() >= start && new Date(d.expiry_date).getTime() <= limit)
    .sort((a, b) => a.expiry_date!.localeCompare(b.expiry_date!));
}

export function buildIcs(docType: string, expiry: string): string {
  const d = expiry.replace(/-/g, "");
  const next = new Date(new Date(expiry).getTime() + 86400000).toISOString().slice(0, 10).replace(/-/g, "");
  const stamp = new Date().toISOString().replace(/[-:]/g, "").split(".")[0] + "Z";
  return [
    "BEGIN:VCALENDAR",
    "VERSION:2.0",
    "PRODID:-//DocAgent Lite//EN",
    "BEGIN:VEVENT",
    `UID:${crypto.randomUUID()}@docagent-lite`,
    `DTSTAMP:${stamp}`,
    `DTSTART;VALUE=DATE:${d}`,
    `DTEND;VALUE=DATE:${next}`,
    `SUMMARY:${docType} expires`,
    "DESCRIPTION:Renew this document. Reminder from DocAgent Lite.",
    "BEGIN:VALARM",
    "ACTION:DISPLAY",
    `DESCRIPTION:${docType} expires in 90 days`,
    "TRIGGER:-P90D",
    "END:VALARM",
    "BEGIN:VALARM",
    "ACTION:DISPLAY",
    `DESCRIPTION:${docType} expires in 30 days`,
    "TRIGGER:-P30D",
    "END:VALARM",
    "END:VEVENT",
    "END:VCALENDAR",
  ].join("\r\n");
}
