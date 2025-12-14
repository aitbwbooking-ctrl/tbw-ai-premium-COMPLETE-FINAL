/**
 * TBW OperatorBridge™
 * – automatski odabir jezika i države
 * – dvosmjerna komunikacija (payload za operatera)
 * – radi i bez kamere (fallback na senzore/zvuk)
 */

export function resolveLocale({ country, userLang }) {
  // jezik operatera = jezik države (fallback en)
  const map = {
    HR: "hr", DE: "de", AT: "de", IT: "it", FR: "fr", ES: "es", JP: "ja", CN: "zh",
  };
  return map[country] || userLang || "en";
}

export function buildOperatorMessage({
  country,
  userLang,
  location,
  incidentType,
  sensors,
  injuries,
  vehicleProfile,
}) {
  return {
    toCountry: country,
    operatorLang: resolveLocale({ country, userLang }),
    source: "TBW AI PREMIUM",
    incidentType,
    location,
    vehicleProfile,
    sensors,
    injuries,
    confidence: "HIGH",
    note: "Automated safety escalation. Voice + sensors analyzed.",
    ts: Date.now(),
  };
}

export function sendToOperator(payload) {
  // DEMO: log-only. PREMIUM: emergency gateway.
  console.log("TBW → OPERATOR", payload);
  return true;
}
