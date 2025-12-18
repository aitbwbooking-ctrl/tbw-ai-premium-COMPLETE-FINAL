import React, { useEffect, useMemo, useRef, useState } from "react";

/**
 * TBW AI PREMIUM — App.jsx (FULL • 700+ lines • functional)
 * -------------------------------------------------------------------
 * LOCKED RULES (your command):
 * - One single App.jsx you paste. No extra files. No "add this in App.jsx" instructions.
 * - DO NOT shorten / refactor into smaller versions. Keep full structure.
 * - MIC = continuous conversation (no SEND needed). SEND = manual typing only.
 * - Booking opens automatically on accommodation intent and continues conversation.
 * - City detection works WORLDWIDE (any city), not only hardcoded list.
 * - Must NOT map "Paris/Tokyo/Beograd" to Zagreb.
 * - Booking runs INSIDE TBW modal (iframe) so user can EXIT back without refresh.
 * - Adds SETTINGS (green ring) that opens on first click.
 * - Founder code is hidden: only inside Settings, 3 clicks within 3 seconds unlocks Founder.
 * - Adds Tier UI + prices: Monthly 9.99€ / Yearly 99.99€ + legal notes under tiers.
 * - Adds Alarm/Ticker setting toggle + notification consent + disable anytime.
 * - Keeps English-only disclaimer text where required.
 *
 * Notes:
 * - Web Speech API works best on Chrome/Edge/Android Chrome. iOS Safari is limited.
 * - True background overlay/push on lockscreen requires PWA/Service Worker/native layer;
 *   here we include consent UI + Notification API demo hook.
 */

/* ==============================
   0) SMALL STORAGE HELPERS
   ============================== */

const LS = {
  get(key, fallback = null) {
    try {
      const raw = localStorage.getItem(key);
      if (raw == null) return fallback;
      return JSON.parse(raw);
    } catch {
      return fallback;
    }
  },
  set(key, value) {
    try {
      localStorage.setItem(key, JSON.stringify(value));
    } catch {}
  },
  del(key) {
    try {
      localStorage.removeItem(key);
    } catch {}
  },
};

const nowTs = () => Date.now();
const clamp = (n, a, b) => Math.max(a, Math.min(b, n));
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

/* ==============================
   1) TIERS (TRIAL/DEMO/PREMIUM)
   ============================== */

const TBW_TIER_KEY = "tbw_tier_state_v2";
const TBW_DEVICE_KEY = "tbw_device_id_v2";

function getOrCreateDeviceId() {
  let id = LS.get(TBW_DEVICE_KEY, null);
  if (!id) {
    id = `tbw_${Math.random().toString(16).slice(2)}_${Math.random().toString(16).slice(2)}`;
    LS.set(TBW_DEVICE_KEY, id);
  }
  return id;
}

function initTierState() {
  const existing = LS.get(TBW_TIER_KEY, null);
  if (existing) return existing;

  const startedAt = nowTs();
  const state = {
    deviceId: getOrCreateDeviceId(),
    tier: "TRIAL", // TRIAL -> DEMO -> PREMIUM
    trialStartedAt: startedAt,
    trialEndsAt: startedAt + 3 * 24 * 60 * 60 * 1000, // 3 days
    purchasedAt: null,
    // For demo/premium bookkeeping:
    lastTierCheckAt: startedAt,
    // pseudo purchase options:
    premiumPlan: null, // "monthly" | "yearly"
  };
  LS.set(TBW_TIER_KEY, state);
  return state;
}

function computeTier(state) {
  if (!state) return "TRIAL";
  if (state.tier === "PREMIUM") return "PREMIUM";
  // auto-switch TRIAL -> DEMO after 3 days
  if (state.tier === "TRIAL" && nowTs() > state.trialEndsAt) return "DEMO";
  return state.tier;
}

/* ==============================
   2) TEXT NORMALIZATION / NLP
   ============================== */

const DEFAULT_CITY = "Zagreb";

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
    .replace(/\s+/g, " ")
    .trim();

const collapseSpaces = (s) => (s || "").replace(/\s+/g, " ").trim();

const titleCase = (s) =>
  (s || "")
    .trim()
    .split(/\s+/)
    .filter(Boolean)
    .map((w) => (w ? w[0].toUpperCase() + w.slice(1) : w))
    .join(" ");

const stripPunct = (s) =>
  (s || "")
    .replace(/[!?.,;:()[\]{}<>]/g, " ")
    .replace(/\s+/g, " ")
    .trim();

/** Repeated word compression for SpeechRecognition glitches */
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

function cleanVoiceText(input) {
  let s = collapseSpaces(input || "");
  s = compressRepeatWords(s, 1);
  // remove obvious fillers at edges
  s = s.replace(/^(ono|ovaj|ovako|znaci|pa|mislim)\s+/i, "");
  s = s.replace(/\s+(ono|ovaj|ovako|znaci|pa|mislim)$/i, "");
  return collapseSpaces(s);
}

const ACCOMMODATION_KW = [
  "smjestaj",
  "smještaj",
  "hotel",
  "hotelu",
  "hotela",
  "apartman",
  "apartmanu",
  "apartmani",
  "booking",
  "airbnb",
  "nocenje",
  "nocenja",
  "sobe",
  "rezervacij",
  "rezerviraj",
  "book",
  "accommodation",
  "room",
  "rooms",
  "stay",
];

const NOT_A_CITY_WORDS = new Set(
  [
    // accommodation types & nouns
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
    "noc",
    "grad",
    "mjesto",
    "mjestu",
    "centar",
    "kvart",
    "kvartu",
    // prepositions
    "u",
    "na",
    "za",
    "kod",
    "prema",
    "do",
    "od",
    "iz",
    "in",
    "to",
    "into",
    // common verbs
    "trazim",
    "trebam",
    "hocu",
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
    // time/date words
    "od",
    "do",
    "datumi",
    "dates",
    "checkin",
    "checkout",
    "danas",
    "sutra",
    "jucer",
    "nova",
    "godina",
    "novu",
    "godinu",
    // people words
    "osoba",
    "osobe",
    "ljudi",
    "odrasli",
    "djece",
    "djeca",
    // misc
    "zahtjev",
    "upit",
  ].map(normalize)
);

const PLACE_TYPE_RULES = [
  { label: "hotel", re: /\bhotel(u|a|i|e)?\b/i },
  { label: "apartman", re: /\bapartman(u|a|i|e)?\b/i },
  { label: "hostel", re: /\bhostel(u|a|i|e)?\b/i },
  { label: "soba", re: /\bsob(a|e|u|i)?\b/i },
  { label: "kamp", re: /\bkamp(u|a|i|e)?\b|\bcamp\b/i },
  { label: "vila", re: /\bvil(a|e|u|i)?\b|\bvilla\b/i },
];

function detectPlaceType(text) {
  const t = normalize(text);
  for (const r of PLACE_TYPE_RULES) {
    if (r.re.test(t)) return r.label;
  }
  return null;
}

function detectIntent(text) {
  const t = normalize(text);
  const accommodation = ACCOMMODATION_KW.some((k) => t.includes(normalize(k)));
  const wantsBooking = accommodation || t.includes("rezerv") || t.includes("book");
  const wantsNavigation = t.includes("navig") || t.includes("ruta") || t.includes("odvedi") || t.includes("vozi");
  const wantsHelp = t.includes("pomoc") || t.includes("help");
  return { accommodation, wantsBooking, wantsNavigation, wantsHelp };
}

function parseGuests(text) {
  const t = normalize(text);
  const wordMap = {
    jedan: 1,
    jedna: 1,
    jedno: 1,
    dvoje: 2,
    dvije: 2,
    dva: 2,
    troje: 3,
    tri: 3,
    cetiri: 4,
    "četiri": 4,
    pet: 5,
    sest: 6,
    sedam: 7,
    osam: 8,
    devet: 9,
    deset: 10,
  };
  for (const [w, n] of Object.entries(wordMap)) {
    if (t.includes(normalize(w))) return n;
  }
  const m = t.match(/\b(\d{1,2})\b/);
  if (m?.[1]) {
    const n = parseInt(m[1], 10);
    if (!Number.isNaN(n) && n >= 1 && n <= 30) return n;
  }
  return null;
}

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

function extractDates(text) {
  const t = normalize(text);
  const m = t.match(/od\s+(\d{1,2}\.\d{1,2}(?:\.\d{4})?)\s+do\s+(\d{1,2}\.\d{1,2}(?:\.\d{4})?)/i);
  if (m?.[1] && m?.[2]) {
    const a = parseDateHR(m[1]);
    const b = parseDateHR(m[2]);
    return { checkin: a, checkout: b };
  }
  const all = [...t.matchAll(/(\d{1,2}\.\d{1,2}(?:\.\d{4})?)/g)].map((x) => x[1]);
  if (all.length >= 2) return { checkin: parseDateHR(all[0]), checkout: parseDateHR(all[1]) };
  return { checkin: null, checkout: null };
}

/**
 * WORLDWIDE city detection:
 * - Accepts any city as free text (up to 4 words) after patterns:
 *   "u X", "na X", "za X", "booking X", "smjestaj X", "hotel u X"
 * - Rejects NOT_A_CITY_WORDS, rejects accommodation words.
 * - Does NOT fallback to Zagreb if it clearly found a city.
 * - Prevents "smještaj smještaj smještaj" from becoming a city.
 */
function detectCity(text) {
  const raw = collapseSpaces(text || "");
  if (!raw) return null;

  const norm = normalize(raw);
  const cleaned = collapseSpaces(stripPunct(norm));
  if (!cleaned) return null;

  const isValidChunk = (chunk) => {
    const c = collapseSpaces(chunk || "");
    if (!c) return false;
    const parts = c.split(" ").filter(Boolean);
    if (!parts.length) return false;
    if (parts.length > 4) return false;

    // reject if any token is forbidden
    for (const p of parts) {
      const pn = normalize(p);
      if (!pn) return false;
      if (NOT_A_CITY_WORDS.has(pn)) return false;
      // reject accommodation keywords as cities
      if (ACCOMMODATION_KW.some((k) => pn === normalize(k))) return false;
      // reject 1-2 letter tokens
      if (pn.length <= 2) return false;
      // reject pure numbers
      if (/^\d+$/.test(pn)) return false;
    }

    // reject if chunk is only repeated same word (speech glitch)
    const nParts = parts.map((x) => normalize(x));
    const uniq = new Set(nParts);
    if (uniq.size === 1 && nParts.length >= 2) return false;

    return true;
  };

  const patterns = [
    /\bu\s+([a-z0-9\-]+(?:\s+[a-z0-9\-]+){0,3})\b/i,
    /\bna\s+([a-z0-9\-]+(?:\s+[a-z0-9\-]+){0,3})\b/i,
    /\bza\s+([a-z0-9\-]+(?:\s+[a-z0-9\-]+){0,3})\b/i,
    /\bkod\s+([a-z0-9\-]+(?:\s+[a-z0-9\-]+){0,3})\b/i,
    /\bin\s+([a-z0-9\-]+(?:\s+[a-z0-9\-]+){0,3})\b/i,
    /\bto\s+([a-z0-9\-]+(?:\s+[a-z0-9\-]+){0,3})\b/i,
  ];

  for (const re of patterns) {
    const m = cleaned.match(re);
    if (m?.[1]) {
      let chunk = m[1];

      // cut on known separators/keywords that often follow the city
      chunk = chunk
        .split(/\b(osob|osobe|odrasl|djece|djeca|od|do|datumi|dates|checkin|checkout|za|hotel|apartman|soba|smjestaj|smještaj|booking|airbnb)\b/i)[0]
        .trim();

      chunk = collapseSpaces(chunk);
      if (isValidChunk(chunk)) return titleCase(chunk);
    }
  }

  // "booking Paris" / "smjestaj Tokio" without preposition
  // remove intent keywords, keep remaining first 1-4 words as candidate
  const withoutKw = cleaned
    .replace(
      /\b(smjestaj|smještaj|booking|airbnb|hotel|hotelu|hotela|apartman|apartmanu|soba|rezervacija|rezerviraj|book|accommodation|stay|room|rooms)\b/gi,
      " "
    )
    .replace(/\b(u|na|za|kod|in|to|into)\b/gi, " ")
    .replace(/\s+/g, " ")
    .trim();

  if (withoutKw) {
    const parts = withoutKw.split(" ").filter(Boolean);
    if (parts.length) {
      const candidate = parts.slice(0, 4).join(" ");
      if (isValidChunk(candidate)) return titleCase(candidate);
    }
  }

  // If whole input itself looks like a city (1-4 words) and not an intent sentence
  const wholeParts = cleaned.split(" ").filter(Boolean);
  if (wholeParts.length >= 1 && wholeParts.length <= 4) {
    const candidate = wholeParts.join(" ");
    if (isValidChunk(candidate)) return titleCase(candidate);
  }

  return null;
}

/* ==============================
   3) BOOKING URL + AFFILIATE LOGIC
   ============================== */

const AFFILIATE = {
  bookingAid: "", // keep empty until contracts
  airbnbAid: "",
};

function buildBookingUrl({ city, guests, checkin, checkout, lang = "hr" }) {
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

  // Affiliate (kept empty)
  if (AFFILIATE.bookingAid) params.set("aid", AFFILIATE.bookingAid);

  return `${base}?${params.toString()}`;
}

/* ==============================
   4) UI ATOMS
   ============================== */

function Chip({ children, tone = "neutral" }) {
  const bg =
    tone === "good"
      ? "rgba(46, 204, 113, 0.18)"
      : tone === "warn"
      ? "rgba(241, 196, 15, 0.18)"
      : tone === "danger"
      ? "rgba(231, 76, 60, 0.18)"
      : "rgba(255,255,255,0.06)";
  const bd =
    tone === "good"
      ? "rgba(46, 204, 113, 0.35)"
      : tone === "warn"
      ? "rgba(241, 196, 15, 0.35)"
      : tone === "danger"
      ? "rgba(231, 76, 60, 0.35)"
      : "rgba(255,255,255,0.10)";

  return (
    <span
      style={{
        display: "inline-flex",
        alignItems: "center",
        gap: 8,
        padding: "7px 12px",
        borderRadius: 999,
        background: bg,
        border: `1px solid ${bd}`,
        fontSize: 12,
        color: "rgba(255,255,255,0.90)",
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
        <div style={{ fontSize: 14, fontWeight: 900, color: "rgba(255,255,255,0.92)", marginBottom: 12 }}>
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

function Button({ children, onClick, variant = "ghost", disabled = false, style = {}, title }) {
  const base = {
    padding: "12px 14px",
    borderRadius: 14,
    border: "1px solid rgba(255,255,255,0.12)",
    cursor: disabled ? "not-allowed" : "pointer",
    fontWeight: 900,
    letterSpacing: 0.4,
    userSelect: "none",
    opacity: disabled ? 0.6 : 1,
    color: "rgba(255,255,255,0.92)",
  };
  const bg =
    variant === "primary"
      ? "rgba(46, 204, 113, 0.18)"
      : variant === "warn"
      ? "rgba(241, 196, 15, 0.18)"
      : variant === "danger"
      ? "rgba(231, 76, 60, 0.18)"
      : "rgba(255,255,255,0.06)";
  const bd =
    variant === "primary"
      ? "rgba(46, 204, 113, 0.35)"
      : variant === "warn"
      ? "rgba(241, 196, 15, 0.35)"
      : variant === "danger"
      ? "rgba(231, 76, 60, 0.35)"
      : "rgba(255,255,255,0.12)";

  return (
    <button
      title={title}
      onClick={disabled ? undefined : onClick}
      style={{ ...base, background: bg, border: `1px solid ${bd}`, ...style }}
    >
      {children}
    </button>
  );
}

function Modal({ open, title, onClose, children, width = 760 }) {
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
          width: `min(${width}px, 100%)`,
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
          <div style={{ fontWeight: 950, color: "rgba(255,255,255,0.92)" }}>{title}</div>
          <button
            onClick={onClose}
            style={{
              width: 40,
              height: 40,
              borderRadius: 12,
              border: "1px solid rgba(255,255,255,0.12)",
              background: "rgba(255,255,255,0.06)",
              color: "rgba(255,255,255,0.92)",
              cursor: "pointer",
              fontWeight: 950,
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

function Ticker({ text, tone = "warn" }) {
  const dot =
    tone === "danger"
      ? "rgba(231, 76, 60, 0.9)"
      : tone === "good"
      ? "rgba(46,204,113,0.9)"
      : "rgba(241,196,15,0.9)";
  const bg =
    tone === "danger"
      ? "rgba(231, 76, 60, 0.10)"
      : tone === "good"
      ? "rgba(46,204,113,0.10)"
      : "rgba(241,196,15,0.10)";
  return (
    <div
      style={{
        width: "100%",
        borderRadius: 14,
        border: "1px solid rgba(255,255,255,0.10)",
        background: bg,
        overflow: "hidden",
        position: "relative",
      }}
    >
      <div style={{ display: "flex", alignItems: "center", gap: 10, padding: "8px 10px" }}>
        <span style={{ width: 10, height: 10, borderRadius: 999, background: dot, boxShadow: `0 0 10px ${dot}` }} />
        <div style={{ fontWeight: 950, fontSize: 12, letterSpacing: 1.2, opacity: 0.92 }}>LIVE</div>
        <div style={{ flex: 1, minWidth: 0, overflow: "hidden" }}>
          <div
            style={{
              display: "inline-block",
              whiteSpace: "nowrap",
              animation: "tbwMarquee 18s linear infinite",
              fontSize: 12,
              opacity: 0.92,
            }}
          >
            {text}
            <span style={{ padding: "0 24px", opacity: 0.5 }}>•</span>
            {text}
          </div>
        </div>
      </div>
      <style>{`
        @keyframes tbwMarquee {
          0% { transform: translateX(0); }
          100% { transform: translateX(-50%); }
        }
      `}</style>
    </div>
  );
}

/* ==============================
   5) INTRO + TERMS + PERMISSIONS GATE
   ============================== */

function useGateState() {
  const key = "tbw_gate_v2";
  const [gate, setGate] = useState(() =>
    LS.get(key, {
      introDone: false,
      termsAccepted: false,
      robotOk: false,
      permsOk: false,
      notifConsent: "unset", // unset/accepted/declined
    })
  );

  useEffect(() => {
    LS.set(key, gate);
  }, [gate]);

  return [gate, setGate];
}

async function requestGeo() {
  if (!("geolocation" in navigator)) return { ok: false, reason: "no_geolocation" };
  return new Promise((resolve) => {
    navigator.geolocation.getCurrentPosition(
      (pos) => resolve({ ok: true, pos }),
      (err) => resolve({ ok: false, reason: err?.message || "geo_error" }),
      { enableHighAccuracy: true, timeout: 12000, maximumAge: 0 }
    );
  });
}

async function requestMic() {
  try {
    cons
