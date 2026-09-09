import { Hono } from 'hono'
import { handle } from 'hono/vercel'

export const config = {
  runtime: 'edge',
}

const app = new Hono()

app.post('/trpc/leads.sendTelegram', async (c) => {
  try {
    const body = await c.req.json()
    const { name, phone, message } = body.input?.json || body
    
    const token = process.env.TELEGRAM_BOT_TOKEN
    const chatId = process.env.TELEGRAM_CHAT_ID
    
    if (!token || !chatId) {
      return c.json({ error: 'Missing Telegram config' }, 500)
    }
    
    const text = `🏠 Новая заявка с сайта\n\nИмя: ${name || 'Не указано'}\nТелефон: ${phone || 'Не указан'}\nСообщение: ${message || 'Без сообщения'}\n\nВремя: ${new Date().toLocaleString('ru-RU')}`
    
    const telegramResponse = await fetch(`https://api.telegram.org/bot${token}/sendMessage`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ chat_id: chatId, text, parse_mode: 'HTML' }),
    })
    
    if (!telegramResponse.ok) {
      return c.json({ error: 'Telegram API error' }, 500)
    }
    
    return c.json({ result: { success: true } })
  } catch (error) {
    return c.json({ error: 'Internal error' }, 500)
  }
})

app.post('/trpc/agent.chat', async (c) => {
  try {
    const body = await c.req.json()
    const { messages } = body.input?.json || body
    
    const geminiKey = process.env.GEMINI_API_KEY
    if (!geminiKey) {
      return c.json({ error: 'Missing Gemini config' }, 500)
    }
    
    const systemPrompt = `Ты — Амир, ИИ-агент по недвижимости в Казани. Опыт 18 лет. Помогаешь с подбором, продажей, выкупом и управлением квартирами. Отвечай кратко, по делу, дружелюбно. Если спрашивают о конкретной квартире — предлагай связаться с Амиром напрямую по телефону +7 927 409-91-79.`
    
    const geminiResponse = await fetch(`https://generativelanguage.googleapis.com/v1beta/models/gemini-1.5-flash:generateContent?key=${geminiKey}`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        contents: [
          { role: 'user', parts: [{ text: systemPrompt }] },
          ...messages.map(m => ({ role: m.role, parts: [{ text: m.content }] }))
        ],
      }),
    })
    
    const data = await geminiResponse.json()
    const reply = data.candidates?.[0]?.content?.parts?.[0]?.text || 'Извините, не смог ответить. Свяжитесь с Амиром: +7 927 409-91-79'
    
    return c.json({ result: { data: { json: reply } } })
  } catch (error) {
    return c.json({ error: 'Gemini error' }, 500)
  }
})

app.get('/trpc/catalog.list', async (c) => {
  const catalog = [
    { id: 1, title: '2-комн. квартира, 54 м²', address: 'ул. Мавлютова, 31а', price: 8500000 },
    { id: 2, title: 'Студия, 28 м²', address: 'ул. Сибирский тракт, 15', price: 4200000 },
  ]
  return c.json({ result: { data: { json: catalog } } })
})

export default handle(app)
