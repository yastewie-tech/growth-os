export type VariantKey = "A" | "B" | "C" | "D" | "E";

const VAR_KEYS: VariantKey[] = ["A", "B", "C", "D", "E"];

function safeJsonParse(input: any) {
  if (!input) return null;
  if (typeof input === "object") return input;
  if (typeof input !== "string") return null;
  try {
    return JSON.parse(input);
  } catch {
    return null;
  }
}

function isNonEmptyString(v: any) {
  return typeof v === "string" && v.trim().length > 0;
}

export function normalizeVariants(rawVariants: any, legacyTestImages?: any) {
  const parsed = safeJsonParse(rawVariants) || {};
  const next: any = typeof parsed === "object" && parsed ? { ...parsed } : {};

  next.assets = next.assets && typeof next.assets === "object" ? { ...next.assets } : {};

  const legacyImagesMap =
    next.assets.images && typeof next.assets.images === "object" ? { ...next.assets.images } : null;

  const legacyArray = Array.isArray(legacyTestImages) ? legacyTestImages : [];

  const imagesMap: Record<string, string> = {};

  for (let i = 0; i < VAR_KEYS.length; i++) {
    const key = VAR_KEYS[i];
    const current = next[key] && typeof next[key] === "object" ? { ...next[key] } : {};
    current.assets = current.assets && typeof current.assets === "object" ? { ...current.assets } : {};

    const existingImages = Array.isArray(current.assets.images)
      ? current.assets.images.filter(isNonEmptyString)
      : [];

    const legacyMapUrl = legacyImagesMap ? legacyImagesMap[key] : null;
    const legacyArrayUrl = legacyArray[i];
    const fallbackUrl = isNonEmptyString(legacyMapUrl)
      ? legacyMapUrl
      : isNonEmptyString(legacyArrayUrl)
        ? legacyArrayUrl
        : "";

    if (existingImages.length === 0 && isNonEmptyString(fallbackUrl)) {
      current.assets.images = [fallbackUrl];
    } else if (existingImages.length > 0) {
      current.assets.images = existingImages;
    } else {
      current.assets.images = [];
    }

    if (current.assets.images[0]) imagesMap[key] = current.assets.images[0];
    next[key] = current;
  }

  next.assets.images = imagesMap;

  if (!isNonEmptyString(next.insight)) {
    if (isNonEmptyString(next.assets.insight)) next.insight = next.assets.insight;
    else next.insight = "";
  }

  if (!isNonEmptyString(next.assets.insight)) {
    next.assets.insight = next.insight || "";
  }

  next.ai = next.ai && typeof next.ai === "object" ? { ...next.ai } : {};
  if (!Array.isArray(next.ai.history)) next.ai.history = [];

  if (next.ai.latest === undefined || next.ai.latest === null) {
    if (next.assets?.ai?.last_json) next.ai.latest = next.assets.ai.last_json;
    else if (isNonEmptyString(next.assets?.insight)) next.ai.latest = next.assets.insight;
    else if (next.ai_mixer_v3) next.ai.latest = next.ai_mixer_v3;
  }

  return next;
}

export function getVariantImage(variants: any, key: VariantKey) {
  const v = normalizeVariants(variants);
  const list = v?.[key]?.assets?.images;
  if (Array.isArray(list) && list.length > 0) return list[0];
  return v?.assets?.images?.[key] || "";
}

export function getVariantImages(variants: any, key: VariantKey) {
  const v = normalizeVariants(variants);
  const list = v?.[key]?.assets?.images;
  if (Array.isArray(list)) return list.filter(isNonEmptyString);
  const fallback = v?.assets?.images?.[key];
  return isNonEmptyString(fallback) ? [fallback] : [];
}

export function setVariantImage(variants: any, key: VariantKey, url: string) {
  const v = normalizeVariants(variants);
  const current = v[key] && typeof v[key] === "object" ? { ...v[key] } : {};
  current.assets = current.assets && typeof current.assets === "object" ? { ...current.assets } : {};
  current.assets.images = isNonEmptyString(url) ? [url] : [];
  v[key] = current;
  v.assets.images = { ...(v.assets.images || {}), [key]: url };
  return v;
}

export function appendAiHistory(variants: any, latest: any) {
  const v = normalizeVariants(variants);
  const history = Array.isArray(v.ai?.history) ? [...v.ai.history] : [];

  const toEntry = (value: any) => {
    if (value && typeof value === "object" && "timestamp" in value && "value" in value) {
      return value;
    }
    return { timestamp: formatTimestamp(new Date()), value };
  };

  if (v.ai?.latest !== undefined && v.ai?.latest !== null) {
    const hasContent =
      typeof v.ai.latest === "string" ? v.ai.latest.trim().length > 0 : true;
    if (hasContent) history.unshift(toEntry(v.ai.latest));
  }

  v.ai.latest = latest;
  v.ai.history = history.map(toEntry);
  if (typeof latest === "string") {
    v.insight = latest;
    v.assets.insight = latest;
  } else if (latest) {
    const serialized = JSON.stringify(latest);
    v.insight = serialized;
    v.assets.insight = serialized;
  }
  return v;
}

function formatTimestamp(date: Date) {
  const pad = (n: number) => String(n).padStart(2, "0");
  const yyyy = date.getFullYear();
  const mm = pad(date.getMonth() + 1);
  const dd = pad(date.getDate());
  const hh = pad(date.getHours());
  const mi = pad(date.getMinutes());
  return `${yyyy}-${mm}-${dd} ${hh}:${mi}`;
}

export function tryParseJson(text: string) {
  if (!isNonEmptyString(text)) return null;
  const t = text.trim();
  if (!(t.startsWith("{") || t.startsWith("["))) return null;
  try {
    return JSON.parse(t);
  } catch {
    return null;
  }
}
