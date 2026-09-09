export type CatalogProperty = {
  title: string;
  city: string;
  location: string;
  price: string;
  priceValue: number;
  meta: string;
  badge: string;
  description: string;
  mortgageAvailable: boolean;
  photoUrl?: string;
};

function normalizeProperty(value: unknown): CatalogProperty | null {
  if (!value || typeof value !== "object") return null;
  const item = value as Record<string, unknown>;
  const title = String(item.title || item.name || "").trim();
  const city = String(item.city || "Казань").trim();
  const location = String(item.location || item.district || item.area || "Район не указан").trim();
  const priceValue = Number(item.priceValue ?? item.price ?? 0);
  if (!title || !Number.isFinite(priceValue) || priceValue <= 0) return null;
  const price = String(item.priceLabel || item.price || `${priceValue} млн ₽`);
  return {
    title,
    city,
    location,
    price,
    priceValue,
    meta: String(item.meta || [item.rooms ? `${item.rooms}-комн.` : "", item.area ? `${item.area} м²` : ""].filter(Boolean).join(" · ") || "Подробности по запросу"),
    badge: String(item.badge || "Актуальное предложение"),
    description: String(item.description || "Подробности объекта уточнит Амир."),
    mortgageAvailable: Boolean(item.mortgageAvailable ?? item.mortgage ?? false),
    photoUrl: typeof item.photoUrl === "string" ? item.photoUrl : undefined,
  };
}

export async function getCatalog() {
  const sourceUrl = process.env.CATALOG_SOURCE_URL;
  if (!sourceUrl) return { properties: null, source: "demo" as const };
  const response = await fetch(sourceUrl, { headers: { Accept: "application/json" } });
  if (!response.ok) throw new Error(`Catalog source failed: ${response.status}`);
  const payload = (await response.json()) as unknown;
  const rows = Array.isArray(payload) ? payload : (payload as { properties?: unknown[] }).properties;
  if (!Array.isArray(rows)) throw new Error("Catalog JSON must be an array or contain a properties array");
  const properties = rows.map(normalizeProperty).filter((item): item is CatalogProperty => Boolean(item)).slice(0, 100);
  return { properties, source: "remote" as const };
}
