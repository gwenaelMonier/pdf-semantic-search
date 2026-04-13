import { describe, expect, it } from "vitest";
import { HR_SYSTEM_PROMPT, HR_SYSTEM_PROMPT_VERSION } from "@/lib/prompts/system";

describe("HR_SYSTEM_PROMPT", () => {
  it("declares a version", () => {
    expect(HR_SYSTEM_PROMPT_VERSION).toBeGreaterThan(0);
  });

  it("contains the critical invariant sections", () => {
    expect(HR_SYSTEM_PROMPT).toContain("RÈGLES IMPÉRATIVES");
    expect(HR_SYSTEM_PROMPT).toContain("FORMAT DES CITATIONS");
    expect(HR_SYSTEM_PROMPT).toContain("[PAGE X]");
  });

  it("requires citations with literal quotes in the expected bracket format", () => {
    expect(HR_SYSTEM_PROMPT).toMatch(/\[p\. X:\s*"extrait/);
  });

  it("forbids fabrication", () => {
    expect(HR_SYSTEM_PROMPT).toMatch(/n['’]invente[s]? JAMAIS/i);
  });
});
