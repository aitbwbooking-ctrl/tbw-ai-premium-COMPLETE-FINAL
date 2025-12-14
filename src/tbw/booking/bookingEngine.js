import { readStore, writeStore } from "../core/storage";
import { getLang } from "../core/i18n";

const KEY = {
  mode: "tbw_plan_mode", // "TRIAL" | "DEMO" | "PREMIUM"
  affiliate: "tbw_affiliate_ids", // { booking: "", airbnb:"", ... }
};

export function getPlanMode() {
  const s = readStore();
  return s[KEY.mode] || "TRIAL";
}
export function setPlanMode(mode) {
  writeStore({ [KEY.mode]: mode });
}

export function getAffiliateIds() {
  const s = readStore();
  return s[KEY.affiliate] || { booking: "", airbnb: "", transport: "" };
}
export function setAffiliateIds(ids) {
  writeStore({ [KEY.affiliate]: { ...getAffiliateIds(), ...ids } });
}

function norm(txt) {
  return (txt || "").toLowerCase().trim();
}

export function detectBookingIntent(transcript) {
  const t = norm(transcript);

  const any = (arr) => arr.some((p) => t.includes(p));

  const intents = {
    hotel: any(["hotel", "apartman", "apartmani", "smještaj", "soba", "resort", "booking"]),
    taxi: any(["taxi", "taksi", "uber", "bolt", "transfer", "vozač"]),
    rent: any(["rent", "rent a car", "rentacar", "iznajmi auto", "najam auta", "auto na najam"]),
    flight: any(["avion", "let", "flight", "zračna luka", "airport", "gate"]),
    ferry: any(["trajekt", "ferry", "katamaran", "gliser", "brod", "linija"]),
    train: any(["vlak", "train", "željezn", "kolodvor"]),
    bus: any(["bus", "autobus", "linija", "autobusni"]),
    bike: any(["bicikl", "bike", "biciklist", "staza", "renta bicikla"]),
    food: any(["restoran", "večera", "ručak", "pizza", "gastro", "konoba"]),
    events: any(["event", "događaj", "festival", "koncert", "izlazak", "club", "klub"]),
    sights: any(["znamenit", "što vidjeti", "atrakc", "muzej", "stari grad", "šetnja"]),
  };

  const hit = Object.entries(intents).find(([, v]) => v);
  return hit ? hit[0] : null;
}

export function extractCity(transcript, fallbackCity = "") {
  // Best-effort: look for "u {city}" or known cities
  const t = norm(transcript);
  const known = ["split", "zagreb", "zadar", "rijeka", "dubrovnik", "karlovac", "osijek", "munchen", "münchen", "berlin"];
  for (const c of known) {
    if (t.includes(`u ${c}`) || t.includes(`in ${c}`) || t.includes(c)) return capCity(c);
  }
  return fallbackCity;
}

function capCity(c) {
  if (!c) return "";
  const map = { munchen: "Munich", "münchen": "Munich" };
  const v = map[c.toLowerCase()] || c;
  return v.charAt(0).toUpperCase() + v.slice(1);
}

function openUrl(url) {
  window.open(url, "_blank", "noopener,noreferrer");
}

function bookingSearchUrl({ city, q = "accommodation" }) {
  const lang = getLang();
  // Works without any API keys (functional), affiliate ids may be appended later.
  const base = "https://www.booking.com/searchresults.html";
  const params = new URLSearchParams();
  params.set("ss", `${q} ${city}`.trim());
  params.set("lang", lang);
  return `${base}?${params.toString()}`;
}

function googleMapsSearchUrl(q) {
  const params = new URLSearchParams();
  params.set("api", "1");
  params.set("query", q);
  return `https://www.google.com/maps/search/?${params.toString()}`;
}

// DEMO/TRIAL curated “5★ concierge” picks (works offline-ish as examples)
const DEMO = {
  Split: {
    hotels: [
      { title: "Family-friendly hotel (24h reception, parking)", why: "Late arrivals + family safety, predictable service.", avoid: false },
      { title: "Quiet boutique stay (low-noise, central, well-lit)", why: "Less stress after long drive; easy walkable center.", avoid: false },
      { title: "Cheapest option near nightlife", why: "Noise + late-night crowds not ideal for families.", avoid: true },
    ],
    food: [
      { title: "Calm family restaurant (early seating)", why: "Fast service, safe area, easy parking.", avoid: false },
      { title: "Popular tourist hotspot", why: "Long queues; overpriced; stressful with kids.", avoid: true },
    ],
    events: [
      { title: "Early evening local event", why: "Low crowd density, safe return.", avoid: false },
      { title: "Late-night club zone", why: "High incident probability weekends; not recommended.", avoid: true },
    ],
    sights: [
      { title: "Old town walk (daylight)", why: "Best atmosphere + safer visibility.", avoid: false },
      { title: "Viewpoint near steep edges at night", why: "Risky in dark/wind; skip tonight.", avoid: true },
    ],
    transport: {
      taxi: [
        { title: "Standard taxi/transfer", why: "Fast pickup near your location.", avoid: false },
      ],
      rent: [
        { title: "Automatic + full insurance (family)", why: "Lowest stress; safer in winter conditions.", avoid: false },
      ],
      ferry: [
        { title: "Next available ferry (weather check)", why: "TBW will warn if wind becomes unsafe.", avoid: false },
      ],
      train: [
        { title: "Direct train (fewer transfers)", why: "Less risk of missed connections.", avoid: false },
      ],
      bus: [
        { title: "Daytime bus (safe arrival)", why: "Better lighting + easier last-mile taxi.", avoid: false },
      ],
      bike: [
        { title: "Bike route on dedicated paths", why: "Avoids main traffic; safer ride.", avoid: false },
      ],
      flight: [
        { title: "Airport transfer + flight monitoring", why: "TBW syncs delays with hotel/transfer.", avoid: false },
      ],
    },
  },
};

function pickDemoCity(city) {
  return DEMO[city] ? city : "Split";
}

export function conciergeSuggest({ city, intent }) {
  const c = pickDemoCity(city || "Split");
  const data = DEMO[c];

  if (intent === "hotel") return data.hotels;
  if (intent === "food") return data.food;
  if (intent === "events") return data.events;
  if (intent === "sights") return data.sights;

  // transport intents
  const t = data.transport;
  if (intent === "taxi") return t.taxi;
  if (intent === "rent") return t.rent;
  if (intent === "ferry") return t.ferry;
  if (intent === "train") return t.train;
  if (intent === "bus") return t.bus;
  if (intent === "bike") return t.bike;
  if (intent === "flight") return t.flight;

  return [];
}

export function conciergeActions({ city, intent }) {
  const safeCity = city || "Split";
  const actions = [];

  if (intent === "hotel") {
    actions.push({
      label: "Open booking search",
      run: () => openUrl(bookingSearchUrl({ city: safeCity, q: "hotel apartment family parking" })),
    });
  }

  if (intent === "food") {
    actions.push({ label: "Open restaurants map", run: () => openUrl(googleMapsSearchUrl(`family restaurant ${safeCity}`)) });
  }

  if (intent === "events") {
    actions.push({ label: "Open events nearby", run: () => openUrl(googleMapsSearchUrl(`events ${safeCity}`)) });
  }

  if (intent === "sights") {
    actions.push({ label: "Open sights map", run: () => openUrl(googleMapsSearchUrl(`top sights ${safeCity}`)) });
  }

  if (["taxi", "rent", "flight", "ferry", "train", "bus", "bike"].includes(intent)) {
    const qMap = {
      taxi: "taxi transfer",
      rent: "rent a car",
      flight: "airport",
      ferry: "ferry terminal",
      train: "train station",
      bus: "bus station",
      bike: "bike rental",
    };
    actions.push({ label: "Open transport map", run: () => openUrl(googleMapsSearchUrl(`${qMap[intent]} ${safeCity}`)) });
  }

  // Always provide “plan B” action (doesn't force it)
  actions.push({
    label: "Show Plan B (safe alternatives)",
    run: () => openUrl(bookingSearchUrl({ city: safeCity, q: "24h reception safe family" })),
  });

  return actions;
}
