type Handler = (input: any) => any | Promise<any>

const TRPC_INTERNAL = -32603
const SYSTEM =
  'Ты — Амир, ИИ-агент по недвижимости в Казани. 18 лет опыта. Помогаешь с подбором, продажей, выкупом и управлением квартирами. Отвечай кратко, дружелюбно и по делу. По конкретным объектам предлагай связаться с Амиром: +7 927 409-91-79.'

function errorEnvelope(message: string, procedure: string) {
  return {
    error: {
      json: {
        message,
        code: TRPC_INTERNAL,
        data: { code: 'INTERNAL_SERVER_ERROR', httpStatus: 500, path: procedure },
      },
    },
  }
}

const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms))

function replyObject(t: string) {
  return { reply: t, text: t, message: t, content: t, answer: t, response: t }
}

async function groqChat(messages: any[], key: string): Promise<string | null> {
  try {
    const r = await fetch('https://api.groq.com/openai/v1/chat/completions', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Authorization: 'Bearer ' + key },
      body: JSON.stringify({
        model: 'openai/gpt-oss-20b',
        temperature: 0.7,
        messages: [
          { role: 'system', content: SYSTEM },
          ...messages.map((m) => ({
            role: m.role === 'assistant' ? 'assistant' : 'user',
            content: String(m.content || ''),
          })),
        ],
      }),
    })
    if (!r.ok) return null
    const d: any = await r.json()
    const t = d?.choices?.[0]?.message?.content
    return t && t.trim() ? t : null
  } catch {
    return null
  }
}

async function geminiChat(
  messages: any[],
  key: string,
): Promise<{ text: string | null; lastStatus: number }> {
  const models = ['gemini-3.6-flash', 'gemini-3-flash', 'gemini-flash-latest', 'gemini-2.5-flash']
  const contents = [
    { role: 'user', parts: [{ text: SYSTEM }] },
    ...messages.map((m) => ({
      role: m.role === 'assistant' ? 'model' : 'user',
      parts: [{ text: String(m.content || '') }],
    })),
  ]
  let lastStatus = 0
  for (const model of models) {
    for (let attempt = 0; attempt < 2; attempt++) {
      try {
        const r = await fetch(
          'https://generativelanguage.googleapis.com/v1beta/models/' +
            model +
            ':generateContent?key=' +
            key,
          {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ contents }),
          },
        )
        lastStatus = r.status
        if (!r.ok) {
          if (r.status === 503) await sleep(800)
          continue
        }
        const d: any = await r.json()
        const t = d?.candidates?.[0]?.content?.parts?.[0]?.text
        if (t && t.trim()) return { text: t, lastStatus }
      } catch {
        /* next attempt */
      }
    }
  }
  return { text: null, lastStatus }
}

async function sendTelegram(input: any) {
  const data = input?.json || input || {}
  const { name, phone, message } = data
  const token = process.env.TELEGRAM_BOT_TOKEN
  const chatId = process.env.TELEGRAM_CHAT_ID
  if (!token || !chatId) throw new Error('Missing Telegram config')
  const text =
    '🏠 Новая заявка с сайта\n\nИмя: ' +
    (name || '—') +
    '\nТелефон: ' +
    (phone || '—') +
    '\nСообщение: ' +
    (message || '—') +
    '\n\n' +
    new Date().toLocaleString('ru-RU')
  const r = await fetch('https://api.telegram.org/bot' + token + '/sendMessage', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ chat_id: chatId, text }),
  })
  if (!r.ok) throw new Error('Telegram error: ' + r.status)
  return { success: true }
}

async function agentChat(input: any) {
  const data = input?.json || input || {}
  const messages: any[] = data.messages || []
  const groqKey = process.env.GROQ_API_KEY
  const geminiKey = process.env.GEMINI_API_KEY
  if (groqKey) {
    const t = await groqChat(messages, groqKey)
    if (t) return replyObject(t)
  }
  if (geminiKey) {
    const { text, lastStatus } = await geminiChat(messages, geminiKey)
    if (text) return replyObject(text)
    throw new Error('Gemini failed, last status: ' + lastStatus)
  }
  throw new Error('AI unavailable: no providers configured')
}

function catalogList() {
  return [
    { id: 1, title: '2-комн., 54 м²', address: 'Мавлютова 31а', price: 8500000 },
    { id: 2, title: 'Студия, 28 м²', address: 'Сибирский тракт 15', price: 4200000 },
    { id: 3, title: '3-комн., 78 м²', address: 'Баумана 44', price: 12500000 },
  ]
}

const handlers: Record<string, Handler> = {
  'leads.sendTelegram': sendTelegram,
  'agent.chat': agentChat,
  'catalog.list': catalogList,
}

function getProcedure(req: any): string {
  const sources = [req.headers?.['x-matched-path'], req.headers?.['x-invoke-path'], req.url]
  for (const s of sources) {
    const m = String(s || '').match(/trpc\/([a-zA-Z0-9_.]+)/)
    if (m) return m[1]
  }
  return ''
}

export default async function handler(req: any, res: any) {
  res.setHeader('Access-Control-Allow-Origin', '*')
  res.setHeader('Access-Control-Allow-Methods', 'GET, POST, OPTIONS')
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type')
  if (req.method === 'OPTIONS') {
    res.status(204).end()
    return
  }

  const procedure = getProcedure(req)
  let batchBody: Record<string, any> = {}
  try {
    if (req.method === 'POST') {
      batchBody = typeof req.body === 'string' ? JSON.parse(req.body) : req.body || {}
    } else {
      const raw = req.query?.input
      batchBody = raw ? JSON.parse(String(raw)) : {}
    }
  } catch {
    batchBody = {}
  }

  const results: any[] = []
  let failed: string | null = null
  const keys = Object.keys(batchBody)
  const items = keys.length ? keys : ['empty']
  for (const key of items) {
    const h = handlers[procedure]
    if (!h) {
      failed = 'Unknown procedure: ' + procedure
      results.push(errorEnvelope(failed, procedure))
      continue
    }
    try {
      const out = await h(key === 'empty' ? {} : batchBody[key])
      results.push({ result: { data: { json: out } } })
    } catch (e: any) {
      failed = e?.message || 'Internal error'
      results.push(errorEnvelope(failed, procedure))
    }
  }
  res.status(failed ? 500 : 200).json(results)
}
