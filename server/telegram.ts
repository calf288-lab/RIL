export type TelegramLead = {
  name?: string;
  contact: string;
  source: string;
  city: string;
  purpose?: string;
  district?: string;
  mortgage?: string;
  pageUrl: string;
  referrer?: string;
  utm?: Record<string, unknown>;
  conversation?: string;
  properties?: string[];
};

function escapeHtml(value: string | undefined) {
  return String(value || "—")
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;");
}

function formatUtm(utm?: Record<string, unknown>) {
  if (!utm || Object.keys(utm).length === 0) return "—";
  return Object.entries(utm).map(([key, value]) => `${key}=${String(value)}`).join(" | ");
}

export async function sendTelegramLead(lead: TelegramLead) {
  const token = process.env.TELEGRAM_BOT_TOKEN;
  const chatId = process.env.TELEGRAM_CHAT_ID;

  if (!token || !chatId) {
    throw new Error("Telegram integration is not configured");
  }

  const moscowTime = new Intl.DateTimeFormat("ru-RU", {
    dateStyle: "short",
    timeStyle: "short",
    timeZone: "Europe/Moscow",
  }).format(new Date());

  const message = [
    "<b>Новый лид · Казанский·AI</b>",
    "",
    `<b>Контакт:</b> ${escapeHtml(lead.contact)}`,
    `<b>Имя:</b> ${escapeHtml(lead.name)}`,
    `<b>Источник:</b> ${escapeHtml(lead.source)}`,
    `<b>Город / район:</b> ${escapeHtml(lead.city)}${lead.district ? ` / ${escapeHtml(lead.district)}` : ""}`,
    `<b>Цель:</b> ${escapeHtml(lead.purpose)}`,
    `<b>Ипотека:</b> ${escapeHtml(lead.mortgage)}`,
    `<b>Объекты:</b> ${escapeHtml(lead.properties?.join("; "))}`,
    "",
    `<b>Диалог:</b> ${escapeHtml(lead.conversation)}`,
    "",
    `<b>Страница:</b> ${escapeHtml(lead.pageUrl)}`,
    `<b>Referrer:</b> ${escapeHtml(lead.referrer)}`,
    `<b>UTM:</b> ${escapeHtml(formatUtm(lead.utm))}`,
    `<b>Время:</b> ${moscowTime} (МСК)`,
  ].join("\n");

  const response = await fetch(`https://api.telegram.org/bot${token}/sendMessage`, {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify({
      chat_id: chatId,
      text: message,
      parse_mode: "HTML",
      disable_web_page_preview: true,
    }),
  });

  const payload = (await response.json()) as { ok?: boolean; description?: string };
  if (!response.ok || !payload.ok) {
    throw new Error(`Telegram sendMessage failed: ${payload.description || response.statusText}`);
  }

  return { ok: true as const };
}
