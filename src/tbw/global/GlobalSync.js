/**
 * TBW GlobalSync™
 * – širi SAMO HITNE događaje
 * – po DRŽAVI / REGIJI
 * – dvostruka potvrda (službeni izvor + TBW heuristika)
 */

const KEY = "tbw_global_sync_last";

export function normalizeRegion(countryCode) {
  return (countryCode || "XX").toUpperCase();
}

export function isCritical(event) {
  return event && event.severity === "CRITICAL" && event.confirmed === true;
}

export function publish(event, countryCode) {
  if (!isCritical(event)) return false;
  const payload = {
    ts: Date.now(),
    region: normalizeRegion(countryCode),
    event,
    source: "TBW AI PREMIUM",
  };
  localStorage.setItem(KEY, JSON.stringify(payload));
  return true;
}

export function readLast() {
  try {
    return JSON.parse(localStorage.getItem(KEY));
  } catch {
    return null;
  }
}
