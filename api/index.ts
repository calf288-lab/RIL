type Handler = (input: any) => any | Promise<any>

const TRPC_INTERNAL = -32603
const SYSTEM =
  'Ты — Амир, ИИ-агент по недвижимости в Казани. 18 лет опыта. Отвечай как человек в переписке: 1-3 коротких предложения, без списков, звёздочек и перечислений. В конце задавай ОДИН уточняющий вопрос: район, бюджет, срок или ипотека. По конкретным объектам и сделкам предлагай связаться с Амиром: +7 927 409-91-79.'

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
const clip = (s: string, n: number) => (s.length > n ? s.slice(0, n) + '…' : s)
const digitsOf = (s: string) => s.replace(/\D/g, '')

function findPhone(text: string): string | null {
  const m = String(text).match(/(?:\+?\d)[\d\s\-\(\)\.]{8,}\d/g)
  if (!m) return null
  for (const cand of m) {
    const d = digitsOf(cand)
    if (d.length >= 10 && d.length <= 15) return d
  }
  return null
}

function normalizePhone(d: string): string {
  if (d.length === 11 && (d[0] === '8' || d[0] === '7')) return '+7' + d.slice(1)
  if (d.length === 10) return '+7' + d
  return '+' + d
}

function replyObject(t: string) {
  return { reply: t, text: t, message: t, content: t, answer: t, response: t }
}

async function pushLead(data: any) {
  const token = process.env.TELEGRAM_BOT_TOKEN
  const chatId = process.env.TELEGRAM_CHAT_ID
  if (!token || !chatId) throw new Error('Missing Telegram config')
  const name = data.name || '—'
  const contact = data.contact || data.phone || '—'
  const source = data.source || '—'
  const city = data.city || '—'
  const district = data.district || '—'
  const purpose = data.purpose || '—'
  const mortgage = data.mortgage || '—'
  const channel = data.channel || '—'
  const properties =
    Array.isArray(data.properties) && data.properties.length ? data.properties.join('\n') : '—'
  const conversation = data.conversation ? String(data.conversation) : '—'
  const pageUrl = data.pageUrl || data.page || '—'
  const referrer = data.referrer || '—'
  const utmRaw = data.utm && typeof data.utm === 'object' ? data.utm : {}
  const utmKeys = Object.keys(utmRaw)
  const utm = utmKeys.length ? utmKeys.map((k) => `${k}=${utmRaw[k]}`).join(', ') : '—'
  let text =
    '🏠 Новый лид · Ареал\n\n' +
    'Имя: ' + name + '\n' +
    'Контакт: ' + contact + '\n' +
    'Источник: ' + source + '\n' +
    'Город / район: ' + city + ' / ' + district + '\n' +
    'Цель: ' + purpose + '\n' +
    'Ипотека: ' + mortgage + '\n' +
    'Канал: ' + channel + '\n' +
    'Объекты:\n' + clip(properties, 800) + '\n\n' +
    'Диалог:\n' + clip(conversation, 1500) + '\n\n' +
    'Страница: ' + pageUrl + '\n' +
    'Referrer: ' + referrer + '\n' +
    'UTM: ' + utm + '\n' +
    'Время: ' + new Date().toLocaleString('ru-RU')
  text = clip(text, 4000)
  const r = await fetch('https://api.telegram.org/bot' + token + '/sendMessage', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ chat_id: chatId, text }),
  })
  if (!r.ok) throw new Error('Telegram error: ' + r.status)
  return { success: true }
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
  return pushLead(input?.json || input || {})
}

async function agentChat(input: any) {
  const data = input?.json || input || {}
  const messages: any[] = data.messages || data.history || []
  const userMessage = data.message ? String(data.message) : ''
  const chatMessages = userMessage ? [...messages, { role: 'user', content: userMessage }] : messages
  const groqKey = process.env.GROQ_API_KEY
  const geminiKey = process.env.GEMINI_API_KEY
  let answer: string | null = null
  if (groqKey) {
    answer = await groqChat(chatMessages, groqKey)
  }
  if (!answer && geminiKey) {
    const g = await geminiChat(chatMessages, geminiKey)
    answer = g.text
    if (!answer) throw new Error('Gemini failed, last status: ' + g.lastStatus)
  }
  if (!answer) throw new Error('AI unavailable: no providers configured')
  const phoneDigits = findPhone(userMessage)
  if (phoneDigits) {
    const conversation = chatMessages
      .concat([{ role: 'assistant', content: answer }])
      .map((m) => (m.role === 'user' ? 'Клиент: ' : 'Амир: ') + m.content)
      .join('\n')
    pushLead({
      name: 'Посетитель',
      contact: normalizePhone(phoneDigits),
      source: 'Ареал · ИИ-чат (автозахват телефона)',
      city: data.city || 'Казань и Татарстан',
      district: data.district || 'Не указан',
      purpose: data.purpose || 'Не указана',
      mortgage: data.mortgage || 'Не указан',
      channel: 'chat-auto',
      conversation,
      properties: [],
    }).catch(() => {})
  }
  return replyObject(answer)
}

function catalogList() {
  return {
    source: 'local',
    properties: [
      { title: 'ЖК «Светлая долина»', city: 'Казань', location: 'Советский район', price: '8,4 млн ₽', priceValue: 8.4, meta: '2-комн. · 58 м²', badge: 'Новый дом', description: 'Тихий двор со спортплощадкой, школа рядом и кухня-гостиная для семейного сценария.', mortgageAvailable: true, photoUrl: '/photos/dvor-svetlaya-dolina.jpg' },
      { title: 'Апартаменты у Кремля', city: 'Казань', location: 'Центр', price: '11,2 млн ₽', priceValue: 11.2, meta: '1-комн. · 42 м²', badge: 'В центре', description: 'Компактный городской формат рядом с набережной и историческим центром.', mortgageAvailable: false, photoUrl: '/photos/kvartal-vid-sverhu.jpg' },
      { title: 'Семейный квартал «Мой город»', city: 'Набережные Челны', location: 'Новый город', price: '5,9 млн ₽', priceValue: 5.9, meta: '3-комн. · 76 м²', badge: 'Для семьи', description: 'Просторная планировка, закрытая территория и места для хранения.', mortgageAvailable: true, photoUrl: '/photos/gostinaya-otdelka.jpg' },
      { title: 'Дом у Камы', city: 'Альметьевск', location: 'Центральный район', price: '6,7 млн ₽', priceValue: 6.7, meta: '2-комн. · 61 м²', badge: 'Под ипотеку', description: 'Светлая квартира с отделкой и быстрым выходом на сделку.', mortgageAvailable: true, photoUrl: '/photos/fasad-tsentr.jpg' },
      { title: 'Квартира с готовой отделкой', city: 'Бугульма', location: 'Микрорайон 3', price: '4,1 млн ₽', priceValue: 4.1, meta: '1-комн. · 38 м²', badge: 'Быстрый заезд', description: 'Готовый вариант для первого жилья или спокойной инвестиции.', mortgageAvailable: true, photoUrl: '/photos/kuhnya-otdelka.jpg' },
    ],
  }
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
