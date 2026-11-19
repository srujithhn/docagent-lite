import { describe, expect, it } from "vitest";
import { buildIcs, expiringWithin } from "./tasks";

describe("expiring soon", () => {
  const today = new Date("2026-11-19T10:00:00Z");
  const docs = [
    { id: "a", expiry_date: "2027-02-10" },
    { id: "b", expiry_date: "2026-12-01" },
    { id: "c", expiry_date: "2027-03-01" }, // 102 days away
    { id: "d", expiry_date: null },
    { id: "e", expiry_date: "2026-11-01" }, // already past
  ];
  it("lists only documents expiring within 90 days, soonest first", () => {
    expect(expiringWithin(docs, today).map((d) => d.id)).toEqual(["b", "a"]);
  });
});

describe("calendar reminder", () => {
  it("has alerts 90 and 30 days before expiry", () => {
    const ics = buildIcs("Passport", "2027-01-15");
    expect(ics).toContain("DTSTART;VALUE=DATE:20270115");
    expect(ics).toContain("TRIGGER:-P90D");
    expect(ics).toContain("TRIGGER:-P30D");
  });
});
