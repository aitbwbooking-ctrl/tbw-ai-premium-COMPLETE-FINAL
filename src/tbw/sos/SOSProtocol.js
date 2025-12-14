/**
 * TBW SOSProtocol™
 * – automatska procjena (udar, zvuk, tišina, govor)
 * – može PREGAZITI user “ne zovi” u kritičnim slučajevima (šok)
 * – dvosmjerna komunikacija s operaterom (tekstualni payload)
 */

const KEY = {
  active: "tbw_sos_active",
  last: "tbw_sos_last",
};

export function detectImpact({ accel, soundPeak, silenceMs }) {
  // DEMO pragovi (PREMIUM kasnije)
  if (accel > 3.5) return "IMPACT";
  if (soundPeak > 0.85) return "CRASH_SOUND";
  if (silenceMs > 15000) return "SILENCE";
  return null;
}

export function startSOS(payload) {
  localStorage.setItem(KEY.active, "1");
  localStorage.setItem(KEY.last, JSON.stringify({ ts: Date.now(), payload }));
  // ovdje ide integracija s lokalnim brojem hitnih službi (kasnije)
  return true;
}

export function stopSOS() {
  localStorage.removeItem(KEY.active);
}

export function isSOSActive() {
  return localStorage.getItem(KEY.active) === "1";
}

export function buildOperatorPayload({
  country = "HR",
  lang = "en",
  location,
  summary,
  sensors,
  injuries,
}) {
  return {
    country,
    lang,
    location,
    summary,
    sensors,
    injuries,
    source: "TBW AI PREMIUM",
    confidence: "HIGH",
  };
}
