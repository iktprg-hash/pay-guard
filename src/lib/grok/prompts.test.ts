import { describe, expect, it } from "vitest";
import { parseProfileUpdate } from "@/lib/grok/prompts";

describe("parseProfileUpdate", () => {
  it("parses valid profile_update block", () => {
    const content = `Hello!
\`\`\`profile_update
{
  "availableFunds": 5000,
  "debts": [
    {
      "creditor": "Landlord",
      "amount": 12000,
      "category": "housing",
      "dueDate": "2026-06-15"
    }
  ],
  "readyForRecommendation": true
}
\`\`\``;

    const result = parseProfileUpdate(content);
    expect(result).not.toBeNull();
    expect(result?.availableFunds).toBe(5000);
    expect(result?.debts).toHaveLength(1);
    expect(result?.debts?.[0].creditor).toBe("Landlord");
    expect(result?.readyForRecommendation).toBe(true);
  });

  it("rejects invalid profile_update (amount out of range)", () => {
    const content = `\`\`\`profile_update
{ "availableFunds": 999999999999, "debts": [] }
\`\`\``;
    expect(parseProfileUpdate(content)).toBeNull();
  });

  it("rejects malicious extra fields only when schema fails", () => {
    const content = `\`\`\`profile_update
{ "availableFunds": 100, "debts": [{ "creditor": "", "amount": -1, "category": "other" }] }
\`\`\``;
    expect(parseProfileUpdate(content)).toBeNull();
  });

  it("returns null when block missing", () => {
    expect(parseProfileUpdate("No update here")).toBeNull();
  });
});
