export const config = {
  runtime: 'nodejs',
  maxDuration: 30,
}

interface Message {
  role: 'user' | 'assistant'
  content: string
}

async function sendTelegram(input: any) {
  const { name, phone, message } = input?.json || input || {}
  const token = process.env.TELEGRAM_BOT_TOKEN
  const chatId = process.env.TELEGRAM_CHAT_ID
  if (!token || !chatId) throw new Error('Missing Telegram config')
  const text = `🏠 Новая заявка\n\nИмя: ${name || '—'}\nТелефон: ${phone || '—'}\nСообщение: ${message || '—'}\n\n${new Date().toLocaleString('ru-RU')}`
  const r = await fetch(`https://api.telegram.org/bot${token}/sendMessage`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ chat_id: chatId, text }),
  })
  if (!r.ok) throw new Error(`Telegram: ${r.status}`)
  return { success: true }
}

async function agentChat(input: any) {
  const { messages = [] } = input?.json || input || {}
  const key = process.env.GEMINI_API_KEY
  if (!key) throw new Error('Missing Gemini key')
  const system = `Ты — Амир, ИИ-агент по недвижимости в Казани. 18 лет опыта. Помогаешь с подбором, продажей, выкупом, управлением. Отвечай кратко, дружелюбно. По конкретным объектам предлагай связаться: +7 927 409-91-79.`
  const contents = [
    { role: 'user', parts: [{ text: system }] },
    ...messages.map((m: Message) => ({
      role: m.role === 'assistant' ? 'model' : 'user',
      parts: [{ text: m.content }],
    })),
  ]
  const r = await fetch(
    `https://generativelanguage.googleapis.com/v1beta/models/gemini-2.0-flash:generateContent?key=${key}`,
    {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ contents }),
    }
  )
  const d = await r.json()
  return d.candidates?.[0]?.content?.parts?.[0]?.text || 'Свяжитесь с Амиром: +7 927 409-91-79'
}

function catalogList() {
  return [
    { id: 1, title: '2-комн., 54 м²', address: 'Мавлютова 31а', price: 8500000 },
    { id: 2, title: 'Студия, 28 м²', address: 'Сибирский тракт 15', price: 4200000 },
    { id: 3, title: '3-комн., 78 м²', address: 'Баумана 44', price: 12500000 },
  ]
}

const handlers: Record<string, (i: any) => any | Promise<any>> = {
  'leads.sendTelegram': sendTelegram,
  'agent.chat': agentChat,
  'catalog.list': catalogList,
}

export default async function handler(req: Request): Promise<Response> {
  const url = new URL(req.url)
  const path = url.pathname.replace(/^\/api\/trpc\//, '')
  const headers = {
    'Content-Type': 'application/json',
    'Access-Control-Allow-Origin': '*',
    'Access-Control-Allow-Methods': 'GET, POST, OPTIONS',
    'Access-Control-Allow-Headers': 'Content-Type',
  }
  if (req.method === 'OPTIONS') return new Response(null, { status: 204, headers })

  try {
    let batchBody: Record<string, any>
    if (req.method === 'POST') {
      batchBody = await req.json()
    } else {
      const inp = url.searchParams.get('input')
      batchBody = inp ? JSON.parse(inp) : {}
    }
    const results = await Promise.all(
      Object.entries(batchBody).map(async ([, req]) => {
        const h = handlers[path]
        if (!h) return { error: { json: { message: `Unknown: ${path}` } } }
        try {
          return { result: { data: { json: await h(req) } } }
        } catch (e: any) {
          return { error: { json: { message: e.message } } }
        }
      })
    )
    return new Response(JSON.stringify(results), { status: 200, headers })
  } catch (e: any) {
    return new Response(
      JSON.stringify([{ error: { json: { message: e.message || 'Bad request' } } }]),
      { status: 400, headers }
    )
  }
}
