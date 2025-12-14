/**
 * TBW OwnerShield™
 * – bilježi privole, aktivacije i AUTOMATSKE ODLUKE
 * – služi kao dokaz “best-effort safety system”
 */

const KEY = "tbw_owner_shield_log";

export function logDecision(entry) {
  const prev = JSON.parse(localStorage.getItem(KEY) || "[]");
  prev.push({ ts: Date.now(), ...entry });
  localStorage.setItem(KEY, JSON.stringify(prev));
}

export function getShieldLog() {
  try {
    return JSON.parse(localStorage.getItem(KEY)) || [];
  } catch {
    return [];
  }
}
