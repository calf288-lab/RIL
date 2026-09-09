export type AgentChatMessage = {
  role: "user" | "assistant";
  content: string;
};

export type AgentChatInput = {
  message: string;
  history: AgentChatMessage[];
  city?: string;
  purpose?: string;
  district?: string;
  mortgage?: string;
};

export async function askGoRouter(input: AgentChatInput) {
  const apiKey = process.env.GOROUTER_API_KEY;
  const baseUrl = (process.env.GOROUTER_BASE_URL || "https://gorouter.app/v1").replace(/\/+$/, "");
  if (!apiKey) throw new Error("GoRouter integration is not configured");

  const context = [
    input.city && `Город: ${input.city}`,
    input.purpose && `Цель: ${input.purpose}`,
    input.district && `Район: ${input.district}`,
    input.mortgage && `Ипотека: ${input.mortgage}`,
  ].filter(Boolean).join("; ");

  const response = await fetch(`${baseUrl}/chat/completions`, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${apiKey}`,
      "content-type": "application/json",
      Accept: "application/json",
      "User-Agent": "KazanskyAI/1.0",
    },
    body: JSON.stringify({
      model: "gpt-4o-mini",
      temperature: 0.35,
      max_tokens: 420,
      messages: [
        {
          role: "system",
          content: `Ты Амир — вежливый ИИ-агент риелтора по недвижимости в Казани и Татарстане. Отвечай на русском, коротко и по делу. Помогай понять районы, ипотеку, покупку, продажу и следующий шаг. Не выдумывай актуальные цены, наличие объектов, юридические гарантии или одобрение ипотеки. Если вопрос требует точных данных, предложи оставить контакт менеджеру. Не дави на звонок. Контекст клиента: ${context || "пока не указан"}.`,
        },
        ...input.history.slice(-12),
        { role: "user", content: input.message },
      ],
    }),
  });

  const rawBody = await response.text();
  let payload: {
    choices?: Array<{ message?: { content?: string } }>;
    error?: { message?: string };
  };
  try {
    payload = JSON.parse(rawBody) as typeof payload;
  } catch {
    throw new Error(`GoRouter вернул не JSON (${response.status}). Проверьте API endpoint и доступ ключа.`);
  }
  if (!response.ok) {
    throw new Error(payload.error?.message || `GoRouter request failed: ${response.statusText}`);
  }

  const content = payload.choices?.[0]?.message?.content?.trim();
  if (!content) throw new Error("GoRouter returned an empty response");
  return { content };
}
