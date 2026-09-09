import { describe, expect, it } from "vitest";

describe("GoRouter credentials", () => {
  it("can access the OpenAI-compatible models endpoint", async () => {
    const apiKey = process.env.GOROUTER_API_KEY;
    const baseUrl = (process.env.GOROUTER_BASE_URL || "https://gorouter.app/v1").replace(/\/+$/, "");
    expect(apiKey, "GOROUTER_API_KEY must be configured").toBeTruthy();

    const response = await fetch(`${baseUrl}/models`, {
      headers: { Authorization: `Bearer ${apiKey}` },
    });
    expect(response.ok).toBe(true);

    const payload = (await response.json()) as { data?: Array<{ id?: string }> };
    expect(Array.isArray(payload.data)).toBe(true);
  }, 15_000);
});
