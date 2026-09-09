import { afterEach, describe, expect, it, vi } from "vitest";
import { sendTelegramLead } from "./telegram";

describe("sendTelegramLead", () => {
  afterEach(() => vi.unstubAllGlobals());

  it("sends the lead context, source, city and UTM data to Telegram", async () => {
    vi.stubEnv("TELEGRAM_BOT_TOKEN", "123456789:AA-test");
    vi.stubEnv("TELEGRAM_CHAT_ID", "619627066");
    const fetchMock = vi.fn().mockResolvedValue(
      new Response(JSON.stringify({ ok: true }), { status: 200 }),
    );
    vi.stubGlobal("fetch", fetchMock);

    await sendTelegramLead({
      name: "Марина",
      contact: "@marina",
      source: "Казанский·AI · плавающий ИИ-агент",
      city: "Казань и Татарстан",
      purpose: "Для инвестиций",
      district: "Альметьевск",
      mortgage: "Пока нет",
      pageUrl: "https://example.com/?utm_source=yandex",
      referrer: "https://yandex.ru/",
      utm: { utm_source: "yandex", utm_campaign: "realty" },
    });

    expect(fetchMock).toHaveBeenCalledOnce();
    const [, request] = fetchMock.mock.calls[0] as [string, RequestInit];
    const body = JSON.parse(String(request.body));
    expect(body.chat_id).toBe("619627066");
    expect(body.text).toContain("Казанский·AI");
    expect(body.text).toContain("Альметьевск");
    expect(body.text).toContain("utm_source=yandex");
  });
});
