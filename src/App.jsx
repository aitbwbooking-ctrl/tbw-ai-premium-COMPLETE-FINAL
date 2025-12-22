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
    const s = await navigator.mediaDevices.getUserMedia({ audio: true });
    s.getTracks().forEach((t) => t.stop());
    return { ok: true };
  } catch (e) {
    return { ok: false, reason: e?.message || "mic_denied" };
  }
}

async function requestCamOptional() {
  try {
    const s = await navigator.mediaDevices.getUserMedia({ video: true });
    s.getTracks().forEach((t) => t.stop());
    return { ok: true };
  } catch (e) {
    return { ok: false, reason: e?.message || "cam_denied" };
  }
}

async function requestNotifications() {
  if (!("Notification" in window)) return { ok: false, reason: "no_notification_api" };
  try {
    const p = await Notification.requestPermission();
    return { ok: p === "granted", permission: p };
  } catch (e) {
    return { ok: false, reason: e?.message || "notif_error" };
  }
}

/* ==============================
   6) VOICE (SpeechRecognition) + TTS
   ============================== */

function pickBestVoice(voices, langPrefix = "hr") {
  if (!voices || !voices.length) return null;
  const v = voices.filter((x) => (x.lang || "").toLowerCase().startsWith(langPrefix.toLowerCase()));
  const list = v.length ? v : voices;

  // prefer "Google" / "Natural" / non-male hints if present
  const preferred = list.find((x) => /google|natural/i.test(x.name || "") && !/male/i.test(x.name || ""));
  if (preferred) return preferred;

  const nonMale = list.find((x) => !/male/i.test(x.name || ""));
  return nonMale || list[0] || null;
}

function beepTriple() {
  // three quick beeps
  try {
    const AudioCtx = window.AudioContext || window.webkitAudioContext;
    const ctx = new AudioCtx();
    const makeBeep = (t0) => {
      const o = ctx.createOscillator();
      const g = ctx.createGain();
      o.type = "sine";
      o.frequency.value = 880;
      o.connect(g);
      g.connect(ctx.destination);
      g.gain.setValueAtTime(0.0001, t0);
      g.gain.exponentialRampToValueAtTime(0.15, t0 + 0.01);
      g.gain.exponentialRampToValueAtTime(0.0001, t0 + 0.12);
      o.start(t0);
      o.stop(t0 + 0.13);
    };
    const t = ctx.currentTime + 0.02;
    makeBeep(t);
    makeBeep(t + 0.18);
    makeBeep(t + 0.36);
    setTimeout(() => ctx.close(), 900);
  } catch {}
}

/* ==============================
   7) MAIN APP
   ============================== */

export default function App() {
  // tier
  const [tierState, setTierState] = useState(() => initTierState());
  const tier = useMemo(() => computeTier(tierState), [tierState]);

  // auto update tier state (trial->demo)
  useEffect(() => {
    const computed = computeTier(tierState);
    if (computed !== tierState.tier) {
      const updated = { ...tierState, tier: computed, lastTierCheckAt: nowTs() };
      setTierState(updated);
      LS.set(TBW_TIER_KEY, updated);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // gates
  const [gate, setGate] = useGateState();

  // UI states
  const [typed, setTyped] = useState("");
  const [status, setStatus] = useState("Spremno.");
  const [micOn, setMicOn] = useState(false);
  const [lastHeard, setLastHeard] = useState("");
  const [log, setLog] = useState([]); // {role:'user'|'assistant', text, ts}

  // context memory
  const [ctx, setCtx] = useState({
    city: DEFAULT_CITY,
    guests: null,
    checkin: null,
    checkout: null,
    placeType: null,
    lastIntent: null, // "booking" | "navigation" | etc
    awaiting: null, // "city" | "guests" | "dates" | "type"
  });

  // booking modal
  const [bookingOpen, setBookingOpen] = useState(false);
  const [bookingUrl, setBookingUrl] = useState("");
  const [bookingSummary, setBookingSummary] = useState({
    said: "",
    city: DEFAULT_CITY,
    guests: null,
    checkin: null,
    checkout: null,
    placeType: null,
  });

  // settings modal + founder lock
  const [settingsOpen, setSettingsOpen] = useState(false);
  const [founderUnlocked, setFounderUnlocked] = useState(() => LS.get("tbw_founder_unlocked_v1", false));
  useEffect(() => LS.set("tbw_founder_unlocked_v1", founderUnlocked), [founderUnlocked]);

  // founder click detector: 3 clicks within 3 seconds INSIDE SETTINGS
  const founderClicksRef = useRef([]);
  const registerFounderClick = () => {
    const now = Date.now();
    const arr = (founderClicksRef.current || []).filter((t) => now - t <= 3000);
    arr.push(now);
    founderClicksRef.current = arr;
    if (arr.length >= 3) {
      // unlock silently
      setFounderUnlocked(true);
      founderClicksRef.current = [];
      // no toast, no text – silent unlock
      try {
        beepTriple();
      } catch {}
    }
  };

  // alarm consent (state-level)
  const [alarmEnabled, setAlarmEnabled] = useState(() => LS.get("tbw_alarm_enabled_v2", false));
  useEffect(() => LS.set("tbw_alarm_enabled_v2", alarmEnabled), [alarmEnabled]);

  // speech refs
  const SpeechRecognition = useMemo(() => {
    if (typeof window === "undefined") return null;
    return window.SpeechRecognition || window.webkitSpeechRecognition || null;
  }, []);
  const canVoice = !!SpeechRecognition;
  const canTTS = typeof window !== "undefined" && "speechSynthesis" in window;

  const recogRef = useRef(null);
  const shouldListenRef = useRef(false);
  const speakingRef = useRef(false);

  const finalFlushTimerRef = useRef(null);
  const restartTimerRef = useRef(null);
  const lastFinalRef = useRef({ text: "", ts: 0 });

  // voices
  const [voices, setVoices] = useState([]);
  useEffect(() => {
    if (!canTTS) return;
    const load = () => {
      try {
        const v = window.speechSynthesis.getVoices();
        if (v && v.length) setVoices(v);
      } catch {}
    };
    load();
    const id = setInterval(load, 700);
    setTimeout(() => clearInterval(id), 5200);
    return () => clearInterval(id);
  }, [canTTS]);

  const tbwVoice = useMemo(() => pickBestVoice(voices, "hr"), [voices]);

  const pushLog = (role, text) => {
    setLog((prev) => [...prev, { role, text, ts: Date.now() }]);
  };

  /* ---------- TTS ---------- */
  const speak = async (text) => {
    if (!canTTS || !text) return;
    speakingRef.current = true;

    try {
      // avoid feedback loop
      try {
        recogRef.current?.abort?.();
      } catch {}

      const u = new SpeechSynthesisUtterance(text);
      u.lang = "hr-HR";
      u.rate = 1.0;
      // Softer/less robotic:
      u.pitch = 1.12;
      u.volume = 1.0;

      if (tbwVoice) u.voice = tbwVoice;

      setStatus("🔊 Govorim...");
      await new Promise((resolve) => {
        u.onend = resolve;
        u.onerror = resolve;
        window.speechSynthesis.cancel();
        window.speechSynthesis.speak(u);
      });
    } finally {
      speakingRef.current = false;
      setStatus(micOn ? "🎤 Slušam..." : "Spremno.");
      if (shouldListenRef.current) startRecognitionSafe();
    }
  };

  /* ---------- Booking concierge logic ---------- */

  const conciergeRecs = (city, placeType) => {
    const c = city || DEFAULT_CITY;
    const t = placeType ? ` (${placeType})` : "";
    return [
      { title: `Top izbor u ${c}${t}`, desc: "Filtriraj po ocjeni 8.5+ i provjeri parking / recepciju." },
      { title: "Sigurnost i mir", desc: "Biraj dobro osvijetljenu lokaciju i provjeri recenzije o buci." },
      { title: "Fleksibilan dolazak", desc: "Ako kasniš, traži self check-in ili 24h recepciju." },
    ];
  };

  const computeNextQuestion = (next) => {
    if (!next.city) return { awaiting: "city", text: "Koji grad? (npr. Karlovac, Pariz, Tokio)" };
    if (!next.guests) return { awaiting: "guests", text: "Koliko osoba?" };
    if (!next.checkin || !next.checkout) return { awaiting: "dates", text: "Koji su datumi? (npr. od 16.12 do 18.12)" };
    if (!next.placeType) return { awaiting: "type", text: "Želiš hotel ili apartman?" };
    return { awaiting: null, text: "OK. Želiš još filtriranje (cijena, parking, ocjena)?" };
  };

  const openBookingInApp = (nextCtx, saidText) => {
    const url = buildBookingUrl({
      city: nextCtx.city || DEFAULT_CITY,
      guests: nextCtx.guests,
      checkin: nextCtx.checkin,
      checkout: nextCtx.checkout,
      lang: "hr",
    });

    setBookingSummary({
      said: saidText || "",
      city: nextCtx.city || DEFAULT_CITY,
      guests: nextCtx.guests,
      checkin: nextCtx.checkin,
      checkout: nextCtx.checkout,
      placeType: nextCtx.placeType,
    });
    setBookingUrl(url);
    setBookingOpen(true);
  };

  /* ---------- Central handler (TEXT + VOICE) ---------- */

  const handleUserText = async (raw, { fromVoice = false } = {}) => {
    const input = collapseSpaces(raw || "");
    if (!input) return;

    const text = fromVoice ? cleanVoiceText(input) : input;
    if (!text) return;

    // prevent "phantom repeats" in log
    const normText = normalize(text);
    const lastMsg = log.length ? log[log.length - 1] : null;
    if (lastMsg && lastMsg.role === "user" && normalize(lastMsg.text) === normText) {
      // ignore duplicate (speech glitch)
      return;
    }

    pushLog("user", text);
    setLastHeard(text);

    const intent = detectIntent(text);
    const detectedCity = detectCity(text); // worldwide
    const detectedGuests = parseGuests(text);
    const dates = extractDates(text);
    const detectedType = detectPlaceType(text);

    let next = { ...ctx };

    // update context (IMPORTANT: don't overwrite city with garbage)
    if (detectedCity) next.city = detectedCity;
    if (detectedGuests) next.guests = detectedGuests;
    if (dates.checkin) next.checkin = dates.checkin;
    if (dates.checkout) next.checkout = dates.checkout;
    if (detectedType) next.placeType = detectedType;

    // booking flow
    const bookingIntent = intent.accommodation || intent.wantsBooking || next.lastIntent === "booking";
    if (bookingIntent) next.lastIntent = "booking";

    setCtx(next);

    if (bookingIntent) {
      // if no valid city found, ask for it (but DO NOT force Zagreb if user clearly said a city)
      if (!next.city) {
        const msg = "Razumijem. Samo reci grad (npr. Karlovac, Pariz, Tokio) pa otvaram booking.";
        pushLog("assistant", msg);
        await speak(msg);
        setCtx((p) => ({ ...p, awaiting: "city" }));
        return;
      }

      // open booking inside TBW (exit available)
      openBookingInApp(next, text);

      // continue conversation (ask missing info)
      const q = computeNextQuestion(next);
      setCtx((p) => ({ ...p, awaiting: q.awaiting }));

      let msg = `U redu. Otvaram Booking za ${next.city}.`;
      if (next.guests) msg += ` ${next.guests} ${next.guests === 1 ? "osoba" : "osobe"}.`;
      if (next.checkin && next.checkout) msg += ` Datumi: ${next.checkin} → ${next.checkout}.`;
      if (next.placeType) msg += ` Tip: ${next.placeType}.`;
      if (q.text) msg += ` ${q.text}`;

      pushLog("assistant", msg);
      await speak(msg);
      return;
    }

    // default response (no spam repeating)
    const msg = `Reci: "smještaj u ${ctx.city || DEFAULT_CITY}" ili "booking Pariz za 2 osobe".`;
    pushLog("assistant", msg);
    await speak(msg);
  };

  /* ---------- SpeechRecognition ---------- */

  const startRecognitionSafe = () => {
    if (!canVoice) {
      setStatus("⚠️ Voice nije podržan u ovom pregledniku.");
      return;
    }
    if (speakingRef.current) return;

    if (restartTimerRef.current) {
      clearTimeout(restartTimerRef.current);
      restartTimerRef.current = null;
    }
    if (finalFlushTimerRef.current) {
      clearTimeout(finalFlushTimerRef.current);
      finalFlushTimerRef.current = null;
    }

    if (!recogRef.current) {
      const r = new SpeechRecognition();
      r.lang = "hr-HR";
      r.continuous = true;
      r.interimResults = true;
      r.maxAlternatives = 1;

      let finalBuffer = "";

      r.onstart = () => setStatus("🎤 Slušam...");

      r.onresult = (event) => {
        if (!event?.results) return;

        let interim = "";
        let final = "";

        for (let i = event.resultIndex; i < event.results.length; i++) {
          const res = event.results[i];
          const txt = (res[0]?.transcript || "").trim();
          if (!txt) continue;
          if (res.isFinal) final += (final ? " " : "") + txt;
          else interim += (interim ? " " : "") + txt;
        }

        if (interim) setStatus(`🎤 ${compressRepeatWords(interim, 1)}`);

        if (final) {
          finalBuffer = collapseSpaces((finalBuffer ? finalBuffer + " " : "") + final);
          const cleaned = cleanVoiceText(finalBuffer);
          setLastHeard(cleaned);

          if (finalFlushTimerRef.current) clearTimeout(finalFlushTimerRef.current);
          finalFlushTimerRef.current = setTimeout(() => {
            const utter = cleanVoiceText(finalBuffer);
            finalBuffer = "";

            const now = Date.now();
            const prev = lastFinalRef.current;
            // dedupe (avoid loops)
            if (utter && (utter !== prev.text || now - prev.ts > 2200)) {
              lastFinalRef.current = { text: utter, ts: now };
              handleUserText(utter, { fromVoice: true });
            }
          }, 520);
        }
      };

      r.onerror = (e) => {
        const err = e?.error || "unknown";
        if (err === "not-allowed" || err === "service-not-allowed") {
          setStatus("⚠️ Mikrofon nije dopušten. Dozvoli mic u Chrome postavkama.");
          shouldListenRef.current = false;
          setMicOn(false);
          return;
        }
        if (err === "no-speech") setStatus("🎤 Slušam...");
        else if (err === "aborted") setStatus(micOn ? "🎤 Slušam..." : "Spremno.");
        else setStatus(`⚠️ Voice: ${err}`);

        if (shouldListenRef.current && !speakingRef.current) {
          restartTimerRef.current = setTimeout(() => {
            try {
              r.start();
            } catch {}
          }, 650);
        }
      };

      r.onend = () => {
        if (shouldListenRef.current && !speakingRef.current) {
          restartTimerRef.current = setTimeout(() => {
            try {
              r.start();
            } catch {}
          }, 450);
        } else {
          setStatus("Spremno.");
        }
      };

      recogRef.current = r;
    }

    try {
      recogRef.current.start();
      setMicOn(true);
    } catch {
      setMicOn(true);
    }
  };

  const stopRecognition = () => {
    shouldListenRef.current = false;
    setMicOn(false);
    setStatus("Spremno.");

    if (restartTimerRef.current) {
      clearTimeout(restartTimerRef.current);
      restartTimerRef.current = null;
    }
    if (finalFlushTimerRef.current) {
      clearTimeout(finalFlushTimerRef.current);
      finalFlushTimerRef.current = null;
    }

    try {
      recogRef.current?.stop?.();
    } catch {}
  };

  const toggleMic = () => {
    if (!micOn) {
      shouldListenRef.current = true;
      startRecognitionSafe();
    } else {
      stopRecognition();
    }
  };

  /* ---------- Initial greeting ---------- */
  useEffect(() => {
    // run intro automatically once so it doesn't hang on blank
    // if intro wasn't done, it will show overlay
    pushLog("assistant", `TBW AI PREMIUM spreman. Reci: "smještaj u Karlovcu" ili "booking Pariz za 2 osobe".`);
    setStatus("Spremno.");
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  /* ---------- Mobile mic resume hint after returning from booking ---------- */
  useEffect(() => {
    const onVis = () => {
      if (document.visibilityState === "visible") {
        if (shouldListenRef.current) {
          // browser may still require a user gesture; we show hint
          setStatus("🎤 Dodirni mic za nastavak (mobile).");
        }
      }
    };
    document.addEventListener("visibilitychange", onVis);
    return () => document.removeEventListener("visibilitychange", onVis);
  }, []);

  /* ==============================
     8) GATE FLOW UI
     ============================== */

  const gateBlocked = !gate.introDone || !gate.termsAccepted || !gate.robotOk || !gate.permsOk;

  const runIntro = async () => {
    // non-skippable simple intro (3.2s)
    setGate((g) => ({ ...g, introDone: false }));
    await sleep(3200);
    setGate((g) => ({ ...g, introDone: true }));
  };

  const runPermissions = async () => {
    setStatus("Tražim dozvole...");
    const geo = await requestGeo();
    const mic = await requestMic();
    await requestCamOptional(); // optional but requested

    const ok = !!geo.ok && !!mic.ok;
    setGate((g) => ({ ...g, permsOk: ok }));

    if (!geo.ok) {
      pushLog("assistant", "TBW ne može raditi bez lokacije. Uključi Location i pokušaj ponovno.");
      await speak("TBW ne može raditi bez lokacije. Uključi lokaciju i pokušaj ponovno.");
    } else if (!mic.ok) {
      pushLog("assistant", "TBW ne može raditi bez mikrofona. Dozvoli mikrofon i pokušaj ponovno.");
      await speak("TBW ne može raditi bez mikrofona. Dozvoli mikrofon i pokušaj ponovno.");
    } else {
      pushLog("assistant", "Dozvole su aktivne. Možeš koristiti TBW.");
      await speak("Dozvole su aktivne. Možeš koristiti TBW.");
      setStatus("Spremno.");
    }
  };

  const askNotifConsent = async (accept) => {
    if (accept) {
      const res = await requestNotifications();
      if (res.ok) {
        setGate((g) => ({ ...g, notifConsent: "accepted" }));
        setAlarmEnabled(true);
        beepTriple();
      } else {
        setGate((g) => ({ ...g, notifConsent: "declined" }));
        setAlarmEnabled(false);
      }
    } else {
      setGate((g) => ({ ...g, notifConsent: "declined" }));
      setAlarmEnabled(false);
    }
  };

  /* ==============================
     9) MAIN UI STYLES
     ============================== */

  const pageStyle = {
    minHeight: "100vh",
    background:
      "radial-gradient(1200px 700px at 18% 10%, rgba(20,255,140,0.12), transparent 60%), radial-gradient(900px 600px at 82% 18%, rgba(60,160,255,0.12), transparent 60%), linear-gradient(180deg, #070A12 0%, #090B13 40%, #05060A 100%)",
    color: "rgba(255,255,255,0.92)",
    fontFamily:
      'ui-sans-serif, system-ui, -apple-system, Segoe UI, Roboto, "Helvetica Neue", Arial, "Noto Sans", "Liberation Sans", sans-serif',
  };

  const fixedTopStyle = {
    position: "sticky",
    top: 0,
    zIndex: 100,
    padding: "12px 14px 10px",
    background: "rgba(5,6,10,0.86)",
    backdropFilter: "blur(10px)",
    borderBottom: "1px solid rgba(255,255,255,0.08)",
  };

  const contentWrapStyle = {
    maxWidth: 980,
    margin: "0 auto",
    padding: "0 14px 90px",
  };

  const headerRow = {
    display: "flex",
    alignItems: "center",
    justifyContent: "space-between",
    gap: 12,
  };

  const brandStyle = { fontWeight: 950, letterSpacing: 1.8, fontSize: 14, opacity: 0.92 };

  const heroStyle = {
    marginTop: 12,
    padding: 18,
    borderRadius: 22,
    border: "1px solid rgba(255,255,255,0.10)",
    background: "linear-gradient(180deg, rgba(255,255,255,0.08), rgba(255,255,255,0.03))",
    boxShadow: "0 20px 60px rgba(0,0,0,0.42)",
    backdropFilter: "blur(10px)",
  };

  const heroTitleStyle = {
    fontSize: 42,
    lineHeight: 1.0,
    letterSpacing: 0.5,
    fontWeight: 950,
    margin: "6px 0 10px",
  };

  const searchRowStyle = {
    display: "grid",
    gridTemplateColumns: "1fr auto auto",
    gap: 10,
    alignItems: "center",
  };

  const inputStyle = {
    width: "100%",
    padding: "12px 12px",
    borderRadius: 14,
    border: "1px solid rgba(255,255,255,0.12)",
    background: "rgba(0,0,0,0.16)",
    color: "rgba(255,255,255,0.92)",
    outline: "none",
    fontSize: 14,
  };

  const dockStyle = {
    position: "fixed",
    left: 0,
    right: 0,
    bottom: 0,
    padding: "10px 14px",
    background: "rgba(5,6,10,0.86)",
    borderTop: "1px solid rgba(255,255,255,0.08)",
    backdropFilter: "blur(10px)",
    zIndex: 120,
  };

  const dockInner = {
    maxWidth: 980,
    margin: "0 auto",
    display: "flex",
    gap: 10,
    alignItems: "center",
    justifyContent: "space-between",
  };

  // Settings icon (green ring)
  const settingsRingStyle = {
    width: 40,
    height: 40,
    borderRadius: 999,
    display: "grid",
    placeItems: "center",
    cursor: "pointer",
    border: "1px solid rgba(46,204,113,0.55)",
    background: "rgba(46,204,113,0.10)",
    boxShadow: "0 0 14px rgba(46,204,113,0.18)",
    userSelect: "none",
    fontWeight: 950,
  };

  /* ==============================
     10) GATE OVERLAY UI
     ============================== */

  const showIntroOverlay = !gate.introDone;
  const showTermsOverlay = gate.introDone && (!gate.termsAccepted || !gate.robotOk);
  const showPermsOverlay = gate.introDone && gate.termsAccepted && gate.robotOk && !gate.permsOk;

  /* ==============================
     11) PAYWALL UI (prices + pay/cancel)
     ============================== */

  const monthlyPrice = "9.99 €";
  const yearlyPrice = "99.99 €";

  const trialNote =
    "NOTE: Trial shows only possibilities and contains free sources.";
  const demoNote =
    "NOTE: Demo runs basic functions + some free sources.";
  const premiumNote =
    "NOTE: Premium subscription (monthly or yearly) enables all functions in real-time and from real sources.";

  const setPlan = (plan) => {
    // Simulated purchase toggle (UI only) until real billing is wired
    const updated = {
      ...tierState,
      tier: "PREMIUM",
      purchasedAt: nowTs(),
      premiumPlan: plan, // monthly/yearly
    };
    setTierState(updated);
    LS.set(TBW_TIER_KEY, updated);
  };

  const cancelPremium = () => {
    // Return to DEMO (keeps deviceId & trial history)
    const updated = {
      ...tierState,
      tier: "DEMO",
      purchasedAt: null,
      premiumPlan: null,
    };
    setTierState(updated);
    LS.set(TBW_TIER_KEY, updated);
  };

  /* ==============================
     12) SETTINGS MODAL CONTENT
     ============================== */

  const openSettings = () => {
    // must open on first click
    setSettingsOpen(true);
  };

  const closeSettings = () => setSettingsOpen(false);

  /* ==============================
     13) MAIN RENDER
     ============================== */

  return (
    <div style={pageStyle}>
      {/* ====== FIXED TOP (Header + Ticker + Hero + Main Search) ====== */}
      <div style={fixedTopStyle}>
        <div style={{ maxWidth: 980, margin: "0 auto" }}>
          <div style={headerRow}>
            <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
              <div style={brandStyle}>TBW AI PREMIUM</div>

              {/* SETTINGS ring (green) - opens on first click */}
              <div
                title="Settings"
                style={settingsRingStyle}
                onClick={openSettings}
              >
                ⚙️
              </div>
            </div>

            <div style={{ display: "flex", gap: 10, alignItems: "center", flexWrap: "wrap", justifyContent: "flex-end" }}>
              {tier === "PREMIUM" ? (
                <Chip tone="good">
                  <span style={{ width: 8, height: 8, borderRadius: 99, background: "rgba(46,204,113,0.95)", boxShadow: "0 0 10px rgba(46,204,113,0.95)" }} />
                  PREMIUM
                </Chip>
              ) : tier === "DEMO" ? (
                <Chip tone="warn">
                  <span style={{ width: 8, height: 8, borderRadius: 99, background: "rgba(241,196,15,0.95)", boxShadow: "0 0 10px rgba(241,196,15,0.95)" }} />
                  DEMO
                </Chip>
              ) : (
                <Chip tone="warn">
                  <span style={{ width: 8, height: 8, borderRadius: 99, background: "rgba(241,196,15,0.95)", boxShadow: "0 0 10px rgba(241,196,15,0.95)" }} />
                  FREE TRIAL (3D)
                </Chip>
              )}

              <Button
                variant="ghost"
                onClick={() => {
                  openBookingInApp(ctx, "Manual booking");
                  speak(`Otvaram Booking za ${ctx.city || DEFAULT_CITY}.`);
                }}
                title="Open booking"
                disabled={gateBlocked}
              >
                BOOKING
              </Button>

              <Button variant="primary" onClick={toggleMic} title="Mic (continuous)" disabled={gateBlocked || !canVoice}>
                {micOn ? "⏹ MIC" : "🎤 MIC"}
              </Button>
            </div>
          </div>

          {/* Ticker */}
          <div style={{ marginTop: 10 }}>
            {alarmEnabled ? (
              <Ticker tone="good" text={`TBW EMERGENCY PULT • Alerts enabled • Location-based alarms active`} />
            ) : (
              <Ticker tone="warn" text={`TBW EMERGENCY PULT • No active emergency alerts • Enable in Settings if you want`} />
            )}
          </div>

          {/* Hero */}
          <div style={heroStyle}>
            <div style={heroTitleStyle}>
              AI Safety
              <br />
              Navigation
            </div>
            <div style={{ fontSize: 14, opacity: 0.8, maxWidth: 620, lineHeight: 1.45 }}>
              Navigation + Booking concierge + safety logic in one flow. Mic = conversation. SEND = typing only.
            </div>

            {/* Tier notes - legal cleanliness */}
            <div style={{ marginTop: 10, display: "grid", gap: 8 }}>
              {tier === "TRIAL" ? (
                <div style={{ fontSize: 12, opacity: 0.78 }}>{trialNote}</div>
              ) : tier === "DEMO" ? (
                <div style={{ fontSize: 12, opacity: 0.78 }}>{demoNote}</div>
              ) : (
                <div style={{ fontSize: 12, opacity: 0.78 }}>{premiumNote}</div>
              )}
            </div>

            <div style={{ marginTop: 12, display: "flex", gap: 10, flexWrap: "wrap" }}>
              <Chip tone="good">📍 City: {ctx.city || DEFAULT_CITY}</Chip>
              <Chip tone={micOn ? "good" : "neutral"}>🎤 {micOn ? "Mic ON" : "Mic OFF"}</Chip>
              <Chip>👥 {ctx.guests ? `${ctx.guests} osobe` : "gosti: ?"}</Chip>
              <Chip>📅 {ctx.checkin && ctx.checkout ? `${ctx.checkin} → ${ctx.checkout}` : "datumi: ?"}</Chip>
              <Chip>🏨 {ctx.placeType || "tip: ?"}</Chip>
            </div>

            {/* Main AI Search (fixed area) */}
            <div style={{ marginTop: 14 }}>
              <Card title="TBW AI Search">
                <div style={searchRowStyle}>
                  <input
                    value={typed}
                    onChange={(e) => setTyped(e.target.value)}
                    placeholder='Upiši (SEND) ili reci (MIC): "smještaj u Parizu", "booking Tokio za 2 osobe"...'
                    style={inputStyle}
                    disabled={gateBlocked}
                    onKeyDown={(e) => {
                      if (e.key === "Enter") {
                        e.preventDefault();
                        if (!typed.trim()) return;
                        const t = typed.trim();
                        setTyped("");
                        handleUserText(t, { fromVoice: false });
                      }
                    }}
                  />

                  <Button
                    variant="ghost"
                    onClick={() => {
                      if (!typed.trim()) return;
                      const t = typed.trim();
                      setTyped("");
                      handleUserText(t, { fromVoice: false });
                    }}
                    disabled={gateBlocked}
                    title="SEND (typing only)"
                    style={{ minWidth: 110, padding: "12px 14px" }}
                  >
                    SEND
                  </Button>

                  <Button
                    variant="primary"
                    onClick={toggleMic}
                    disabled={gateBlocked || !canVoice}
                    title="MIC (continuous conversation)"
                    style={{ minWidth: 110, padding: "12px 14px" }}
                  >
                    {micOn ? "⏹ STOP" : "🎤 TALK"}
                  </Button>
                </div>

                <div style={{ marginTop: 10, fontSize: 13, opacity: 0.92 }}>
                  Status: <b>{status}</b>
                </div>

                <div style={{ marginTop: 8, fontSize: 12, opacity: 0.78 }}>
                  Čuo sam: <b>{lastHeard || "—"}</b>
                  {!canVoice ? " • Voice nije podržan u ovom browseru." : ""}
                </div>

                <Hr />

                <div style={{ fontSize: 12, opacity: 0.75, lineHeight: 1.35 }}>
                  Mobile napomena: ako otvoriš druge tabove/appove, browser može pauzirati mic. Vrati se i dodirni 🎤.
                </div>
              </Card>
            </div>
          </div>
        </div>
      </div>

      {/* ====== SCROLL AREA (below search) ====== */}
      <div style={contentWrapStyle}>
        <div style={{ height: 14 }} />

        <Card title="Conversation">
          <div style={{ display: "flex", flexDirection: "column", gap: 10, maxHeight: 420, overflow: "auto" }}>
            {log.map((m) => (
              <div
                key={m.ts + m.role}
                style={{
                  alignSelf: m.role === "user" ? "flex-end" : "flex-start",
                  maxWidth: "92%",
                  borderRadius: 16,
                  padding: "10px 12px",
                  background: m.role === "user" ? "rgba(46, 204, 113, 0.16)" : "rgba(255,255,255,0.06)",
                  border: "1px solid rgba(255,255,255,0.10)",
                  color: "rgba(255,255,255,0.92)",
                  whiteSpace: "pre-wrap",
                }}
              >
                <div style={{ fontSize: 12, opacity: 0.8, marginBottom: 4 }}>{m.role === "user" ? "TI" : "TBW"}</div>
                <div style={{ fontSize: 14, lineHeight: 1.35 }}>{m.text}</div>
              </div>
            ))}
          </div>
        </Card>

        <div style={{ height: 14 }} />

        <Card title="TBW Emergency Alerts (Consent)">
          <div style={{ fontSize: 13, opacity: 0.86, lineHeight: 1.45 }}>
            State-level alarms (earthquake, fire near you, terrorist attack, etc.) require explicit consent.
            You can disable anytime to keep owner legally protected.
          </div>

          <div style={{ marginTop: 12, display: "flex", gap: 10, flexWrap: "wrap" }}>
            <Chip tone={alarmEnabled ? "good" : "warn"}>ALARM: {alarmEnabled ? "ON" : "OFF"}</Chip>
            <Chip>Consent: {gate.notifConsent}</Chip>
          </div>

          <div style={{ marginTop: 12, display: "flex", gap: 10, flexWrap: "wrap" }}>
            <Button
              variant="primary"
              disabled={gateBlocked}
              onClick={() => askNotifConsent(true)}
              title="Enable alerts (asks notification permission)"
            >
              Enable Alerts
            </Button>
            <Button
              variant="danger"
              disabled={gateBlocked}
              onClick={() => {
                setAlarmEnabled(false);
                setGate((g) => ({ ...g, notifConsent: "declined" }));
              }}
              title="Disable alerts"
            >
              Disable Alerts
            </Button>
            <Button
              variant="ghost"
              disabled={gateBlocked}
              onClick={() => {
                // demo "alarm"
                if (alarmEnabled && "Notification" in window && Notification.permission === "granted") {
                  try {
                    new Notification("TBW ALERT", {
                      body: "DEMO: Earthquake warning near your location. Follow official instructions.",
                    });
                    beepTriple();
                  } catch {
                    beepTriple();
                    alert("DEMO ALERT (Notification blocked by browser UI).");
                  }
                } else {
                  beepTriple();
                  alert("DEMO ALERT (enable notifications for real UI).");
                }
              }}
              title="Demo alert"
            >
              Demo Alert
            </Button>
          </div>
        </Card>

        <div style={{ marginTop: 16, opacity: 0.7, fontSize: 12, lineHeight: 1.4 }}>
          TBW AI PREMIUM is an informational tool. It does not replace official emergency services, professional advice, or certified navigation systems.
          Use at your own discretion.
        </div>
      </div>

      {/* ====== DOCK ====== */}
      <div style={dockStyle}>
        <div style={dockInner}>
          <div style={{ opacity: 0.88, fontWeight: 900 }}>Grad: {ctx.city || DEFAULT_CITY}</div>
          <div style={{ display: "flex", gap: 10, alignItems: "center" }}>
            <Button
              variant="ghost"
              disabled={gateBlocked}
              onClick={() => {
                openBookingInApp(ctx, "Manual booking");
                speak(`Otvaram Booking za ${ctx.city || DEFAULT_CITY}.`);
              }}
            >
              BOOKING
            </Button>
            <Button variant="primary" disabled={gateBlocked || !canVoice} onClick={toggleMic}>
              {micOn ? "⏹ MIC" : "🎤 MIC"}
            </Button>
          </div>
        </div>
      </div>

      {/* =========================
          SETTINGS MODAL (B + C)
         ========================= */}
      <Modal
        open={settingsOpen}
        title="TBW Settings"
        onClose={closeSettings}
        width={820}
      >
        <div style={{ display: "grid", gap: 14 }}>
          {/* Founder hidden click area: click THIS title 3 times in 3 sec */}
          <div
            style={{
              display: "flex",
              justifyContent: "space-between",
              alignItems: "center",
              gap: 12,
            }}
          >
            <div
              onClick={registerFounderClick}
              style={{
                fontWeight: 950,
                letterSpacing: 0.6,
                cursor: "pointer",
                userSelect: "none",
              }}
              title="(hidden)"
            >
              Settings Panel
            </div>
            <Chip tone={alarmEnabled ? "good" : "warn"}>ALARM: {alarmEnabled ? "ON" : "OFF"}</Chip>
          </div>

          <Card title="Emergency ticker & alarms">
            <div style={{ fontSize: 13, opacity: 0.86, lineHeight: 1.45 }}>
              You decide. If disabled, you receive no emergency notifications. You can disable anytime.
            </div>

            <div style={{ marginTop: 12, display: "flex", gap: 10, flexWrap: "wrap" }}>
              <Button
                variant="primary"
                onClick={() => {
                  // enable requires notif consent if not granted
                  if ("Notification" in window && Notification.permission === "granted") {
                    setAlarmEnabled(true);
                    setGate((g) => ({ ...g, notifConsent: "accepted" }));
                    beepTriple();
                    speak("Alarm uključen.");
                  } else {
                    askNotifConsent(true);
                    speak("Tražim dozvolu za notifikacije.");
                  }
                }}
              >
                Enable alarms
              </Button>

              <Button
                variant="danger"
                onClick={() => {
                  setAlarmEnabled(false);
                  setGate((g) => ({ ...g, notifConsent: "declined" }));
                  speak("Alarm isključen.");
                }}
              >
                Disable alarms
              </Button>

              <Button
                variant="ghost"
                onClick={() => {
                  if (alarmEnabled && "Notification" in window && Notification.permission === "granted") {
                    try {
                      new Notification("TBW ALERT", {
                        body: "DEMO: Fire warning near your location (simulated).",
                      });
                      beepTriple();
                    } catch {
                      beepTriple();
                      alert("DEMO ALERT (Notification blocked by browser UI).");
                    }
                  } else {
                    beepTriple();
                    alert("DEMO ALERT (enable notifications for real UI).");
                  }
                }}
              >
                Demo alarm
              </Button>
            </div>
          </Card>

          <Card title="Subscription">
            <div style={{ display: "grid", gap: 10 }}>
              <div style={{ display: "flex", gap: 10, flexWrap: "wrap", alignItems: "center" }}>
                <Chip tone={tier === "PREMIUM" ? "good" : "warn"}>Current: {tier}</Chip>
                {tier === "PREMIUM" && tierState.premiumPlan ? <Chip tone="good">Plan: {tierState.premiumPlan}</Chip> : null}
              </div>

              <div style={{ fontSize: 13, opacity: 0.86, lineHeight: 1.45 }}>
                Monthly: <b>{monthlyPrice}</b> • Yearly: <b>{yearlyPrice}</b>
              </div>

              <div style={{ fontSize: 12, opacity: 0.78, lineHeight: 1.45 }}>
                {tier === "TRIAL" ? trialNote : tier === "DEMO" ? demoNote : premiumNote}
              </div>

              <div style={{ display: "flex", gap: 10, flexWrap: "wrap" }}>
                <Button
                  variant="primary"
                  onClick={() => {
                    setPlan("monthly");
                    speak("Premium mjesečna pretplata aktivirana.");
                  }}
                >
                  Pay Monthly (9.99€)
                </Button>

                <Button
                  variant="primary"
                  onClick={() => {
                    setPlan("yearly");
                    speak("Premium godišnja pretplata aktivirana.");
                  }}
                >
                  Pay Yearly (99.99€)
                </Button>

                <Button
                  variant="danger"
                  disabled={tier !== "PREMIUM"}
                  onClick={() => {
                    cancelPremium();
                    speak("Premium otkazan. Prelazim u Demo.");
                  }}
                >
                  Cancel Premium
                </Button>
              </div>
            </div>
          </Card>

          {/* Founder area (only visible after hidden 3 clicks in 3 sec) */}
          {founderUnlocked ? (
            <Card title="Founder (hidden)">
              <div style={{ fontSize: 13, opacity: 0.86, lineHeight: 1.45 }}>
                Founder mode unlocked.
              </div>
              <div style={{ marginTop: 10, display: "flex", gap: 10, flexWrap: "wrap" }}>
                <Button
                  variant="ghost"
                  onClick={() => {
                    // Example: reset gates for testing
                    setGate((g) => ({ ...g, introDone: true, termsAccepted: true, robotOk: true }));
                    speak("Founder: gates updated.");
                  }}
                >
                  Founder: Skip intro/terms
                </Button>

                <Button
                  variant="danger"
                  onClick={() => {
                    setFounderUnlocked(false);
                    speak("Founder mode zaključan.");
                  }}
                >
                  Lock Founder
                </Button>
              </div>
            </Card>
          ) : null}
        </div>
      </Modal>

      {/* =========================
          BOOKING MODAL (in-app)
         ========================= */}
      <Modal
        open={bookingOpen}
        title="TBW 5★ Booking Concierge"
        onClose={() => {
          setBookingOpen(false);
          setStatus(micOn ? "🎤 Slušam..." : "Spremno.");
          // keep context so user can continue talking immediately
        }}
        width={980}
      >
        <div style={{ display: "flex", flexDirection: "column", gap: 12 }}>
          <div style={{ fontSize: 13, opacity: 0.86 }}>
            Rekao si: <b>{bookingSummary.said || "—"}</b>
          </div>

          <div style={{ display: "flex", gap: 10, flexWrap: "wrap" }}>
            <Chip tone="good">📍 {bookingSummary.city || DEFAULT_CITY}</Chip>
            <Chip>👥 {bookingSummary.guests ?? "?"}</Chip>
            <Chip>
              📅{" "}
              {bookingSummary.checkin && bookingSummary.checkout
                ? `${bookingSummary.checkin} → ${bookingSummary.checkout}`
                : "?"}
            </Chip>
            <Chip>🏨 {bookingSummary.placeType ?? "?"}</Chip>
          </div>

          <Hr />

          <div style={{ fontWeight: 950, opacity: 0.92 }}>Preporuke</div>
          <div style={{ display: "grid", gap: 10 }}>
            {conciergeRecs(bookingSummary.city, bookingSummary.placeType).map((r) => (
              <div
                key={r.title}
                style={{
                  borderRadius: 16,
                  border: "1px solid rgba(255,255,255,0.10)",
                  background: "rgba(255,255,255,0.06)",
                  padding: 12,
                }}
              >
                <div style={{ fontWeight: 950, marginBottom: 4 }}>{r.title}</div>
                <div style={{ opacity: 0.82, fontSize: 13, lineHeight: 1.35 }}>{r.desc}</div>
              </div>
            ))}
          </div>

          <Hr />

          <div style={{ display: "flex", gap: 10, flexWrap: "wrap" }}>
            <Button
              variant="primary"
              onClick={() => {
                // refresh booking url based on current ctx (if user already said guests/dates after opening)
                const url = buildBookingUrl({
                  city: ctx.city || DEFAULT_CITY,
                  guests: ctx.guests,
                  checkin: ctx.checkin,
                  checkout: ctx.checkout,
                  lang: "hr",
                });
                setBookingUrl(url);
                speak("Osvježavam rezultate prema zadnjim informacijama.");
              }}
            >
              Refresh results
            </Button>
            <Button
              variant="ghost"
              onClick={() => {
                setBookingOpen(false);
                speak("Vratio sam te u TBW. Reci dalje što želiš.");
              }}
            >
              EXIT → Back to TBW
            </Button>
          </div>

          {/* In-app iframe so you can exit back without refreshing the whole app */}
          <div
            style={{
              borderRadius: 16,
              overflow: "hidden",
              border: "1px solid rgba(255,255,255,0.12)",
              background: "rgba(0,0,0,0.25)",
              height: "min(70vh, 720px)",
            }}
          >
            {bookingUrl ? (
              <iframe
                title="Booking"
                src={bookingUrl}
                style={{ width: "100%", height: "100%", border: 0 }}
                sandbox="allow-forms allow-same-origin allow-scripts allow-popups allow-top-navigation-by-user-activation"
              />
            ) : (
              <div style={{ padding: 14, opacity: 0.8 }}>Nema URL-a. Reci grad i kriterije pa otvaram.</div>
            )}
          </div>

          <div style={{ fontSize: 12, opacity: 0.72, lineHeight: 1.35 }}>
            Mic radi u TBW. Ako želiš nastaviti razgovor dok je Booking otvoren, ostani u ovoj aplikaciji i koristi 🎤.
          </div>
        </div>
      </Modal>

      {/* =========================
          INTRO OVERLAY
         ========================= */}
      <Modal open={showIntroOverlay} title="TBW AI PREMIUM" onClose={() => {}} width={520}>
        <div style={{ display: "grid", gap: 12, textAlign: "center" }}>
          <div style={{ fontSize: 22, fontWeight: 950, letterSpacing: 1.2 }}>TBW AI PREMIUM</div>
          <div style={{ opacity: 0.82, lineHeight: 1.4 }}>
            Initializing safety systems… <br />
            (non-skippable intro)
          </div>
          <div
            style={{
              height: 8,
              borderRadius: 999,
              border: "1px solid rgba(255,255,255,0.12)",
              overflow: "hidden",
              background: "rgba(255,255,255,0.06)",
            }}
          >
            <div
              style={{
                height: "100%",
                width: "100%",
                background:
                  "linear-gradient(90deg, rgba(46,204,113,0.35), rgba(241,196,15,0.35), rgba(60,160,255,0.35))",
                animation: "tbwLoad 3.2s linear forwards",
              }}
            />
          </div>
          <style>{`@keyframes tbwLoad { 0%{transform:translateX(-100%)} 100%{transform:translateX(0%)} }`}</style>
          <Button
            variant="primary"
            onClick={async () => {
              await runIntro();
            }}
          >
            Start
          </Button>
        </div>
      </Modal>

      {/* =========================
          TERMS + ROBOT OVERLAY
         ========================= */}
      <Modal open={showTermsOverlay} title="Terms & Access" onClose={() => {}} width={680}>
        <div style={{ display: "grid", gap: 12 }}>
          <div style={{ fontSize: 13, opacity: 0.86, lineHeight: 1.45 }}>
            <b>IMPORTANT (English only):</b> TBW AI PREMIUM is an informational tool. It does not replace official emergency services,
            certified navigation systems, or professional advice. The user is responsible for safe operation of any vehicle and compliance with local laws.
          </div>

          <div style={{ display: "grid", gap: 10 }}>
            <label style={{ display: "flex", gap: 10, alignItems: "flex-start", cursor: "pointer" }}>
              <input
                type="checkbox"
                checked={!!gate.termsAccepted}
                onChange={(e) => setGate((g) => ({ ...g, termsAccepted: e.target.checked }))}
              />
              <span style={{ fontSize: 13, opacity: 0.9, lineHeight: 1.35 }}>
                I accept the Terms, Safety Disclaimer, and understand TBW is informational.
              </span>
            </label>

            <label style={{ display: "flex", gap: 10, alignItems: "flex-start", cursor: "pointer" }}>
              <input
                type="checkbox"
                checked={!!gate.robotOk}
                onChange={(e) => setGate((g) => ({ ...g, robotOk: e.target.checked }))}
              />
              <span style={{ fontSize: 13, opacity: 0.9, lineHeight: 1.35 }}>
                I’m not a robot.
              </span>
            </label>
          </div>

          <Hr />

          <div style={{ display: "flex", gap: 10, justifyContent: "flex-end", flexWrap: "wrap" }}>
            <Button
              variant="primary"
              disabled={!gate.termsAccepted || !gate.robotOk}
              onClick={() => {
                speak("U redu. Sljedeći korak su dozvole za lokaciju i mikrofon.");
              }}
            >
              Continue
            </Button>
          </div>
        </div>
      </Modal>

      {/* =========================
          PERMISSIONS OVERLAY
         ========================= */}
      <Modal open={showPermsOverlay} title="Permissions required" onClose={() => {}} width={680}>
        <div style={{ display: "grid", gap: 12 }}>
          <div style={{ fontSize: 13, opacity: 0.86, lineHeight: 1.45 }}>
            TBW Navigation requires: <b>Location</b> + <b>Microphone</b>. Camera is requested for safety scenarios (optional).
            If you disable Location in system settings, TBW must show “Cannot use TBW without location”.
          </div>

          <div style={{ display: "flex", gap: 10, flexWrap: "wrap" }}>
            <Button variant="primary" onClick={runPermissions}>
              Enable Location + Microphone
            </Button>
            <Button
              variant="ghost"
              onClick={() => {
                speak("Bez dozvola TBW ne može raditi.");
              }}
            >
              Cancel
            </Button>
          </div>

          <Hr />

          <div style={{ fontSize: 12, opacity: 0.75, lineHeight: 1.35 }}>
            If permissions are blocked, open browser settings → Site settings → allow Location and Microphone.
          </div>
        </div>
      </Modal>
    </div>
  );
}
