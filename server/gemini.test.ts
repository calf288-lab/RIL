import { describe, expect, it } from "vitest";

describe("Gemini credentials", () => {
  it("authenticates against the Gemini models endpoint", async () => {
    const apiKey = process.env.GEMINI_API_KEY;
    expect(apiKey, "GEMINI_API_KEY must be configured").toBeTruthy();
    const response = await fetch(`https://generativelanguage.googleapis.com/v1beta/models?key=${encodeURIComponent(apiKey!)}`);
    expect(response.ok, `Gemini models request failed: ${response.status}`).toBe(true);
    const payload = (await response.json()) as { models?: Array<{ name?: string; supportedGenerationMethods?: string[] }> };
    expect(Array.isArray(payload.models)).toBe(true);
    const generationModels = payload.models
      ?.filter((model) => model.supportedGenerationMethods?.includes("generateContent"))
      .map((model) => model.name)
      .filter(Boolean);
    expect(generationModels?.length).toBeGreaterThan(0);
    console.log("Gemini generateContent models:", generationModels);
  }, 20_000);
});
