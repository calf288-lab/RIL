import { useEffect, useMemo, useRef, useState } from "react";
import { trpc } from "@/lib/trpc";
import {
  ArrowRight,
  Bot,
  Building2,
  Check,
  ChevronDown,
  ChevronRight,
  Clock3,
  Home as HomeIcon,
  MapPin,
  Menu,
  MessageCircle,
  Phone,
  Rocket,
  Send,
  ShieldCheck,
  Sparkles,
  Star,
  Target,
  X,
  Zap,
} from "lucide-react";

declare global {
  interface Window {
    ym?: (counterId: number, action: string, goal?: string, params?: Record<string, unknown>) => void;
  }
}

function trackGoal(goal: string, params?: Record<string, unknown>) {
  window.ym?.(112369710, "reachGoal", goal, params);
}

function trackingContext() {
  const search = new URLSearchParams(window.location.search);
  const utm: Record<string, string> = {};
  search.forEach((value, key) => {
    if (key.startsWith("utm_")) utm[key] = value;
  });
  return { pageUrl: window.location.href, referrer: document.referrer, utm };
}

function openAgentEverywhere(detail?: { message?: string }) {
  const fn = (window as any).__openAgent;
  if (typeof fn === "function") {
    fn(detail ? { detail } : {});
  } else {
    window.dispatchEvent(new CustomEvent("agent-open", detail ? { detail } : undefined));
  }
  const dock = document.querySelector(".agent-dock");
  if (dock) dock.scrollIntoView({ behavior: "smooth", block: "end" });
}

type AgentStep = "start" | "purpose" | "district" | "mortgage" | "preview" | "contact";
type LiveMessage = { role: "user" | "assistant"; content: string };

const districts = ["Вахитовский район", "Авиастроительный район", "Кировский район", "Московский район", "Ново-Савиновский район", "Приволжский район", "Советский район", "Заинск", "Альметьевск", "Набережные Челны", "Лениногорск", "Бугульма", "Пока не знаю"];
const purposeLabels = ["Для проживания", "Для инвестиций"];
const propertyPreview: Array<{ title: string; city: string; location: string; price: string; priceValue: number; meta: string; badge: string; description: string; mortgageAvailable: boolean; photoUrl?: string }> = [
  { title: "ЖК «Светлая долина»", city: "Казань", location: "Советский район", price: "8,4 млн ₽", priceValue: 8.4, meta: "2-комн. · 58 м²", badge: "Новый дом", description: "Тихий двор со спортплощадкой, школа рядом и кухня-гостиная для семейного сценария.", mortgageAvailable: true, photoUrl: "/photos/dvor-svetlaya-dolina.jpg" },
  { title: "Апартаменты у Кремля", city: "Казань", location: "Центр", price: "11,2 млн ₽", priceValue: 11.2, meta: "1-комн. · 42 м²", badge: "В центре", description: "Компактный городской формат рядом с набережной и историческим центром.", mortgageAvailable: false, photoUrl: "/photos/kvartal-vid-sverhu.jpg" },
  { title: "Семейный квартал «Мой город»", city: "Набережные Челны", location: "Новый город", price: "5,9 млн ₽", priceValue: 5.9, meta: "3-комн. · 76 м²", badge: "Для семьи", description: "Просторная планировка, закрытая территория и места для хранения.", mortgageAvailable: true, photoUrl: "/photos/gostinaya-otdelka.jpg" },
  { title: "Дом у Камы", city: "Альметьевск", location: "Центральный район", price: "6,7 млн ₽", priceValue: 6.7, meta: "2-комн. · 61 м²", badge: "Под ипотеку", description: "Светлая квартира с отделкой и быстрым выходом на сделку.", mortgageAvailable: true, photoUrl: "/photos/fasad-tsentr.jpg" },
  { title: "Квартира с готовой отделкой", city: "Бугульма", location: "Микрорайон 3", price: "4,1 млн ₽", priceValue: 4.1, meta: "1-комн. · 38 м²", badge: "Быстрый заезд", description: "Готовый вариант для первого жилья или спокойной инвестиции.", mortgageAvailable: true, photoUrl: "/photos/kuhnya-otdelka.jpg" },
];

const benefits = [
  { icon: MessageCircle, title: "Ведёт диалог, а не квиз", text: "Уточняет цель покупки, район и бюджет естественно — без длинной анкеты на первом экране." },
  { icon: Clock3, title: "Отвечает 24/7", text: "Объясняет условия работы, ипотеку, районы Казани и этапы сделки даже вечером и в выходные." },
  { icon: Target, title: "Ловит интерес вовремя", text: "Предлагает оставить контакт только тогда, когда уже понял задачу клиента и может быть полезен." },
  { icon: ShieldCheck, title: "Передаёт контекст менеджеру", text: "Амир получает не просто номер, а готовый бриф: цель, район, бюджет и ипотечный сценарий." },
];

const faqs = [
  ["Агент будет навязывать звонок?", "Нет. Он отвечает на вопросы и предлагает контакт только после того, как клиент проявил интерес к подборке или консультации."],
  ["Какие районы Казани он знает?", "В сценарий добавлены Вахитовский, Авиастроительный, Кировский, Московский, Ново-Савиновский, Приволжский и Советский районы, а также Заинск, Альметьевск, Набережные Челны, Лениногорск и Бугульма. Реальные ЖК и предложения подключаются из вашего JSON-каталога."],
  ["Откуда объекты в каталоге?", "Каталог подключается к актуальной базе предложений Амира и обновляется по мере появления новых объектов и снятия проданных."],
];

function scrollToId(id: string) {
  document.getElementById(id)?.scrollIntoView({ behavior: "smooth", block: "start" });
}

const agentStyles = `
.agent-teaser{background:linear-gradient(90deg,#7c3aed,#4f46e5);border-radius:999px;padding:10px 12px 10px 18px;display:flex;gap:12px;align-items:center;box-shadow:0 10px 34px rgba(124,58,237,.5);animation:agentPulse 2.2s ease-in-out infinite;border:1px solid rgba(255,255,255,.25)}
.agent-teaser span{color:#fff;font-weight:600;font-size:13px}
.agent-teaser button{background:#fff;color:#4f46e5;border:none;border-radius:999px;padding:9px 16px;font-weight:800;font-size:13px;display:flex;gap:7px;align-items:center;cursor:pointer;box-shadow:0 4px 14px rgba(0,0,0,.25)}
.agent-launcher{box-shadow:0 12px 40px rgba(124,58,237,.65);animation:agentPulse 2.2s ease-in-out infinite}
@keyframes agentPulse{0%,100%{transform:scale(1)}50%{transform:scale(1.045)}}
`;

function AgentWidget() {
  const [open, setOpen] = useState(false);
  const [step, setStep] = useState<AgentStep>("start");
  const [purpose, setPurpose] = useState("");
  const [district, setDistrict] = useState("");
  const [mortgage, setMortgage] = useState("");
  const [contact, setContact] = useState("");
  const [website, setWebsite] = useState("");
  const [sent, setSent] = useState(false);
  const [sendError, setSendError] = useState("");
  const [liveOpen, setLiveOpen] = useState(false);
  const [liveMessage, setLiveMessage] = useState("");
  const [liveHistory, setLiveHistory] = useState<LiveMessage[]>([]);
  const [liveError, setLiveError] = useState("");
  const [startedAt] = useState(() => Date.now());
  const liveInputRef = useRef<HTMLInputElement>(null);
  const sendTelegram = trpc.leads.sendTelegram.useMutation();
  const askAI = trpc.agent.chat.useMutation();

  const sendLive = async (text: string) => {
    const message = text.trim();
    if (!message || askAI.isPending) return;
    setLiveError("");
    const nextHistory = [...liveHistory, { role: "user" as const, content: message }];
    setLiveHistory(nextHistory);
    setLiveMessage("");
    try {
      const result = await askAI.mutateAsync({ message, history: liveHistory, city: "Казань и Татарстан", purpose, district, mortgage });
      setLiveHistory([...nextHistory, { role: "assistant", content: result.content }]);
    } catch (error) {
      setLiveError(error instanceof Error ? error.message : "Не удалось получить ответ. Попробуйте ещё раз.");
    }
  };

  const sendLiveRef = useRef(sendLive);
  sendLiveRef.current = sendLive;

  useEffect(() => {
    const onOpen = (event?: any) => {
      const detail = event?.detail || {};
      setOpen(true);
      setLiveOpen(true);
      const message = typeof detail.message === "string" ? detail.message : "";
      if (message.trim()) {
        void sendLiveRef.current(message);
      }
      setTimeout(() => liveInputRef.current?.focus(), 200);
    };
    (window as any).__openAgent = onOpen;
    window.addEventListener("agent-open", onOpen as EventListener);
    return () => {
      window.removeEventListener("agent-open", onOpen as EventListener);
      delete (window as any).__openAgent;
    };
  }, []);

  const recommendedProperties = useMemo(() => {
    const exact = propertyPreview.filter((property) => district && (property.city.includes(district) || property.location.includes(district)));
    const rest = propertyPreview.filter((property) => !exact.includes(property));
    return [...exact, ...rest].slice(0, 5);
  }, [district]);

  const openAgent = () => {
    setOpen(true);
    trackGoal("agent_open");
  };

  const askAgent = async (event: React.FormEvent) => {
    event.preventDefault();
    await sendLive(liveMessage);
  };

  const completeContact = async (event: React.FormEvent) => {
    event.preventDefault();
    if (!contact.trim() || sendTelegram.isPending) return;
    setSendError("");
    try {
      await sendTelegram.mutateAsync({
        ...trackingContext(),
        name: "Посетитель",
        contact,
        source: "Ареал · плавающий ИИ-агент",
        city: "Казань и Татарстан",
        purpose,
        district,
        mortgage,
        conversation: liveHistory.map((item) => `${item.role === "user" ? "Клиент" : "Амир"}: ${item.content}`).join("\n"),
        properties: recommendedProperties.map((property) => `${property.title} — ${property.price} — ${property.location}`),
        channel: "chat",
        website,
        startedAt,
      });
      trackGoal("agent_contact_submit", { purpose, district, mortgage });
      setSent(true);
    } catch (error) {
      setSendError(error instanceof Error ? error.message : "Не удалось отправить заявку. Попробуйте ещё раз.");
    }
  };

  return (
    <div className={`agent-dock ${open ? "agent-dock-open" : ""}`} style={{ position: "fixed", right: 12, bottom: 12, zIndex: 80 }}>
      <style>{agentStyles}</style>
      {!open && <div className="agent-teaser"><span>Подобрать квартиру?</span><button onClick={openAgent}>Спросить Амира <ArrowRight size={14} /></button></div>}
      <button className="agent-launcher" onClick={() => (open ? setOpen(false) : openAgent())} aria-label={open ? "Закрыть ИИ-агента" : "Открыть ИИ-агента"}>
        {open ? <X size={22} /> : <><span className="agent-launcher-pulse" /><Bot size={25} /></>}
      </button>
      {open && <div className="agent-panel" style={{ width: "min(380px, calc(100vw - 24px))" }}>
        <div className="agent-panel-head"><div className="agent-avatar"><Bot size={20} /></div><div><b>Амир · ИИ-агент</b><small><span /> Сейчас онлайн</small></div><button onClick={() => setOpen(false)} aria-label="Закрыть"><X size={17} /></button></div>
        <div className="agent-chat">
          <div className="agent-message agent-message-ai">Здравствуйте! Я помогу подобрать квартиру в Казани. Можно начать с пары вопросов — без обязательств и звонков.</div>
          {step === "start" && <div className="agent-options"><button onClick={() => setStep("purpose")}>Подобрать квартиру <ChevronRight size={15} /></button><button onClick={() => setStep("purpose")}>Задать вопрос <ChevronRight size={15} /></button><button onClick={() => setLiveOpen(true)}>Спросить ИИ свободно <MessageCircle size={15} /></button></div>}
          {liveOpen && <div className="live-ai-chat">{liveHistory.map((item, index) => <div className={`agent-message ${item.role === "user" ? "agent-message-user" : "agent-message-ai"}`} key={`${item.role}-${index}`}>{item.content}</div>)}{askAI.isPending && <div className="agent-message agent-message-ai"><span className="typing-dots"><i /><i /><i /></span> Амир печатает…</div>}<form onSubmit={askAgent} className="live-ai-form"><input ref={liveInputRef} value={liveMessage} onChange={(event) => setLiveMessage(event.target.value)} placeholder="Например: что важно проверить при покупке?" aria-label="Сообщение ИИ-агенту" /><button type="submit" disabled={askAI.isPending || !liveMessage.trim()} aria-label="Отправить сообщение"><Send size={14} /></button></form>{liveError && <p className="agent-send-error">{liveError}</p>}</div>}
          {step !== "start" && <div className="agent-message agent-message-user">{purpose || "Хочу подобрать вариант"}</div>}
          {step === "purpose" && <><div className="agent-message agent-message-ai">Для проживания или инвестиций ищете?</div><div className="agent-options two"><button onClick={() => { setPurpose(purposeLabels[0]); setStep("district"); }}>Для проживания</button><button onClick={() => { setPurpose(purposeLabels[1]); setStep("district"); }}>Для инвестиций</button></div></>}
          {step !== "purpose" && step !== "start" && <div className="agent-message agent-message-user">{district || purpose}</div>}
          {step === "district" && <><div className="agent-message agent-message-ai">Какой район рассматриваете?</div><div className="agent-options district-options">{districts.map((item) => <button key={item} onClick={() => { setDistrict(item); setStep("mortgage"); }}>{item}</button>)}</div></>}
          {step !== "district" && !["start", "purpose"].includes(step) && <div className="agent-message agent-message-user">{mortgage || district}</div>}
          {step === "mortgage" && <><div className="agent-message agent-message-ai">Нужна помощь с одобрением ипотеки?</div><div className="agent-options two"><button onClick={() => { setMortgage("Да, нужна"); setStep("preview"); }}>Да, нужна</button><button onClick={() => { setMortgage("Нет, не нужна"); setStep("preview"); }}>Пока нет</button></div></>}
          {step === "preview" && <div className="property-preview"><div className="agent-message agent-message-ai">Нашёл несколько направлений под ваш запрос. Показываю превью — точную подборку Амир отправит после контакта.</div><div className="property-preview-grid">{recommendedProperties.map((property) => <article className="property-preview-card" key={property.title}><span className="property-badge">{property.badge}</span><strong>{property.title}</strong><small><MapPin size={11} /> {property.location}</small><span>{property.meta}</span><b>{property.price}</b></article>)}</div><button className="preview-contact-button" onClick={() => setStep("contact")}>Получить точные варианты <ArrowRight size={14} /></button></div>}
          {step === "contact" && !sent && <form className="agent-contact-form" onSubmit={completeContact}><div className="agent-message agent-message-ai">Я зафиксировал ваши пожелания. Оставьте номер или Telegram — Амир подготовит подборку из 3–5 вариантов и пришлёт в течение 15 минут.</div><input value={contact} onChange={(event) => setContact(event.target.value)} placeholder="Телефон или @telegram" required /><input className="honeypot" value={website} onChange={(event) => setWebsite(event.target.value)} tabIndex={-1} autoComplete="off" aria-hidden="true" /><button type="submit" disabled={sendTelegram.isPending}>{sendTelegram.isPending ? <><span className="button-spinner" /> Отправляем…</> : <>Получить подборку <Send size={14} /></>}</button>{sendError && <p className="agent-send-error">{sendError}</p>}</form>}
          {sent && <div className="agent-success"><span className="success-orb"><Check size={20} /></span><b>Заявка ушла Амиру</b><p>Контакт и ответы из диалога уже в Telegram. Подборка будет готова в рабочее время.</p><span className="success-caption">Спасибо — вы сделали первый шаг</span></div>}
        </div>
        <div className="agent-panel-foot"><span><ShieldCheck size={12} /> Контакты отправляются в Telegram</span><span>Защищённый режим</span></div>
      </div>}
    </div>
  );
}

function PropertyExplorer() {
  const [city, setCity] = useState("Все города");
  const [budget, setBudget] = useState("Любой бюджет");
  const [pricePreset, setPricePreset] = useState("Любая стоимость");
  const [mortgageOnly, setMortgageOnly] = useState(false);
  const catalogQuery = trpc.catalog.list.useQuery(undefined, { staleTime: 60_000 });
  const catalogProperties = catalogQuery.data?.properties || propertyPreview;
  const filteredProperties = useMemo(() => catalogProperties.filter((property) => {
    const cityMatches = city === "Все города" || property.city === city;
    const budgetMatches = budget === "Любой бюджет" || property.priceValue <= Number(budget);
    const priceMatches = pricePreset === "Любая стоимость" || (pricePreset === "до 5 млн ₽" ? property.priceValue <= 5 : pricePreset === "5–8 млн ₽" ? property.priceValue > 5 && property.priceValue <= 8 : property.priceValue > 8);
    const mortgageMatches = !mortgageOnly || property.mortgageAvailable;
    return cityMatches && budgetMatches && priceMatches && mortgageMatches;
  }), [catalogProperties, city, budget, pricePreset, mortgageOnly]);
  const cities = ["Все города", ...Array.from(new Set(catalogProperties.map((property) => property.city)))];

  return <section id="properties" className="properties-section"><div className="section-inner"><div className="section-heading property-heading"><span className="section-eyebrow">{catalogQuery.data?.source === "remote" ? "КАТАЛОГ · АВТООБНОВЛЕНИЕ" : "КАТАЛОГ · ОБНОВЛЯЕМАЯ ВЫБОРКА"}</span><h2>Найдите свой<br /><span className="text-gradient-blue">сценарий жизни</span></h2><p>{catalogQuery.data?.source === "remote" ? "Актуальные предложения из подключённого JSON-каталога. Фильтры помогают быстро сузить выбор." : "Актуальные предложения Амира по Казани и Татарстану. Фильтры помогают быстро сузить выбор."}</p></div><div className="property-filters"><label>Город<select value={city} onChange={(event) => setCity(event.target.value)}>{cities.map((item) => <option key={item}>{item}</option>)}</select></label><label>Максимальный бюджет<select value={budget} onChange={(event) => setBudget(event.target.value)}><option>Любой бюджет</option><option value="5">до 5 млн ₽</option><option value="7">до 7 млн ₽</option><option value="9">до 9 млн ₽</option><option value="12">до 12 млн ₽</option></select></label><div className="filter-chips" aria-label="Быстрый фильтр по стоимости"><span className="filter-label">Стоимость</span>{["Любая стоимость", "до 5 млн ₽", "5–8 млн ₽", "от 8 млн ₽"].map((preset) => <button key={preset} className={`filter-chip ${pricePreset === preset ? "active" : ""}`} onClick={() => setPricePreset(preset)}>{preset}</button>)}</div><button className={`filter-chip mortgage-chip ${mortgageOnly ? "active" : ""}`} onClick={() => setMortgageOnly((value) => !value)}><Check size={13} /> Ипотека доступна</button><span className="property-result-count">Найдено: <b>{filteredProperties.length}</b></span></div><div className="property-grid">{filteredProperties.map((property, index) => <article className={`property-card property-card-${index % 5}`} key={property.title}><div className="property-visual">{property.photoUrl ? <img src={property.photoUrl} alt="" /> : <Building2 size={30} />}<span>{property.badge}</span>{property.mortgageAvailable && <em className="mortgage-badge">Ипотека</em>}</div><div className="property-card-body"><div className="property-location"><MapPin size={12} /> {property.city} · {property.location}</div><h3>{property.title}</h3><p>{property.description}</p><div className="property-card-meta"><span>{property.meta}</span><b>{property.price}</b></div><button onClick={() => { trackGoal("property_card_click", { title: property.title, city: property.city }); scrollToId("agent"); }}>Обсудить с Амиром <ArrowRight size={14} /></button></div></article>)}</div>{filteredProperties.length === 0 && <div className="property-empty">По этим параметрам предложений пока нет. Попробуйте изменить фильтры.</div>}</div></section>;
}

function AgentPreviewMock() {
  const [mockQuestion, setMockQuestion] = useState("");
  const submitMock = (event: React.FormEvent) => {
    event.preventDefault();
    const message = mockQuestion.trim();
    if (!message) return;
    trackGoal("agent_mock_question", { message });
    openAgentEverywhere({ message });
    setMockQuestion("");
  };
  return (
    <div className="agent-preview-card" onClick={() => { trackGoal("agent_preview_open"); openAgentEverywhere(); }} style={{ cursor: "pointer" }}>
      <div className="preview-glow" />
      <div className="preview-head"><div className="agent-avatar"><Bot size={21} /></div><div><b>Амир · ИИ-агент</b><small><span /> Сейчас онлайн</small></div><span className="preview-dots">•••</span></div>
      <div className="preview-body">
        <div className="agent-message agent-message-ai">Приветствую! Ищете квартиру для проживания или инвестиций в Казани?</div>
        <div className="preview-quick"><span>Для проживания</span><span>Для инвестиций</span></div>
        <div className="agent-message agent-message-user">Для проживания. Рассматриваю центр.</div>
        <div className="agent-message agent-message-ai">Понял. Нужна ли помощь с одобрением ипотеки?</div>
        <form className="live-ai-form" style={{ marginTop: 10 }} onClick={(event) => event.stopPropagation()} onSubmit={submitMock}>
          <input value={mockQuestion} onChange={(event) => setMockQuestion(event.target.value)} placeholder="Напишите свой вопрос прямо здесь…" aria-label="Вопрос ИИ-агенту из макета" />
          <button type="submit" disabled={!mockQuestion.trim()} aria-label="Отправить вопрос агенту"><Send size={14} /></button>
        </form>
      </div>
      <div className="preview-footer"><MessageCircle size={13} /> Диалог продолжается без перезагрузки страницы</div>
    </div>
  );
}

export default function Home() {
  const [scrolled, setScrolled] = useState(false);
  const [mobileOpen, setMobileOpen] = useState(false);
  const [faqOpen, setFaqOpen] = useState<number | null>(0);
  const [formSent, setFormSent] = useState(false);
  const [formName, setFormName] = useState("");
  const [formContact, setFormContact] = useState("");
  const [formWebsite, setFormWebsite] = useState("");
  const [consent, setConsent] = useState(false);
  const [formStartedAt] = useState(() => Date.now());
  const [formError, setFormError] = useState("");
  const leadMutation = trpc.leads.sendTelegram.useMutation();

  useEffect(() => {
    const onScroll = () => setScrolled(window.scrollY > 20);
    window.addEventListener("scroll", onScroll, { passive: true });
    return () => window.removeEventListener("scroll", onScroll);
  }, []);

  return <main className="galactic-shell">
        <header className={`galactic-nav ${scrolled ? "galactic-nav-scrolled" : ""}`}>
      <div className="galactic-nav-inner">
        <a className="galactic-brand" href="#top"><span className="galactic-logo"><Sparkles size={17} /></span><span>Аре<span className="brand-accent">ал</span></span></a>
        <nav className="galactic-links"><a href="#agent">Как работает</a><a href="#properties">Каталог</a><a href="#benefits">Возможности</a><a href="#trust">Об Амире</a><a href="#faq">Вопросы</a><a href="#contact">Контакты</a></nav>
        <div className="galactic-nav-actions"><a className="outline-pill" href="tel:+79274099179" onClick={() => trackGoal("header_phone_click")}><Phone size={14} /> +7 927 409-91-79</a><button className="mobile-toggle" onClick={() => setMobileOpen((value) => !value)}>{mobileOpen ? <X size={19} /> : <Menu size={19} /></button></div>
      </div>
      {mobileOpen && <div className="galactic-mobile-nav"><a href="#agent" onClick={() => setMobileOpen(false)}>Как работает</a><a href="#properties" onClick={() => setMobileOpen(false)}>Каталог</a><a href="#benefits" onClick={() => setMobileOpen(false)}>Возможности</a><a href="#trust" onClick={() => setMobileOpen(false)}>Об Амире</a><a href="#faq" onClick={() => setMobileOpen(false)}>Вопросы</a><a href="#contact" onClick={() => setMobileOpen(false)}>Контакты</a><a href="tel:+79274099179">Телефон: +7 927 409-91-79</a></div>}
    </header>

    <section id="top" className="galactic-hero starfield">
      <div className="planet planet-orange" /><div className="planet planet-lilac" /><div className="planet planet-blue" /><div className="hero-orbit orbit-a" /><div className="hero-orbit orbit-b" />
      <div className="star star-1" /><div className="star star-2" /><div className="star star-3" /><div className="star star-4" /><div className="star star-5" />
      <div className="hero-content">
        <div className="hero-badge"><Sparkles size={13} /> Персональный ИИ-агент по недвижимости</div>
        <h1>Квартира в Казани<br /><span className="hero-gradient">начинается с диалога</span></h1>
        <p className="hero-lead">Деликатный ИИ-агент помогает посетителю разобраться с районами, ипотекой и подборкой — прямо во время визита на сайт.</p>
        <div className="hero-cta-row"><button className="gradient-button" onClick={() => { scrollToId("agent"); trackGoal("hero_agent_cta"); }}>Познакомиться с агентом <ArrowRight size={17} /></button><a className="ghost-button" href="tel:+79274099179" onClick={() => trackGoal("hero_phone_click")}><Phone size={16} /> +7 927 409-91-79</a></div>
        <div className="hero-trust"><span><Check size={13} /> 18 лет в недвижимости</span><span><Check size={13} /> Официально, как ИП</span><span><Check size={13} /> 24/7</span></div>
      </div>
      <div className="hero-scroll"><span /> Листайте, чтобы узнать больше</div>
    </section>

    <section id="agent" className="agent-intro section-dark">
      <div className="section-inner agent-intro-grid"><div className="agent-intro-copy"><span className="section-eyebrow">ПЛАВАЮЩИЙ АГЕНТ НА САЙТЕ</span><h2>Помогает посетителю<br /><span className="text-gradient-blue">не потеряться в выборе</span></h2><p>Вместо навязчивого звонка — спокойный диалог в удобный момент. Амир задаёт несколько вопросов, отвечает по делу и предлагает контакт только когда это действительно полезно.</p><button className="inline-link" onClick={() => { trackGoal("agent_intro_open"); openAgentEverywhere(); }}>Открыть агента внизу экрана <ArrowRight size={16} /></button></div><AgentPreviewMock /></div>
    </section>

    <PropertyExplorer />

    <section id="benefits" className="benefits-section starfield-subtle"><div className="section-inner"><div className="section-heading centered"><span className="section-eyebrow">ЧТО УМЕЕТ АГЕНТ</span><h2>Больше пользы.<br /><span className="text-gradient-purple">Меньше давления.</span></h2><p>Каждый контакт начинается с помощи, а не с попытки сразу продать.</p></div><div className="benefit-grid">{benefits.map(({ icon: Icon, title, text }) => <article className="benefit-card" key={title}><div className="benefit-icon"><Icon size={20} /></div><h3>{title}</h3><p>{text}</p><span className="benefit-arrow"><ArrowRight size={16} /></span></article>)}</div></div></section>

    <section id="workflow" className="workflow-dark"><div className="section-inner"><div className="section-heading centered"><span className="section-eyebrow">СЦЕНАРИЙ ДИАЛОГА</span><h2>От первого вопроса<br /><span className="text-gradient-blue">до персональной подборки</span></h2><p>Агент мягко собирает параметры, которые обычно теряются между кликом и звонком.</p></div><div className="workflow-steps"><div className="workflow-line" />{[["01", "Знакомится", "Приветствует и предлагает начать без обязательств."], ["02", "Уточняет", "Цель покупки, район и помощь с ипотекой."], ["03", "Фиксирует", "Собирает контакт, когда интерес уже сформирован."], ["04", "Передаёт", "Амиру приходит готовый контекст для подборки."]].map(([num, title, text], index) => <div className={`workflow-step ${index === 2 ? "workflow-step-active" : ""}`} key={num}><div className="step-orb"><span>{num}</span></div><h3>{title}</h3><p>{text}</p></div>)}</div><div className="workflow-note"><Rocket size={17} /> Клиент не чувствует, что проходит анкету — он получает помощь в реальном времени.</div></div></section>

    <section id="trust" className="agent-intro section-dark">
      <div className="section-inner agent-intro-grid trust-grid">
        <div className="trust-photo-wrap">
          <img src="https://shigapov-estate.ru/amir.jpg" alt="Амир Шигапов — риелтор в Казани" className="trust-photo" loading="lazy" />
          <span className="trust-photo-badge"><ShieldCheck size={13} /> ИП · паспорт проверен</span>
        </div>
        <div className="agent-intro-copy">
          <span className="section-eyebrow">РАБОТАЕТ ЗА АГЕНТОМ</span>
          <h2>Амир Шигапов<br /><span className="text-gradient-blue">в недвижимости с 2008 года</span></h2>
          <p>18 лет провожу сделки в Казани — безопасно, выгодно и без нервов. Работаю официально, как ИП. Партнёр Авито «Комфортная сделка», подтверждённый профиль на Домклик и ЦИАН.</p>
          <div className="trust-stats">
            <div><b>18</b><span>лет в недвижимости</span></div>
            <div><b>5.0</b><span>Яндекс Услуги</span></div>
            <div><b>4.8</b><span>2ГИС</span></div>
          </div>
          <div className="trust-actions">
            <a className="gradient-button" href="tel:+79274099179" onClick={() => trackGoal("trust_phone_click")}><Phone size={16} /> +7 927 409-91-79</a>
            <a className="ghost-button" href="https://wa.me/79274099179" target="_blank" rel="noreferrer" onClick={() => trackGoal("trust_whatsapp_click")}>WhatsApp</a>
          </div>
        </div>
      </div>
    </section>

    <section className="kazan-section"><div className="section-inner kazan-grid"><div><span className="section-eyebrow">ТАТАРСТАН · ЛОКАЛЬНЫЙ СЦЕНАРИЙ</span><h2>Знает, о чём<br /><span className="text-gradient-purple">спросить первым</span></h2><p>Казань и города Татарстана — от первого вопроса до подходящей подборки, ипотеки и следующего шага.</p></div><div className="district-cloud">{["Казань", "Заинск", "Альметьевск", "Набережные Челны", "Лениногорск", "Бугульма", "Ипотека", "Новостройки"].map((item, index) => <span className={`district-tag tag-${index % 4}`} key={item}>{item}</span>)}</div></div></section>

    <section id="contact" className="contact-dark"><div className="section-inner contact-grid"><div><span className="section-eyebrow">СВЯЗЬ С АМИРОМ</span><h2>Получите<br /><span className="hero-gradient">персональную консультацию</span></h2><p>Оставьте контакт или звоните напрямую — Амир свяжется с вами в течение дня и подготовит расчёт по вашей задаче.</p><div className="contact-checks"><span><Check size={14} /> Подбор, продажа, выкуп, управление</span><span><Check size={14} /> Без спама и навязывания</span><span><Check size={14} /> Договор с фиксированной комиссией</span></div><div className="trust-actions" style={{ marginTop: 24 }}><a className="gradient-button" href="tel:+79274099179" onClick={() => trackGoal("contact_phone_click")}><Phone size={16} /> +7 927 409-91-79</a><a className="ghost-button" href="https://wa.me/79274099179" target="_blank" rel="noreferrer">WhatsApp</a></div></div><div className="contact-form-card">{formSent ? <div className="form-success"><span><Check size={24} /></span><h3>Заявка принята</h3><p>Амир свяжется с вами в ближайшее время.</p><button className="inline-link" onClick={() => setFormSent(false)}>Отправить ещё одну <ArrowRight size={15} /></button></div> : <form onSubmit={async (event) => { event.preventDefault(); if (leadMutation.isPending) return; setFormError(""); try { await leadMutation.mutateAsync({ ...trackingContext(), name: formName, contact: formContact, source: "Ареал · форма консультации", city: "Казань и Татарстан", purpose: "Запрос консультации", district: "Не указан", mortgage: "Не указан", channel: "form", website: formWebsite, startedAt: formStartedAt }); trackGoal("lead_form_submit", { form: "demo_request", niche: "real_estate_tatarstan" }); setFormSent(true); } catch (error) { setFormError(error instanceof Error ? error.message : "Не удалось отправить заявку. Попробуйте ещё раз."); } }}><div className="form-card-title"><b>Получить консультацию</b><span><Clock3 size={13} /> 5 минут</span></div><label>Ваше имя<input required value={formName} onChange={(event) => setFormName(event.target.value)} placeholder="Как к вам обращаться?" /></label><label>Телефон или Telegram<input required value={formContact} onChange={(event) => setFormContact(event.target.value)} placeholder="+7 (___) ___-__-__" /></label><input className="honeypot" value={formWebsite} onChange={(event) => setFormWebsite(event.target.value)} tabIndex={-1} autoComplete="off" aria-hidden="true" /><label className="consent-row"><input type="checkbox" checked={consent} onChange={(event) => setConsent(event.target.checked)} required /><span>Согласен(на) на обработку имени и контакта для подготовки подборки и связи со мной согласно <a href="/privacy">152-ФЗ</a>.</span></label><button className="gradient-button button-full" type="submit" disabled={leadMutation.isPending || !consent}>{leadMutation.isPending ? "Отправляем…" : <>Получить консультацию <Send size={16} /></>}</button>{formError && <small className="form-error">{formError}</small>}<small>Согласие добровольное и конкретное; данные передаются только владельцу сайта через защищённый Telegram-канал для обработки заявки.</small></form>}</div></div></section>

    <section id="faq" className="faq-dark"><div className="section-inner faq-inner"><div className="section-heading centered"><span className="section-eyebrow">ЧАСТЫЕ ВОПРОСЫ</span><h2>Перед запуском<br /><span className="text-gradient-blue">всё понятно</span></h2></div><div className="faq-list">{faqs.map(([question, answer], index) => <div className={`faq-row ${faqOpen === index ? "faq-row-open" : ""}`} key={question}><button onClick={() => setFaqOpen(faqOpen === index ? null : index)}><span>{question}</span>{faqOpen === index ? <X size={17} /> : <ChevronDown size={17} />}</button>{faqOpen === index && <p>{answer}</p>}</div>)}</div></div></section>
    <section id="privacy" className="privacy-section"><div className="section-inner privacy-card"><div className="privacy-icon"><ShieldCheck size={20} /></div><div><span className="section-eyebrow">152-ФЗ · СОГЛАСИЕ</span><h3>Ваши данные — только для связи по заявке</h3><p>Нажимая кнопку и отмечая согласие, вы добровольно разрешаете обработку имени и контакта для подготовки подборки, ответа на запрос и связи со мной. Согласие можно отозвать, написав владельцу сайта. Формулировка подготовлена как UX-уведомление и требует проверки оператором перед рекламным запуском.</p><a href="https://www.consultant.ru/document/cons_doc_LAW_61801/6c94959bc017ac80140621762d2ac59f6006b08c/" target="_blank" rel="noreferrer">Открыть статью 9 152-ФЗ <ArrowRight size={14} /></a></div></div></section>

    <footer className="galactic-footer"><div className="section-inner footer-inner"><a className="galactic-brand" href="#top"><span className="galactic-logo"><Sparkles size={15} /></span><span>Аре<span className="brand-accent">ал</span></span></a><span>© 2026 ИП Шигапов Амир Фоатович · ОГРНИП 322169000048740 · ИНН 165909137450</span><a href="/privacy">Политика конфиденциальности</a><a href="tel:+79274099179"><Phone size={13} /> +7 927 409-91-79</a></div></footer>
    <AgentWidget />
  </main>;
}
