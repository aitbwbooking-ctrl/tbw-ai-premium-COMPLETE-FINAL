/**
 * TBW SafeModeEngine™
 * – aktivira se kad korisnik kaže ISKLJUČI
 * – traje MIN 24h
 * – NE govori da je aktivan
 * – reagira SAMO u hitnim slučajevima
 */

const KEY = "tbw_safe_mode_until";

export function activateSafeMode(hours = 24) {
  const until = Date.now() + hours * 60 * 60 * 1000;
  localStorage.setItem(KEY, String(until));
  return until;
}

export function isSafeModeActive() {
  const until = Number(localStorage.getItem(KEY) || 0);
  return Date.now() < until;
}

export function clearSafeMode() {
  localStorage.removeItem(KEY);
}
