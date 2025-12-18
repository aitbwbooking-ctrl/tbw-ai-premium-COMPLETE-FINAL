import React, { useEffect, useMemo, useRef, useState } from "react";

/**
 * TBW AI PREMIUM — App.jsx (FULL)
 * ------------------------------------------------------------
 * Mobile-first premium UI + voice assistant + booking concierge.
 *
 * FIXES INCLUDED (per user requirements):
 * 1) City detection works for ANY city in the world (free-text), not only a fixed list.
 * 2) NEVER treats "hotelu / apartmanu / smještaju" etc. as a city.
 * 3) Does NOT fall back to Zagreb if user clearly said another city (Paris/Tokio/etc).
 * 4) After Booking opens, conversation continues in TBW; state (city/guests/dates/type) is kept.
 * 5) Voice de-duplication and repeat-compression to avoid "smještaj smještaj smještaj".
 * 6) "SEND" = typed only; Mic = continuous conversation (no SEND needed).
 *
 * Notes:
 * - Web Speech API availability depends on browser (Chrome/Edge best).
 * - Mobile browsers often pause mic when switching tabs; we handle visibilitychange to retry,
 *   but a user gesture may still be required by the OS/browser.
 */

/* ----------------------------- CONFIG ----------------------------- */

const DEFAULT_CITY = "Zagreb";
const DEFAULT_LANG = "hr";
const SR_LANG = "sr"; // optional
const DEFAULT_VOICE_LANG = "hr-HR";

/* ----------------------------- TEXT UTILS ----------------------------- */

const normalize = (s) =>
  (s || "")
    .toLowerCase()
    .replace(/\u00a0/g, " ")
    .replace(/[“”„"]/g, '"')
    .replace(/[’']/g, "'")
    .replace(/č/g, "c")
    .replace(/ć/g, "c")
    .replace(/đ/g, "d")
    .replace(/š/g, "s")
    .replace(/ž/g, "z")
    .trim();

const titleCase = (s) =>
  (s || "")
    .trim()
    .split(/\s+/)
    .filter(Boolean)
    .map((w) => (w ? w[0].toUpperCase() + w.slice(1) : w))
    .join(" ");

const collapseSpaces = (s) => (s || "").replace(/\s+/g, " ").trim();

const stripPunct = (s) =>
  (s || "")
    .replace(/[!?.,;:()[\]{}<>]/g, " ")
    .replace(/\s+/g, " ")
    .trim();

/**
 * Compress repeated words that happen with SpeechRecognition (e.g. "smjestaj smjestaj smjestaj u").
 * Keeps up to maxRepeat for same word in a row.
 */
function compressRepeatWords(input, maxRepeat = 1) {
  const s = collapseSpaces(input || "");
  if (!s) return "";
  const words = s.split(" ");
  const out = [];
  let last = null;
  let count = 0;

  for (const w of words) {
    const nw = normalize(w);
    if (nw && nw === last) {
      count += 1;
      if (count <= maxRepeat) out.push(w);
    } else {
      last = nw;
      count = 1;
      out.push(w);
    }
  }
  return collapseSpaces(out.join(" "));
}

/**
 * Try to remove filler words from voice results.
 */
function cleanVoiceText(input) {
  let s = collapseSpaces(input || "");
  s = compressRepeatWords(s, 1);
  // remove obvious fillers at edges
  s = s.replace(/^(ono|ovaj|ovako|znaci|pa|mislim)\s+/i, "");
  s = s.replace(/\s+(ono|ovaj|ovako|znaci|pa|mislim)$/i, "");
  return collapseSpaces(s);
}

/* ----------------------------- INTENT / PARSING ----------------------------- */

/**
 * Keywords that indicate accommodation / booking intent.
 * (Keep diacritics-free versions too because we normalize.)
 */
const ACCOMMODATION_KW = [
  "smjestaj",
  "smještaj",
  "hotel",
  "hotelu",
  "hotele",
  "apartman",
  "apartmanu",
  "apartmani",
  "booking",
  "airbnb",
  "nocenje",
  "nocenja",
  "nocenje",
  "nocenje",
  "sobe",
  "rezervacija",
  "rezervaciju",
  "rezerviraj",
  "book",
  "accommodation",
  "room",
  "rooms",
  "stay",
  "stays",
];

/**
 * Words that should NEVER be treated as a city.
 * This is the key fix for "smještaj u hotelu" => must not set city=hotelu.
 */
const NOT_A_CITY_WORDS = new Set(
  [
    // accommodation types & common nouns
    "hotel",
    "hotelu",
    "hotela",
    "hoteli",
    "apartman",
    "apartmanu",
    "apartmana",
    "apartmani",
    "hostel",
    "hostelu",
    "soba",
    "sobe",
    "smjestaj",
    "smještaj",
    "rezervacija",
    "rezervaciju",
    "booking",
    "airbnb",
    "nocenje",
    "nocenja",
    "nocenje",
    "nocenje",
    "noc",
    "nocni",
    "nocenje",
    "let",
    "letovi",
    "aerodrom",
    "airport",
    "centar",
    "grad",
    "mjesto",
    "mjestu",
    "more",
    "plaza",
    "plaža",
    "planina",
    "selu",
    "selu",
    "selo",
    "kuci",
    "kuca",
    "kuća",
    "kuci",
    "stan",
    "stanu",
    "stanovi",
    "villa",
    "vila",
    "vili",
    "vilu",
    "resort",
    "kamp",
    "kampu",
    "camp",
    "motel",
    "pansion",
    "pansionu",
    "b&b",
    "bnb",
    "studio",
    "studiju",
    "ulici",
    "ulica",
    "trg",
    "trgu",
    "kvart",
    "kvartu",
    // prepositions (avoid bad captures)
    "u",
    "na",
    "za",
    "kod",
    "prema",
    "do",
    "od",
    "iz",
    "into",
    "in",
    "to",
    // common verbs
    "trazim",
    "trebam",
    "hocuu",
    "hocu",
    "zelim",
    "želim",
    "zelim",
    "daj",
    "otvori",
    "pokazi",
    "prikazi",
    "idi",
    "odvedi",
    "nadi",
    "nadji",
    "find",
    "search",
    // days/months (avoid capturing as city)
    "pon",
    "uto",
    "sri",
    "cet",
    "pet",
    "sub",
    "ned",
    "januar",
    "februar",
    "mart",
    "april",
    "maj",
    "jun",
    "jul",
    "avgust",
    "septembar",
    "oktobar",
    "novembar",
    "decembar",
    "sijecanj",
    "veljaca",
    "ozujak",
    "travanj",
    "svibanj",
    "lipanj",
    "srpanj",
    "kolovoz",
    "rujan",
    "listopad",
    "studeni",
    "prosinac",
  ].map(normalize)
);

/**
 * Words that imply place type (not a city).
 */
const PLACE_TYPE = [
  { key: "hotel", re: /\bhotel(u|a|i|e)?\b/i, label: "hotel" },
  { key: "apartman", re: /\bapartman(u|a|i|e)?\b/i, label: "apartman" },
  { key: "hostel", re: /\bhostel(u|a|i|e)?\b/i, label: "hostel" },
  { key: "soba", re: /\bsob(a|e|u|i)?\b/i, label: "soba" },
  { key: "kamp", re: /\bkamp(u|a|i|e)?\b|\bcamp\b/i, label: "kamp" },
  { key: "vila", re: /\bvil(a|e|u|i)?\b|\bvilla\b/i, label: "vila" },
];

/**
 * Determine intent flags.
 */
function detectIntent(text) {
  const t = normalize(text);
  const accommodation = ACCOMMODATION_KW.some((k) => t.includes(normalize(k)));

  const wantsNavigation =
    t.includes("ruta") ||
    t.includes("navigacija") ||
    t.includes("put") ||
    t.includes("maps") ||
    t.includes("google maps") ||
    t.includes("vozi") ||
    t.includes("odvedi") ||
    t.includes("navigate");

  const wantsWeather = t.includes("vrijeme") || t.includes("weather") || t.includes("prognoz");
  const wantsTraffic = t.includes("promet") || t.includes("traffic") || t.includes("gužv") || t.includes("guzv");

  const hasGuests = /\b(\d{1,2})\b/.test(t) || /\b(osob|ljud|odrasl|djece|djeca)\b/i.test(t);

  return {
    accommodation,
    wantsNavigation,
    wantsWeather,
    wantsTraffic,
    hasGuests,
  };
}

/**
 * Parse number of guests from free text.
 */
function parseGuests(text) {
  const t = normalize(text);

  // Croatian-ish word numbers
  const wordMap = {
    jedno: 1,
    jedne: 1,
    jedan: 1,
    jedna: 1,
    dvoje: 2,
    dvije: 2,
    dva: 2,
    troje: 3,
    tri: 3,
    cetvero: 4,
    četiri: 4,
    cetiri: 4,
    četiri: 4,
    četvero: 4,
    pet: 5,
    petero: 5,
    sest: 6,
    sestero: 6,
    sedam: 7,
    osam: 8,
    devet: 9,
    deset: 10,
  };
  for (const [w, n] of Object.entries(wordMap)) {
    if (t.includes(normalize(w))) return n;
  }

  // Numeric patterns
  // "za 2", "2 osobe", "2 odraslih"
  const m = t.match(/\b(\d{1,2})\b/);
  if (m?.[1]) {
    const n = parseInt(m[1], 10);
    if (!Number.isNaN(n) && n >= 1 && n <= 30) return n;
  }
  return null;
}

/**
 * Date parsing: accepts "16.12" or "16.12.2025" => YYYY-MM-DD
 */
function parseDateHR(token) {
  const t = normalize(token);
  const m = t.match(/\b(\d{1,2})\.(\d{1,2})(?:\.(\d{4}))?\b/);
  if (!m) return null;
  const day = parseInt(m[1], 10);
  const mon = parseInt(m[2], 10);
  const year = m[3] ? parseInt(m[3], 10) : new Date().getFullYear();
  if (!day || !mon || mon < 1 || mon > 12 || day < 1 || day > 31) return null;
  const pad = (n) => String(n).padStart(2, "0");
  return `${year}-${pad(mon)}-${pad(day)}`;
}

/**
 * Extract checkin/checkout if user said 2 dates.
 */
function extractDates(text) {
  const t = normalize(text);

  // "od 16.12 do 18.12"
  const m = t.match(/od\s+(\d{1,2}\.\d{1,2}(?:\.\d{4})?)\s+do\s+(\d{1,2}\.\d{1,2}(?:\.\d{4})?)/i);
  if (m?.[1] && m?.[2]) {
    const a = parseDateHR(m[1]);
    const b = parseDateHR(m[2]);
    return { checkin: a, checkout: b };
  }

  const all = [...t.matchAll(/(\d{1,2}\.\d{1,2}(?:\.\d{4})?)/g)].map((x) => x[1]);
  if (all.length >= 2) {
    return { checkin: parseDateHR(all[0]), checkout: parseDateHR(all[1]) };
  }

  return { checkin: null, checkout: null };
}

/**
 * Extract place type preference (hotel/apartment/etc).
 */
function detectPlaceType(text) {
  const t = normalize(text);
  for (const p of PLACE_TYPE) {
    if (p.re.test(t)) return p.label;
  }
  return null;
}

/**
 * City extraction (WORLDWIDE):
 * - Looks for patterns like:
 *    "smještaj u Parizu", "booking Tokio", "hotel u New Yorku"
 * - Avoids NOT_A_CITY_WORDS.
 * - Supports multi-word cities (2-4 tokens) like "New York", "Karlovy Vary", "Los Angeles"
 * - If city isn't in our list: we still accept it as a city (free text).
 */
function detectCity(text) {
  const raw = collapseSpaces(text || "");
  if (!raw) return null;

  // Work with normalized+punct stripped versions for matching, but return title-case of captured.
  const norm = normalize(raw);
  const cleaned = collapseSpaces(stripPunct(norm));

  // Quick reject: if user only said accommodation type
  if (cleaned.length <= 2) return null;

  // Try capturing after common patterns (Croatian/English):
  // u/na/za/kod/in/to/into
  const patterns = [
    /\bu\s+([a-z0-9\-]+(?:\s+[a-z0-9\-]+){0,3})\b/i, // "u parizu" "u new yorku"
    /\bna\s+([a-z0-9\-]+(?:\s+[a-z0-9\-]+){0,3})\b/i,
    /\bza\s+([a-z0-9\-]+(?:\s+[a-z0-9\-]+){0,3})\b/i, // "za paris"
    /\bkod\s+([a-z0-9\-]+(?:\s+[a-z0-9\-]+){0,3})\b/i,
    /\bin\s+([a-z0-9\-]+(?:\s+[a-z0-9\-]+){0,3})\b/i,
    /\bto\s+([a-z0-9\-]+(?:\s+[a-z0-9\-]+){0,3})\b/i,
    /\binto\s+([a-z0-9\-]+(?:\s+[a-z0-9\-]+){0,3})\b/i,
  ];

  // Helper to validate captured chunk
  const isValidCityChunk = (chunk) => {
    const c = collapseSpaces(chunk || "");
    if (!c) return false;

    const parts = c.split(" ").filter(Boolean);
    if (!parts.length) return false;

    for (const p of parts) {
      const pn = normalize(p);
      if (NOT_A_CITY_WORDS.has(pn)) return false;
    }

    const cn = normalize(c);
    if (ACCOMMODATION_KW.some((k) => cn.startsWith(normalize(k) + " "))) return false;

    if (parts.length === 1 && parts[0].length <= 2) return false;

    return true;
  };

  // 1) If text contains an explicit city after preposition, use it.
  for (const re of patterns) {
    const m = cleaned.match(re);
    if (m?.[1]) {
      let chunk = m[1];

      chunk = chunk
        .split(/\b(osob|osobe|odrasl|djece|djeca|od|do|za|from|to|checkin|checkout|datumi|dates)\b/i)[0]
        .trim();

      chunk = collapseSpaces(chunk);

      if (isValidCityChunk(chunk)) return titleCase(chunk);
    }
  }

  // 2) "booking Paris" / "smjestaj Tokio" without preposition
  const withoutKw = cleaned
    .replace(/\b(smjestaj|smjestaj|booking|airbnb|hotel|hotelu|apartman|apartmanu|rezervacija|rezerviraj|book|accommodation|stay|room|rooms)\b/gi, " ")
    .replace(/\b(u|na|za|kod|in|to|into)\b/gi, " ")
    .replace(/\s+/g, " ")
    .trim();

  if (withoutKw) {
    const parts = withoutKw.split(" ").filter(Boolean);
    if (parts.length) {
      const candidate = parts.slice(0, 4).join(" ");
      if (isValidCityChunk(candidate)) return titleCase(candidate);
    }
  }

  // 3) User typed just a city
  const justText = cleaned;
  if (justText && justText.length <= 40) {
    const parts = justText.split(" ").filter(Boolean);
    if (parts.length >= 1 && parts.length <= 4) {
      const candidate = parts.join(" ");
      if (isValidCityChunk(candidate)) return titleCase(candidate);
    }
  }

  return null;
}

/* ----------------------------- BOOKING URL ----------------------------- */

function buildBookingUrl({ city, guests, checkin, checkout, lang = DEFAULT_LANG }) {
  const safeCity = collapseSpaces(city || DEFAULT_CITY) || DEFAULT_CITY;
  const base = `https://www.booking.com/searchresults.${lang}.html`;
  const params = new URLSearchParams();

  params.set("ss", safeCity);
  params.set("ssne", safeCity);
  params.set("ssne_untouched", safeCity);

  if (guests && Number.isFinite(guests)) {
    params.set("group_adults", String(Math.max(1, guests)));
    params.set("group_children", "0");
    params.set("no_rooms", "1");
  }

  if (checkin) params.set("checkin", checkin);
  if (checkout) params.set("checkout", checkout);

  return `${base}?${params.toString()}`;
}

/* ----------------------------- UI COMPONENTS ----------------------------- */

function Chip({ children }) {
  return (
    <span
      style={{
        display: "inline-flex",
        alignItems: "center",
        gap: 8,
        padding: "7px 12px",
        borderRadius: 999,
        background: "rgba(255,255,255,0.06)",
        border: "1px solid rgba(255,255,255,0.10)",
        fontSize: 12,
        color: "rgba(255,255,255,0.88)",
        userSelect: "none",
      }}
    >
      {children}
    </span>
  );
}

function Card({ title, children }) {
  return (
    <div
      style={{
        background: "rgba(255,255,255,0.06)",
        border: "1px solid rgba(255,255,255,0.10)",
        borderRadius: 20,
        padding: 16,
        boxShadow: "0 18px 50px rgba(0,0,0,0.38)",
        backdropFilter: "blur(10px)",
      }}
    >
      {title ? (
        <div style={{ fontSize: 14, fontWeight: 800, color: "rgba(255,255,255,0.92)", marginBottom: 12 }}>
          {title}
        </div>
      ) : null}
      {children}
    </div>
  );
}

function Hr() {
  return <div style={{ height: 1, background: "rgba(255,255,255,0.08)", margin: "12px 0" }} />;
}

function Modal({ open, title, onClose, children }) {
  if (!open) return null;
  return (
    <div
      role="dialog"
      aria-modal="true"
      onClick={onClose}
      style={{
        position: "fixed",
        inset: 0,
        zIndex: 99999,
        background: "rgba(0,0,0,0.62)",
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
        padding: 16,
      }}
    >
      <div
        onClick={(e) => e.stopPropagation()}
        style={{
          width: "min(560px, 100%)",
          borderRadius: 20,
          background: "rgba(10,12,18,0.96)",
          border: "1px solid rgba(255,255,255,0.12)",
          boxShadow: "0 26px 80px rgba(0,0,0,0.6)",
          overflow: "hidden",
        }}
      >
        <div
          style={{
            padding: 14,
            display: "flex",
            alignItems: "center",
            justifyContent: "space-between",
            gap: 12,
            borderBottom: "1px solid rgba(255,255,255,0.08)",
          }}
        >
          <div style={{ fontWeight: 900, color: "rgba(255,255,255,0.92)" }}>{title}</div>
          <button
            onClick={onClose}
            style={{
              width: 38,
              height: 38,
              borderRadius: 12,
              border: "1px solid rgba(255,255,255,0.12)",
              background: "rgba(255,255,255,0.06)",
              color: "rgba(255,255,255,0.92)",
              cursor: "pointer",
              fontWeight: 900,
            }}
          >
            ✕
          </button>
        </div>
        <div style={{ padding: 14 }}>{children}</div>
      </div>
    </div>
  );
}

function Button({ children, onClick, variant = "primary", style = {}, disabled = false }) {
  const base = {
    padding: "12px 14px",
    borderRadius: 14,
    border: "1px solid rgba(255,255,255,0.12)",
    cursor: disabled ? "not-allowed" : "pointer",
    fontWeight: 900,
    letterSpacing: 0.4,
    userSelect: "none",
    opacity: disabled ? 0.6 : 1,
  };

  const v =
    variant === "primary"
      ? { background: "rgba(46, 204, 113, 0.18)" }
      : variant === "ghost"
      ? { background: "rgba(255,255,255,0.06)" }
      : variant === "danger"
      ? { background: "rgba(231, 76, 60, 0.18)" }
      : { background: "rgba(255,255,255,0.06)" };

  return (
    <button onClick={disabled ? undefined : onClick} style={{ ...base, ...v, ...style }}>
      {children}
    </button>
  );
}

/* ----------------------------- APP ----------------------------- */

export default function App() {
  const [typed, setTyped] = useState("");
  const [log, setLog] = useState([]); // {role:'user'|'assistant', text, ts}
  const [status, setStatus] = useState("Spremno");
  const [micOn, setMicOn] = useState(false);
  const [lastHeard, setLastHeard] = useState("");

  const [ctx, setCtx] = useState({
    city: DEFAULT_CITY,
    guests: null,
    checkin: null,
    checkout: null,
    placeType: null,
    lastIntent: null,
    awaiting: null,
    bookingOpenedForKey: null,
  });

  const [bookingModalOpen, setBookingModalOpen] = useState(false);
  const [bookingRecap, setBookingRecap] = useState({
    said: "",
    city: DEFAULT_CITY,
    guests: null,
    checkin: null,
    checkout: null,
    placeType: null,
    url: "",
  });

  const recogRef = useRef(null);
  const shouldListenRef = useRef(false);
  const speakingRef = useRef(false);
  const finalFlushTimerRef = useRef(null);
  const restartTimerRef = useRef(null);
  const lastFinalRef = useRef({ text: "", ts: 0 });

  const SpeechRecognition = useMemo(() => {
    if (typeof window === "undefined") return null;
    return window.SpeechRecognition || window.webkitSpeechRecognition || null;
  }, []);

  const canVoice = !!SpeechRecognition;
  const canTTS = typeof window !== "undefined" && "speechSynthesis" in window;

  const pushLog = (role, text) => {
    setLog((prev) => [...prev, { role, text, ts: Date.now() }]);
  };

  const speak = async (text, { lang = DEFAULT_VOICE_LANG } = {}) => {
    if (!canTTS || !text) return;
    speakingRef.current = true;
    try {
      try {
        recogRef.current?.abort?.();
      } catch {}

      const u = new SpeechSynthesisUtterance(text);
      u.lang = lang;
      u.rate = 1.0;
      u.pitch = 1.0;
      u.volume = 1.0;

      setStatus("🔊 Govorim...");
      await new Promise((resolve) => {
        u.onend = resolve;
        u.onerror = resolve;
        window.speechSynthesis.cancel();
        window.speechSynthesis.speak(u);
      });
    } finally {
      speakingRef.current = false;
      setStatus(micOn ? "🎤 Slušam..." : "Spremno");
      if (shouldListenRef.current) startRecognitionSafe();
    }
  };

  const openBooking = (payload) => {
    const url = buildBookingUrl({
      city: payload.city || DEFAULT_CITY,
      guests: payload.guests ?? null,
      checkin: payload.checkin ?? null,
      checkout: payload.checkout ?? null,
      lang: DEFAULT_LANG,
    });

    setBookingRecap((prev) => ({
      ...prev,
      ...payload,
      url,
    }));

    try {
      window.open(url, "_blank", "noopener,noreferrer");
    } catch {}

    setBookingModalOpen(true);
  };

  const conciergeRecs = (city, placeType) => {
    const c = city || DEFAULT_CITY;
    const p = placeType ? ` (${placeType})` : "";
    return [
      { title: `Top izbor u ${c}${p}`, desc: "Filtriraj po ocjeni 8.5+ i provjeri parking / recepciju." },
      { title: "Sigurnost i mir", desc: "Biraj dobro osvijetljenu lokaciju i provjeri recenzije o buci." },
      { title: "Fleksibilan dolazak", desc: "Ako kasniš, traži 'self check-in' ili 24h recepciju." },
    ];
  };

  const computeNextQuestion = (next) => {
    if (!next.city) return { awaiting: "city", text: "Koji grad? (npr. Karlovac, Pariz, Tokio)" };
    if (!next.guests) return { awaiting: "guests", text: "Koliko osoba?" };
    if (!next.checkin || !next.checkout) return
