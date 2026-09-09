type Handler = (input: any) => any | Promise<any>

async function sendTelegram(input: any) {
  const data = input?.json || input || {}
  const { name, phone, message } = data
  const token = process.env.TELEGRAM_BOT_TOKEN
  const chatId = process.env.TELEGRAM_CHAT_ID
  if (!token || !chatId) throw new Error('Missing Telegram config')
  const text =
    '🏠 Новая заявка с сайта\n\nИмя: ' + (name || '—') +
    '\nТелефон: ' + (phone || '—') +
    '\nСообщение: ' + (message || '—') +
    '\n\n' + new Date().toLocaleString('ru-RU')
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
  const key = process.env.GEMINI_API_KEY
  if (!key) throw new Error('Missing Gemini key')
  const system =
    'Ты — Амир, ИИ-агент по недвижимости в Казани. 18 лет опыта. Помогаешь с подбором, продажей, выкупом и управлением квартирами. Отвечай кратко, дружелюбно и по делу. По конкретным объектам предлагай связаться с Амиром: +7 927 409-91-79.'
  const contents = [
    { role: 'user', parts: [{ text: system }] },
    ...messages.map((m) => ({
      role: m.role === 'assistant' ? 'model' : 'user',
      parts: [{ text: String(m.content || '') }],
    })),
  ]
  const r = await fetch(
    'https://generativelanguage.googleapis.com/v1beta/models/gemini-2.0-flash:generateContent?key=' + key,
    {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ contents }),
    },
  )
  if (!r.ok) throw new Error('Gemini error: ' + r.status)
  const d: any = await r.json()
  return d?.candidates?.[0]?.content?.parts?.[0]?.text ||
    'Свяжитесь с Амиром напрямую: +7 927 409-91-79'
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
  const sources = [
    req.headers?.['x-matched-path'],
    req.headers?.['x-invoke-path'],
    req.url,
  ]
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
  const keys = Object.keys(batchBody)
  const items = keys.length ? keys : ['empty']
  for (const key of items) {
    const h = handlers[procedure]
    if (!h) {
      results.push({ error: { json: { message: 'Unknown procedure: ' + procedure } } })
      continue
    }
    try {
      const out = await h(key === 'empty' ? {} : batchBody[key])
      results.push({ result: { data: { json: out } } })
    } catch (e: any) {
      results.push({ error: { json: { message: e?.message || 'Internal error' } } })
    }
  }
  res.status(200).json(results)
}
