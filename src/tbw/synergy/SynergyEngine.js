/**
 * TBW Synergy™
 * – dijeljenje SAMO HITNIH informacija
 * – po DRŽAVI / REGIJI
 * – ide TEK NAKON DVOSTRUKE POTVRDE (službeni izvor + TBW)
 */

const KEY = "tbw_synergy_last";

export function canBroadcast(event) {
  return (
    event &&
    event.severity === "CRITICAL" &&
    event.confirmed === true
  );
}

export function broadcast(event) {
  localStorage.setItem(KEY, JSON.stringify({
    ts: Date.now(),
    event,
  }));
  // DEMO: lokalni broadcast (kasnije push / rds / cell)
  return true;
}

export function lastBroadcast() {
  try {
    return JSON.parse(localStorage.getItem(KEY));
  } catch {
    return null;
  }
}
