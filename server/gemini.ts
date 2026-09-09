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

type GeminiResponse = {
  candidates?: Array<{
    content?: {
      parts?: Array<{ text?: string }>;
    };
    finishReason?: string;
  }>;
  error?: { message?: string };
};

const MODEL = "gemini-3.6-flash";
const API_URL = "https://generativelanguage.googleapis.com/v1beta/models";

export async function askGemini(input: AgentChatInput) {
  const apiKey = process.env.GEMINI_API_KEY;
  if (!apiKey) throw new Error("Gemini integration is not configured");

  const context = [
    input.city && `Город: ${input.city}`,
    input.purpose && `Цель: ${input.purpose}`,
    input.district && `Район: ${input.district}`,
    input.mortgage && `Ипотека: ${input.mortgage}`,
  ].filter(Boolean).join("; ");

  const contents = [
    ...input.history.slice(-12).map((message) => ({
      role: message.role === "assistant" ? "model" : "user",
      parts: [{ text: message.content }],
    })),
    { role: "user", parts: [{ text: input.message }] },
  ];

  const response = await fetch(`${API_URL}/${MODEL}:generateContent?key=${encodeURIComponent(apiKey)}`, {
    method: "POST",
    headers: {
      "content-type": "application/json",
      Accept: "application/json",
    },
    body: JSON.stringify({
      systemInstruction: {
        parts: [{
          text: `Ты Амир — вежливый ИИ-агент риелтора по недвижимости в Казани и Татарстане. Отвечай на русском, коротко и по делу. Помогай понять районы, ипотеку, покупку, продажу и следующий шаг. Не выдумывай актуальные цены, наличие объектов, юридические гарантии или одобрение ипотеки. Если вопрос требует точных данных, предложи оставить контакт менеджеру. Не дави на звонок. Контекст клиента: ${context || "пока не указан"}.`,
        }],
      },
      contents,
      generationConfig: {
        temperature: 0.35,
        maxOutputTokens: 420,
      },
    }),
  });

  const rawBody = await response.text();
  let payload: GeminiResponse;
  try {
    payload = JSON.parse(rawBody) as GeminiResponse;
  } catch {
    throw new Error(`Gemini вернул не JSON (${response.status}). Проверьте настройки API.`);
  }

  if (!response.ok) {
    throw new Error(payload.error?.message || `Gemini request failed: ${response.statusText}`);
  }

  const content = payload.candidates?.[0]?.content?.parts
    ?.map((part) => part.text || "")
    .join("")
    .trim();
  if (!content) throw new Error("Gemini returned an empty response");
  return { content };
}
