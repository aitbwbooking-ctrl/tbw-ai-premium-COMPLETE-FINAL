/**
 * TBW VoiceAuthority™
 * – razlikuje vozača i putnike
 * – putnici NE mogu mijenjati navigaciju
 * – putnici mogu prijaviti opasnost
 */

let DRIVER_VOICE_ID = null;

export function registerDriverVoice(voicePrint) {
  DRIVER_VOICE_ID = voicePrint;
}

export function classifySpeaker({ voicePrint }) {
  if (!DRIVER_VOICE_ID) return "UNKNOWN";
  return voicePrint === DRIVER_VOICE_ID ? "DRIVER" : "PASSENGER";
}

export function handleCommand({ role, intent }) {
  if (role === "PASSENGER") {
    if (intent === "HAZARD_REPORT") return { allowed: true };
    return { allowed: false, reason: "Driver authority required" };
  }
  return { allowed: true };
}
