import { describe, expect, it } from "vitest";
import { SYSTEM_PROMPT, SYSTEM_PROMPT_VERSION } from "@/lib/prompts/system";

describe("SYSTEM_PROMPT", () => {
  it("declares a version", () => {
    expect(SYSTEM_PROMPT_VERSION).toBeGreaterThan(0);
  });

  it("contains the critical invariant sections", () => {
    expect(SYSTEM_PROMPT).toContain("RÈGLES IMPÉRATIVES");
    expect(SYSTEM_PROMPT).toContain("FORMAT DES CITATIONS");
    expect(SYSTEM_PROMPT).toContain("[PAGE X]");
  });

  it("requires citations with literal quotes in the expected bracket format", () => {
    expect(SYSTEM_PROMPT).toMatch(/\[p\. X:\s*"extrait/);
  });

  it("forbids fabrication", () => {
    expect(SYSTEM_PROMPT).toMatch(/n['']invente[s]? JAMAIS/i);
  });
});
