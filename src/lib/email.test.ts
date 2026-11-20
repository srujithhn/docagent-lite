import { describe, expect, it } from "vitest";
import { suggestEmailFix } from "./email";

describe("suggestEmailFix", () => {
  it.each(["gma8l.com", "gmial.com", "gmail.con", "gmail.cmo"])("suggests gmail.com for %s", (domain) => {
    expect(suggestEmailFix(`name@${domain}`)).toBe("name@gmail.com");
  });
  it.each(["gmail.com", "yahoo.com", "outlook.com", "hotmail.com", "icloud.com", "rediffmail.com"])("leaves correct %s addresses alone", (domain) => {
    expect(suggestEmailFix(`name@${domain}`)).toBeNull();
  });
  it.each(["acme.com", "college.edu", "example.org", "company.com"])("leaves unrelated %s alone", (domain) => {
    expect(suggestEmailFix(`name@${domain}`)).toBeNull();
  });
  it.each(["yaho.com", "outlok.com", "hotmal.com", "iclod.com", "rediffmil.com"])("corrects %s", (domain) => {
    const expected = { "yaho.com": "yahoo.com", "outlok.com": "outlook.com", "hotmal.com": "hotmail.com", "iclod.com": "icloud.com", "rediffmil.com": "rediffmail.com" };
    expect(suggestEmailFix(`Student.Name+tag@${domain}`)).toBe(`Student.Name+tag@${expected[domain as keyof typeof expected]}`);
  });
  it.each(["", "name", "@gmail.con", "name@@gmail.com", "name@gma il.com"])("rejects malformed input %s", (email) => {
    expect(suggestEmailFix(email)).toBeNull();
  });
});