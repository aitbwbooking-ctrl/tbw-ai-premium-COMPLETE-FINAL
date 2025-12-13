export const TBW_STORE_KEY = "TBW_AI_PREMIUM_STORE_V1";

export function readStore() {
  try {
    const raw = localStorage.getItem(TBW_STORE_KEY);
    return raw ? JSON.parse(raw) : {};
  } catch {
    return {};
  }
}

export function writeStore(patch) {
  const prev = readStore();
  const next = { ...prev, ...patch };
  localStorage.setItem(TBW_STORE_KEY, JSON.stringify(next));
  return next;
}

export function getFlag(key, fallback = false) {
  const s = readStore();
  return typeof s[key] === "boolean" ? s[key] : fallback;
}

export function setFlag(key, value) {
  return writeStore({ [key]: !!value });
}
