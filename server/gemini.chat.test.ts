import { describe, expect, it } from "vitest";
import { askGemini } from "./gemini";

describe("Gemini chat", () => {
  it("generates a Russian response with Gemini 3.6 Flash", async () => {
    const result = await askGemini({
      message: "Ответь одним коротким предложением: что проверить перед покупкой квартиры?",
      history: [],
      city: "Казань",
      district: "Вахитовский район",
    });
    expect(result.content.length).toBeGreaterThan(0);
  }, 30_000);
});
