import { readStore, writeStore } from "../core/storage";

const KEY = {
  enabled: "tbw_parental_enabled",
  profile: "tbw_parental_profile",
  pausedUntil: "tbw_parental_paused_until",
};

export function parentalEnabled() {
  return !!readStore()[KEY.enabled];
}

export function getParentalProfile() {
  return readStore()[KEY.profile] || null;
}

export function saveParentalProfile(profile) {
  // required fields enforced in UI; store minimal
  writeStore({ [KEY.profile]: profile, [KEY.enabled]: true, tbw_parental_ts: Date.now() });
}

export function pauseEscalation(hours = 4) {
  const until = Date.now() + hours * 60 * 60 * 1000;
  writeStore({ [KEY.pausedUntil]: until });
  return until;
}

export function escalationPaused() {
  const until = readStore()[KEY.pausedUntil] || 0;
  return Date.now() < until;
}

export function clearPause() {
  writeStore({ [KEY.pausedUntil]: 0 });
}
