import {
  DEFAULT_PREFERENCES,
  KNOWN_CATEGORIES,
  SEEN_RETENTION_MS
} from "./constants.js";

export function normalizeKey(value) {
  return String(value ?? "")
    .normalize("NFKD")
    .toLowerCase()
    .replace(/&/g, " and ")
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "");
}

function cleanText(value) {
  return typeof value === "string" ? value.trim() : "";
}

function safeHttpsUrl(value) {
  try {
    const url = new URL(value);
    return url.protocol === "https:" ? url.href : "";
  } catch {
    return "";
  }
}

export function parseProviderDate(value) {
  const text = cleanText(value);
  if (!text || /^n\/?a$/i.test(text) || /^unknown$/i.test(text)) return null;

  const match = text.match(/^(\d{4})-(\d{2})-(\d{2})(?:[ T](\d{2}):(\d{2})(?::(\d{2}))?)?$/);
  if (match) {
    const [, year, month, day, hour = "00", minute = "00", second = "00"] = match;
    const date = new Date(Date.UTC(+year, +month - 1, +day, +hour, +minute, +second));
    return Number.isNaN(date.getTime()) ? null : date.toISOString();
  }

  const parsed = new Date(text);
  return Number.isNaN(parsed.getTime()) ? null : parsed.toISOString();
}

function normalizePlatforms(value) {
  const labels = Array.isArray(value)
    ? value
    : cleanText(value).split(",");
  const byKey = new Map();

  for (const rawLabel of labels) {
    const label = cleanText(rawLabel);
    const key = normalizeKey(label);
    if (key && !byKey.has(key)) byKey.set(key, { key, label });
  }

  return [...byKey.values()];
}

export function normalizeOffer(raw) {
  if (!raw || typeof raw !== "object") return null;
  if (cleanText(raw.status) && cleanText(raw.status).toLowerCase() !== "active") return null;

  const id = String(raw.id ?? "").trim();
  const title = cleanText(raw.title);
  const typeLabel = cleanText(raw.type);
  const platforms = normalizePlatforms(raw.platforms);

  if (!id || !title || !typeLabel || platforms.length === 0) return null;

  return {
    id,
    title,
    description: cleanText(raw.description),
    platforms,
    type: { key: normalizeKey(typeLabel), label: typeLabel },
    thumbnailUrl: safeHttpsUrl(raw.thumbnail || raw.image),
    claimUrl: safeHttpsUrl(
      raw.open_giveaway_url || raw.open_giveaway || raw.gamerpower_url
    ),
    worth: cleanText(raw.worth),
    publishedAt: parseProviderDate(raw.published_date),
    endsAt: parseProviderDate(raw.end_date)
  };
}

function mergeOffer(existing, incoming) {
  const platforms = new Map(existing.platforms.map((platform) => [platform.key, platform]));
  for (const platform of incoming.platforms) platforms.set(platform.key, platform);

  return {
    ...existing,
    ...incoming,
    description: incoming.description || existing.description,
    thumbnailUrl: incoming.thumbnailUrl || existing.thumbnailUrl,
    claimUrl: incoming.claimUrl || existing.claimUrl,
    platforms: [...platforms.values()]
  };
}

export function sortOffers(offers) {
  return [...offers].sort((a, b) => {
    const aEnd = a.endsAt ? Date.parse(a.endsAt) : Number.POSITIVE_INFINITY;
    const bEnd = b.endsAt ? Date.parse(b.endsAt) : Number.POSITIVE_INFINITY;
    if (aEnd !== bEnd) return aEnd - bEnd;

    const aPublished = a.publishedAt ? Date.parse(a.publishedAt) : 0;
    const bPublished = b.publishedAt ? Date.parse(b.publishedAt) : 0;
    if (aPublished !== bPublished) return bPublished - aPublished;
    return a.title.localeCompare(b.title);
  });
}

export function normalizeOffers(payload) {
  if (!Array.isArray(payload)) throw new TypeError("Giveaway response must be an array.");

  const byId = new Map();
  for (const raw of payload) {
    const offer = normalizeOffer(raw);
    if (!offer) continue;
    const existing = byId.get(offer.id);
    byId.set(offer.id, existing ? mergeOffer(existing, offer) : offer);
  }

  return sortOffers([...byId.values()]);
}

function normalizeCategoryList(list) {
  if (!Array.isArray(list)) return [];
  const byKey = new Map();
  for (const item of list) {
    const label = cleanText(item?.label);
    const key = normalizeKey(item?.key || label);
    if (key && label && !byKey.has(key)) byKey.set(key, { key, label });
  }
  return [...byKey.values()];
}

export function mergeKnownCategories(...catalogues) {
  const platforms = new Map();
  const types = new Map();

  for (const catalogue of [KNOWN_CATEGORIES, ...catalogues]) {
    for (const item of normalizeCategoryList(catalogue?.platforms)) {
      if (!platforms.has(item.key)) platforms.set(item.key, item);
    }
    for (const item of normalizeCategoryList(catalogue?.types)) {
      if (!types.has(item.key)) types.set(item.key, item);
    }
  }

  return { platforms: [...platforms.values()], types: [...types.values()] };
}

export function discoverCategories(offers) {
  const platforms = new Map();
  const types = new Map();

  for (const offer of offers ?? []) {
    for (const platform of offer.platforms ?? []) platforms.set(platform.key, platform);
    if (offer.type?.key && offer.type?.label) types.set(offer.type.key, offer.type);
  }

  return { platforms: [...platforms.values()], types: [...types.values()] };
}

function uniqueKeys(values) {
  return [...new Set((Array.isArray(values) ? values : []).map(normalizeKey).filter(Boolean))];
}

export function normalizePreferences(value, useDefaults = true) {
  if (!value || typeof value !== "object") {
    return useDefaults
      ? {
          enabledPlatforms: [...DEFAULT_PREFERENCES.enabledPlatforms],
          enabledTypes: [...DEFAULT_PREFERENCES.enabledTypes]
        }
      : { enabledPlatforms: [], enabledTypes: [] };
  }

  return {
    enabledPlatforms: uniqueKeys(value.enabledPlatforms),
    enabledTypes: uniqueKeys(value.enabledTypes)
  };
}

export function isOfferActive(offer, now = Date.now()) {
  return !offer.endsAt || Date.parse(offer.endsAt) > now;
}

export function filterOffers(offers, preferences, now = Date.now()) {
  const normalized = normalizePreferences(preferences);
  const platforms = new Set(normalized.enabledPlatforms);
  const types = new Set(normalized.enabledTypes);

  return (offers ?? []).filter(
    (offer) =>
      isOfferActive(offer, now) &&
      types.has(offer.type.key) &&
      offer.platforms.some((platform) => platforms.has(platform.key))
  );
}

export function pruneSeenOffers(seenOffers, now = Date.now()) {
  const result = {};
  if (!seenOffers || typeof seenOffers !== "object") return result;

  for (const [id, timestamp] of Object.entries(seenOffers)) {
    const visitedAt = Number(timestamp);
    if (Number.isFinite(visitedAt) && now - visitedAt <= SEEN_RETENTION_MS) {
      result[id] = visitedAt;
    }
  }
  return result;
}

export function getUnseenOffers(offers, preferences, seenOffers, now = Date.now()) {
  const seen = seenOffers && typeof seenOffers === "object" ? seenOffers : {};
  return filterOffers(offers, preferences, now).filter((offer) => !seen[offer.id]);
}

export function formatBadgeCount(count) {
  if (!Number.isFinite(count) || count <= 0) return "";
  return count > 99 ? "99+" : String(Math.floor(count));
}
