/**
 * TBW DecisionLog™
 * – dodatni zapis svih ključnih odluka
 * – ne briše se automatski
 */

const KEY = "tbw_decision_log";

export function log(entry) {
  const prev = JSON.parse(localStorage.getItem(KEY) || "[]");
  prev.push({ ts: Date.now(), ...entry });
  localStorage.setItem(KEY, JSON.stringify(prev));
}

export function readLog() {
  try {
    return JSON.parse(localStorage.getItem(KEY)) || [];
  } catch {
    return [];
  }
}
