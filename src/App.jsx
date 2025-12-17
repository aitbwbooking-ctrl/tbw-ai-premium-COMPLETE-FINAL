import React, { useEffect, useMemo, useRef, useState } from "react";

/**
 * TBW AI PREMIUM — App.jsx (mobile-first)
 * FIXES:
 * - Global city support (any city in the world) without relying on CITY_ALIASES
 * - No more "always Zagreb" fallback when user clearly said another city
 * - Continue dialog after Booking opens (guests/dates)
 * - Anti-repeat assistant replies + dedupe voice spam ("smještaj smještaj...")
 * - Mobile: when returning from Booking tab, auto-resume mic (if it was ON)
 *
 * RULES:
 * - SEND button = manual typing only
 * - Mic button = continuous conversation (auto-handle, no SEND needed)
 * - Booking opens automatically when user asks accommodation/booking (with detected city)
 */

const DEFAULT_CITY = "Zagreb";

// --- Helpers (normalize diacritics) ---
const normalize = (s) =>
  (s || "")
    .toLowerCase()
    .replace(/č/g, "c")
    .replace(/ć/g, "c")
    .replace(/đ/g, "d")
    .replace(/š/g, "s")
    .replace(/ž/g, "z")
    .replace(/\s+/g, " ")
    .trim();

// remove repetitive words: "smjestaj smjestaj smjestaj u ..." -> "smjestaj u ..."
function dedupeRepeatedWords(input) {
  const t = normalize(input);
  if (!t) return "";
  const parts = t.split(" ");
  const out = [];
  for (let i = 0; i < parts.length; i++) {
    const w = parts[i];
    const prev = out[out.length - 1];
    if (w && w !== prev) out.push(w);
  }
  return out.join(" ").trim();
}

function titleCaseSmart(s) {
  const raw = (s || "").trim();
  if (!raw) return raw;
  return raw
    .split(" ")
    .filter(Boolean)
    .map((w) => {
      // keep short words lower (optional), but keep simple:
      return w.charAt(0).toUpperCase() + w.slice(1);
    })
    .join(" ");
}

function detectIntent(text) {
  const t = normalize(text);

  const accommodation =
    t.includes("smjestaj") ||
    t.includes("smještaj") ||
    t.includes("hotel") ||
    t.includes("apartman") ||
    t.includes("booking") ||
    t.includes("airbnb") ||
    t.includes("nocenje") ||
    t.includes("nocevanje") ||
    t.includes("sobe") ||
    t.includes("rezervacij") ||
    t.includes("book") ||
    t.includes("hostel") ||
    t.includes("bnb");

  const travel =
    t.includes("ruta") ||
    t.includes("navigacij") ||
    t.includes("put") ||
    t.includes("kako do") ||
    t.includes("vozi do") ||
    t.includes("idi u");

  return {
    accommodation,
    travel,
  };
}

// Parse guests from HR / numbers
function parseGuests(text) {
  const t = normalize(text);

  const map = {
    jedno: 1,
    dvoje: 2,
    dvojeje: 2,
    troje: 3,
    cetvero: 4,
    četvero: 4,
    petero: 5,
    pet: 5,
    sestero: 6,
    sest: 6,
    sedam: 7,
    osam: 8,
    devet: 9,
    deset: 10,
  };

  for (const k of Object.keys(map)) {
    if (t.includes(k)) return map[k];
  }

  const m = t.match(/\b(\d{1,2})\b/);
  if (m?.[1]) {
    const n = parseInt(m[1], 10);
    if (!Number.isNaN(n) && n >= 1 && n <= 20) return n;
  }
  return null;
}

// Very lightweight date parse: accepts "16.12" or "16.12.2025" -> YYYY-MM-DD (current year default)
function parseDateHR(dots) {
  const t = normalize(dots);
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
  const all = [...t.matchAll(/(\d{1,2}\.\d{1,2}(?:\.\d{4})?)/g)].map((x) => x[1]);
  if (all.length >= 2) {
    const a = parseDateHR(all[0]);
    const b = parseDateHR(all[1]);
    return { checkin: a, checkout: b };
  }
  const m = t.match(/od\s+(\d{1,2}\.\d{1,2}(?:\.\d{4})?)\s+do\s+(\d{1,2}\.\d{1,2}(?:\.\d{4})?)/i);
  if (m?.[1] && m?.[2]) {
    return { checkin: parseDateHR(m[1]), checkout: parseDateHR(m[2]) };
  }
  return { checkin: null, checkout: null };
}

/**
 * GLOBAL city detector:
 * - Works for ANY city/region name written by user, not a fixed list.
 * - Heuristics:
 *   1) "u <place>", "in <place>", "to <place>", "za <place>" etc.
 *   2) if text contains accommodation keywords, take trailing phrase after keyword: "smještaj u Parizu"
 *   3) if user just typed a single word (or two) and it's not a command -> treat as place
 */
function detectCityGlobal(raw) {
  const text = (raw || "").trim();
  if (!text) return null;

  // Keep original (for casing), but use normalized for matching
  const t = dedupeRepeatedWords(text); // normalized & deduped

  // Common patterns "u X", "in X", "to X", "za X"
  const patterns = [
    /\bu\s+([a-z0-9\s\-'’\.]{2,})$/i,
    /\bin\s+([a-z0-9\s\-'’\.]{2,})$/i,
    /\bto\s+([a-z0-9\s\-'’\.]{2,})$/i,
    /\bza\s+([a-z0-9\s\-'’\.]{2,})$/i,
    /\bfor\s+([a-z0-9\s\-'’\.]{2,})$/i,
  ];

  for (const re of patterns) {
    const m = t.match(re);
    if (m?.[1]) {
      const cand = m[1].trim();
      // Stop words cleanup (avoid capturing "za 2 osobe" as city)
      if (cand.match(/\b(osoba|osobe|ljudi|noc|noci|dana|dan|od|do)\b/i)) {
        // try to cut before these tokens
        const cut = cand.split(/\b(osoba|osobe|ljudi|noc|noci|dana|dan|od|do)\b/i)[0].trim();
        if (cut.length >= 2) return titleCaseSmart(cut);
      }
      if (cand.length >= 2) return titleCaseSmart(cand);
    }
  }

  // If accommodation keywords present, try to extract after them
  const kw = [
    "smjestaj",
    "smještaj",
    "hotel",
    "apartman",
    "booking",
    "airbnb",
    "hostel",
    "bnb",
  ];
  for (const k of kw) {
    const idx = t.indexOf(k);
    if (idx !== -1) {
      const after = t.slice(idx + k.length).trim();
      // typical "smjestaj u parizu"
      const m = after.match(/\bu\s+([a-z0-9\s\-'’\.]{2,})/i);
      if (m?.[1]) {
        const cand = m[1].trim();
        if (cand.length >= 2) return titleCaseSmart(cand);
      }
      // maybe "booking paris"
      const m2 = after.match(/^([a-z0-9\s\-'’\.]{2,})/i);
      if (m2?.[1]) {
        const cand = m2[1].trim();
        // avoid "za 2 osobe" etc
        if (!cand.match(/^(za|for)\b/i) && cand.length >= 2) return titleCaseSmart(cand);
      }
    }
  }

  // If user message is short and looks like a place alone (e.g., "Pariz", "Tokyo", "New York")
  const cleaned = text.trim();
  const words = cleaned.split(/\s+/).filter(Boolean);
  if (words.length <= 3) {
    const n = normalize(cleaned);
    // exclude obvious commands
    const bad =
      n.includes("alo") ||
      n.includes("hello") ||
      n.includes("bok") ||
      n.includes("pozdrav") ||
      n.includes("test") ||
      n.includes("mic") ||
      n.includes("send");
    if (!bad && cleaned.length >= 2) return titleCaseSmart(cleaned);
  }

  return null;
}

function buildBookingUrl({ city, guests, checkin, checkout, lang = "hr" }) {
  const base = `https://www.booking.com/searchresults.${lang}.html`;
  const params = new URLSearchParams();
  params.set("ss", city || DEFAULT_CITY);
  params.set("ssne", city || DEFAULT_CITY);
  params.set("ssne_untouched", city || DEFAULT_CITY);

  if (guests && Number.isFinite(guests)) {
    params.set("group_adults", String(Math.max(1, guests)));
    params.set("group_children", "0");
    params.set("no_rooms", "1");
  }
  if (checkin) params.set("checkin", checkin);
  if (checkout) params.set("checkout", checkout);

  return `${base}?${params.toString()}`;
}

// --- UI helpers ---
function Chip({ children }) {
  return (
    <span
      style={{
        display: "inline-flex",
        alignItems: "center",
        gap: 8,
        padding: "6px 10px",
        borderRadius: 999,
        background: "rgba(255,255,255,0.06)",
        border: "1px solid rgba(255,255,255,0.08)",
        fontSize: 12,
        color: "rgba(255,255,255,0.85)",
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
        borderRadius: 18,
        padding: 14,
        boxShadow: "0 12px 30px rgba(0,0,0,0.25)",
        backdropFilter: "blur(10px)",
      }}
    >
      {title ? (
        <div
          style={{
            fontSize: 14,
            fontWeight: 700,
            color: "rgba(255,255,255,0.92)",
            marginBottom: 10,
          }}
        >
          {title}
        </div>
      ) : null}
      {children}
    </div>
  );
}

function Modal({ open, onClose, title, children }) {
  if (!open) return null;
  return (
    <div
      onClick={onClose}
      style={{
        position: "fixed",
        inset: 0,
        background: "rgba(0,0,0,0.55)",
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
        padding: 16,
        zIndex: 9999,
      }}
    >
      <div
        onClick={(e) => e.stopPropagation()}
        style={{
          width: "min(520px, 100%)",
          borderRadius: 18,
          background: "rgba(14,18,30,0.96)",
          border: "1px solid rgba(255,255,255,0.12)",
          boxShadow: "0 22px 50px rgba(0,0,0,0.45)",
          overflow: "hidden",
        }}
      >
        <div style={{ padding: 14, display: "flex", alignItems: "center", justifyContent: "space-between" }}>
          <div style={{ fontWeight: 800, color: "rgba(255,255,255,0.92)" }}>{title}</div>
          <button
            onClick={onClose}
            style={{
              width: 34,
              height: 34,
              borderRadius: 10,
              border: "1px solid rgba(255,255,255,0.12)",
              background: "rgba(255,255,255,0.06)",
              color: "rgba(255,255,255,0.85)",
              cursor: "pointer",
            }}
          >
            ✕
          </button>
        </div>
        <div style={{ padding: 14, paddingTop: 0 }}>{children}</div>
      </div>
    </div>
  );
}

export default function App() {
  // UI / chat
  const [typed, setTyped] = useState("");
  const [log, setLog] = useState([]); // {role:'user'|'assistant', text:string, ts:number}
  const [status, setStatus] = useState("Spremno.");
  const [micOn, setMicOn] = useState(false);
  const [lastHeard, setLastHeard] = useState("");

  // Context memory
  const [ctx, setCtx] = useState({
    city: DEFAULT_CITY,
    guests: null,
    checkin: null,
    checkout: null,
    lastIntent: null,
    bookingOpenedForCity: null,
  });

  // Booking concierge modal
  const [bookingModalOpen, setBookingModalOpen] = useState(false);
  const [bookingRecap, setBookingRecap] = useState({
    said: "",
    city: DEFAULT_CITY,
    url: "",
  });

  // Speech
  const recogRef = useRef(null);
  const speakingRef = useRef(false);
  const shouldListenRef = useRef(false);
  const restartTimerRef = useRef(null);
  const mountedRef = useRef(false);

  // Anti-repeat
  const lastAssistantRef = useRef("");
  const lastUserNormRef = useRef("");
  const lastUserAtRef = useRef(0);

  const SpeechRecognition = useMemo(() => {
    if (typeof window === "undefined") return null;
    return window.SpeechRecognition || window.webkitSpeechRecognition || null;
  }, []);

  const canVoice = !!SpeechRecognition;
  const canTTS = typeof window !== "undefined" && "speechSynthesis" in window;

  const pushLog = (role, text) => {
    setLog((prev) => [...prev, { role, text, ts: Date.now() }]);
  };

  const pushAssistant = (text) => {
    const clean = (text || "").trim();
    if (!clean) return;

    // don't repeat identical assistant line back-to-back
    if (normalize(clean) === normalize(lastAssistantRef.current)) return;

    lastAssistantRef.current = clean;
    pushLog("assistant", clean);
  };

  const speak = async (text, { lang = "hr-HR" } = {}) => {
    if (!canTTS || !text) return;

    speakingRef.current = true;
    try {
      if (recogRef.current) {
        try {
          recogRef.current.abort();
        } catch {}
      }

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
      setStatus("🎤 Spremno.");
      if (shouldListenRef.current) startRecognitionSafe();
    }
  };

  const openBooking = (city, extra = {}) => {
    const url = buildBookingUrl({
      city: city || DEFAULT_CITY,
      guests: extra.guests ?? ctx.guests,
      checkin: extra.checkin ?? ctx.checkin,
      checkout: extra.checkout ?? ctx.checkout,
      lang: "hr",
    });

    setBookingRecap({
      said: extra.said || "",
      city: city || DEFAULT_CITY,
      url,
    });

    // IMPORTANT: keep TBW open -> always try _blank
    try {
      window.open(url, "_blank", "noopener,noreferrer");
    } catch {
      // If blocked, we still show modal with URL button
    }
  };

  // --- Core handler ---
  const handleUserText = async (raw, { fromVoice = false } = {}) => {
    const original = (raw || "").trim();
    if (!original) return;

    // de-dupe identical user inputs arriving too fast (common with voice)
    const now = Date.now();
    const userNorm = dedupeRepeatedWords(original);
    if (userNorm && userNorm === lastUserNormRef.current && now - lastUserAtRef.current < 1200) {
      return;
    }
    lastUserNormRef.current = userNorm;
    lastUserAtRef.current = now;

    // log user
    pushLog("user", original);
    setLastHeard(original);

    let nextCtx = { ...ctx };

    // intent + entities
    const intent = detectIntent(original);

    // Detect guests/dates always (so "dvije" works after booking)
    const g = parseGuests(original);
    if (g) nextCtx.guests = g;

    const dates = extractDates(original);
    if (dates.checkin) nextCtx.checkin = dates.checkin;
    if (dates.checkout) nextCtx.checkout = dates.checkout;

    // Detect city globally (any world city)
    const detectedCity = detectCityGlobal(original);
    if (detectedCity) {
      nextCtx.city = detectedCity;
      nextCtx.bookingOpenedForCity = null; // new city -> allow open again
    }

    // Store last intent
    if (intent.accommodation) nextCtx.lastIntent = "accommodation";
    if (intent.travel) nextCtx.lastIntent = "travel";

    setCtx(nextCtx);

    const city = nextCtx.city || DEFAULT_CITY;

    // If accommodation intent but no city -> ASK city (do NOT open Zagreb)
    if (intent.accommodation && !detectedCity && !nextCtx.city) {
      const msg = "Koji grad? Primjer: “smještaj u Karlovcu” ili “booking Pariz”.";
      pushAssistant(msg);
      if (fromVoice) await speak(msg);
      return;
    }

    // Accommodation: open booking + continue dialog
    if (intent.accommodation) {
      // Open only once per city to avoid spam
      if (nextCtx.bookingOpenedForCity !== city) {
        openBooking(city, { guests: nextCtx.guests, checkin: nextCtx.checkin, checkout: nextCtx.checkout, said: original });
        setCtx((p) => ({ ...p, bookingOpenedForCity: city }));
      }

      let follow = `U redu. Otvaram Booking za ${city}.`;
      if (!nextCtx.guests) follow += " Koliko osoba?";
      else if (!nextCtx.checkin || !nextCtx.checkout) follow += " Koji su datumi? (npr. od 17.12 do 18.12)";
      else follow += " Želiš hotel ili apartman?";

      setBookingModalOpen(true);
      setBookingRecap({
        said: original,
        city,
        url: buildBookingUrl({
          city,
          guests: nextCtx.guests,
          checkin: nextCtx.checkin,
          checkout: nextCtx.checkout,
          lang: "hr",
        }),
      });

      pushAssistant(follow);
      if (fromVoice) await speak(follow);
      return;
    }

    // If we are in accommodation flow and user gives guests/dates, react (do not go back to Zagreb phrase)
    if (nextCtx.lastIntent === "accommodation") {
      const parts = [];
      if (g) parts.push(`OK: ${g} ${g === 1 ? "osoba" : "osobe"}.`);
      if (dates.checkin && dates.checkout) parts.push(`Datumi: ${dates.checkin} → ${dates.checkout}.`);

      let msg = parts.length ? parts.join(" ") : "Razumijem.";
      if (!nextCtx.guests) msg += " Koliko osoba?";
      else if (!nextCtx.checkin || !nextCtx.checkout) msg += " Koji su datumi? (od 17.12 do 18.12)";
      else msg += ` Super. Ako želiš, reci “hotel” ili “apartman” za ${city}.`;

      // Update modal URL (so user can press open again manually)
      setBookingRecap({
        said: nextCtx.lastIntent ? original : "",
        city,
        url: buildBookingUrl({
          city,
          guests: nextCtx.guests,
          checkin: nextCtx.checkin,
          checkout: nextCtx.checkout,
          lang: "hr",
        }),
      });

      pushAssistant(msg);
      if (fromVoice) await speak(msg);
      return;
    }

    // If user only said a city
    if (detectedCity && !intent.accommodation) {
      const msg = `OK — ${detectedCity}. Reci: “smještaj” ili “booking” za otvaranje pretrage.`;
      pushAssistant(msg);
      if (fromVoice) await speak(msg);
      return;
    }

    // Fallback (but not repetitive)
    const fallback = `Reci npr. “smještaj u ${DEFAULT_CITY}” ili “booking Pariz”.`;
    pushAssistant(fallback);
    if (fromVoice) await speak(fallback);
  };

  // --- SpeechRecognition setup ---
  const startRecognitionSafe = () => {
    if (!canVoice) {
      setStatus("⚠️ Voice nije podržan u ovom browseru.");
      return;
    }
    if (speakingRef.current) return;

    if (restartTimerRef.current) {
      clearTimeout(restartTimerRef.current);
      restartTimerRef.current = null;
    }

    if (!recogRef.current) {
      const r = new SpeechRecognition();
      r.lang = "hr-HR";
      r.continuous = true;
      r.interimResults = true;

      let finalBuffer = "";

      r.onstart = () => setStatus("🎤 Slušam...");

      r.onresult = (event) => {
        let interim = "";
        let final = "";

        for (let i = event.resultIndex; i < event.results.length; i++) {
          const res = event.results[i];
          const txt = (res[0]?.transcript || "").trim();
          if (!txt) continue;
          if (res.isFinal) final += (final ? " " : "") + txt;
          else interim += (interim ? " " : "") + txt;
        }

        if (interim) setStatus(`🎤 ${interim}`);

        if (final) {
          // stabilize buffer
          const cleanFinal = dedupeRepeatedWords(final);
          finalBuffer = (finalBuffer ? finalBuffer + " " : "") + cleanFinal;
          setLastHeard(finalBuffer.trim());

          if (restartTimerRef.current) clearTimeout(restartTimerRef.current);
          restartTimerRef.current = setTimeout(() => {
            const utter = finalBuffer.trim();
            finalBuffer = "";
            if (utter) handleUserText(utter, { fromVoice: true });
          }, 550);
        }
      };

      r.onerror = (e) => {
        // Common mobile errors:
        // - not-allowed / service-not-allowed -> user blocked mic permission
        if (e?.error === "not-allowed" || e?.error === "service-not-allowed") {
          setStatus("⚠️ Voice: not-allowed (dozvoli mikrofon u browseru).");
          shouldListenRef.current = false;
          setMicOn(false);
          return;
        }

        if (e?.error === "no-speech") setStatus("🎤 Slušam...");
        else if (e?.error === "aborted") setStatus("⏸️ Pauza...");
        else if (e?.error) setStatus(`⚠️ Voice: ${e.error}`);

        if (shouldListenRef.current && !speakingRef.current) {
          restartTimerRef.current = setTimeout(() => {
            try {
              r.start();
            } catch {}
          }, 450);
        }
      };

      r.onend = () => {
        if (shouldListenRef.current && !speakingRef.current) {
          restartTimerRef.current = setTimeout(() => {
            try {
              r.start();
            } catch {}
          }, 350);
        } else {
          setStatus("⏹️ Mikrofon zaustavljen.");
        }
      };

      recogRef.current = r;
    }

    try {
      recogRef.current.start();
      setMicOn(true);
    } catch {
      // already started
      setMicOn(true);
    }
  };

  const stopRecognition = () => {
    shouldListenRef.current = false;
    setMicOn(false);
    setStatus("⏹️ Mikrofon zaustavljen.");
    if (restartTimerRef.current) {
      clearTimeout(restartTimerRef.current);
      restartTimerRef.current = null;
    }
    try {
      recogRef.current?.stop();
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

  // Mobile: when returning from Booking tab, resume mic if it was ON
  useEffect(() => {
    const onVis = () => {
      if (document.visibilityState === "visible") {
        // If user wanted mic on, try to restart (needs gesture sometimes; but we attempt)
        if (shouldListenRef.current && !speakingRef.current) {
          startRecognitionSafe();
        }
      }
    };
    document.addEventListener("visibilitychange", onVis);
    return () => document.removeEventListener("visibilitychange", onVis);
  }, [canVoice]);

  // Initial greeting (once)
  useEffect(() => {
    if (mountedRef.current) return;
    mountedRef.current = true;

    const hello = "TBW AI PREMIUM spreman. Reci grad i što trebaš, npr. “smještaj u Karlovcu” ili “booking Pariz”.";
    setStatus("🎤 Spremno.");
    pushAssistant(hello);
  }, []);

  // UI: manual send (typing only)
  const onManualSend = async () => {
    const t = typed.trim();
    if (!t) return;
    setTyped("");
    await handleUserText(t, { fromVoice: false });
  };

  const cityLabel = ctx.city || DEFAULT_CITY;

  // --- Styles (dark premium) ---
  const pageStyle = {
    minHeight: "100vh",
    background:
      "radial-gradient(1200px 700px at 20% 10%, rgba(20,255,140,0.12), transparent 60%), radial-gradient(900px 600px at 80% 20%, rgba(60,160,255,0.12), transparent 60%), linear-gradient(180deg, #070A12 0%, #090B13 40%, #05060A 100%)",
    color: "rgba(255,255,255,0.9)",
    fontFamily:
      'ui-sans-serif, system-ui, -apple-system, Segoe UI, Roboto, "Helvetica Neue", Arial, "Noto Sans", "Liberation Sans", sans-serif',
  };

  const containerStyle = {
    maxWidth: 980,
    margin: "0 auto",
    padding: "18px 14px 80px",
  };

  const headerStyle = {
    display: "flex",
    alignItems: "center",
    justifyContent: "space-between",
    gap: 12,
    padding: "10px 6px 14px",
  };

  const brandStyle = { fontWeight: 900, letterSpacing: 1.5, fontSize: 14, opacity: 0.92 };

  const bookingBtnStyle = {
    padding: "10px 14px",
    borderRadius: 999,
    border: "1px solid rgba(255,255,255,0.12)",
    background: "rgba(255,255,255,0.06)",
    color: "rgba(255,255,255,0.92)",
    cursor: "pointer",
    fontWeight: 800,
    letterSpacing: 0.6,
  };

  const heroStyle = {
    padding: 18,
    borderRadius: 22,
    border: "1px solid rgba(255,255,255,0.10)",
    background: "linear-gradient(180deg, rgba(255,255,255,0.06), rgba(255,255,255,0.03))",
    boxShadow: "0 18px 50px rgba(0,0,0,0.35)",
    backdropFilter: "blur(10px)",
  };

  const inputRow = {
    display: "grid",
    gridTemplateColumns: "1fr auto auto",
    gap: 10,
    alignItems: "center",
    marginTop: 10,
  };

  const inputStyle = {
    width: "100%",
    padding: "12px 12px",
    borderRadius: 14,
    border: "1px solid rgba(255,255,255,0.12)",
    outline: "none",
    background: "rgba(0,0,0,0.25)",
    color: "rgba(255,255,255,0.92)",
    fontSize: 14,
  };

  const micBtnStyle = (on) => ({
    width: 46,
    height: 46,
    borderRadius: 14,
    border: "1px solid rgba(255,255,255,0.12)",
    background: on ? "rgba(40,220,140,0.22)" : "rgba(255,255,255,0.06)",
    color: "rgba(255,255,255,0.92)",
    cursor: "pointer",
    fontSize: 18,
  });

  const sendBtnStyle = {
    height: 46,
    padding: "0 16px",
    borderRadius: 14,
    border: "1px solid rgba(40,220,140,0.35)",
    background: "rgba(40,220,140,0.22)",
    color: "rgba(255,255,255,0.92)",
    cursor: "pointer",
    fontWeight: 800,
    letterSpacing: 0.8,
  };

  const smallText = { fontSize: 12, opacity: 0.78, marginTop: 8 };

  const openBookingManual = () => {
    const url = buildBookingUrl({
      city: cityLabel,
      guests: ctx.guests,
      checkin: ctx.checkin,
      checkout: ctx.checkout,
      lang: "hr",
    });

    setBookingRecap({ said: "", city: cityLabel, url });
    setBookingModalOpen(true);

    try {
      window.open(url, "_blank", "noopener,noreferrer");
    } catch {}
  };

  return (
    <div style={pageStyle}>
      <div style={containerStyle}>
        <div style={headerStyle}>
          <div style={brandStyle}>TBW AI PREMIUM</div>
          <button style={bookingBtnStyle} onClick={openBookingManual}>
            BOOKING
          </button>
        </div>

        <div style={heroStyle}>
          <div style={{ fontSize: 34, fontWeight: 900, letterSpacing: 0.4, marginBottom: 6 }}>
            AI Safety Navigation
          </div>
          <div style={{ opacity: 0.78, fontSize: 14, lineHeight: 1.45 }}>
            Navigation is active. Booking and concierge assist automatically when needed.
          </div>

          <div style={{ marginTop: 14, display: "flex", gap: 10, flexWrap: "wrap" }}>
            <Chip>
              <span style={{ width: 8, height: 8, borderRadius: 999, background: "rgba(40,220,140,0.9)" }} />
              Navigation running
            </Chip>
            <Chip>📍 City: {cityLabel}</Chip>
            <Chip>🎤 {micOn ? "Mic ON" : "Mic OFF"}</Chip>
          </div>

          <div style={{ marginTop: 14 }}>
            <Card title="TBW AI Search">
              <div style={inputRow}>
                <input
                  value={typed}
                  onChange={(e) => setTyped(e.target.value)}
                  onKeyDown={(e) => {
                    if (e.key === "Enter") onManualSend();
                  }}
                  placeholder='Upiši ili klikni 🎤 i reci: "smještaj u Parizu"'
                  style={inputStyle}
                />

                <button
                  title={micOn ? "Zaustavi mikrofon" : "Pokreni mikrofon"}
                  style={micBtnStyle(micOn)}
                  onClick={toggleMic}
                >
                  {micOn ? "⏹️" : "🎤"}
                </button>

                <button style={sendBtnStyle} onClick={onManualSend}>
                  SEND
                </button>
              </div>

              <div style={smallText}>
                Status: <b>{status}</b>
                {canVoice ? "" : " (Voice nije podržan u ovom browseru)"}
              </div>

              {lastHeard ? (
                <div style={{ marginTop: 10, fontSize: 12, opacity: 0.8 }}>
                  Čuo sam: <b>{lastHeard}</b>
                </div>
              ) : null}
            </Card>
          </div>

          <div style={{ marginTop: 12 }}>
            <Card title="Sustav aktivan">
              <div style={{ opacity: 0.85, fontSize: 13, lineHeight: 1.5 }}>
                AI navigacija i booking engine su spremni.
              </div>
              <div style={{ marginTop: 10, display: "flex", gap: 10, flexWrap: "wrap" }}>
                <Chip>👥 {ctx.guests ? `${ctx.guests} osobe` : "gosti: ?"} </Chip>
                <Chip>📅 {ctx.checkin && ctx.checkout ? `${ctx.checkin} → ${ctx.checkout}` : "datumi: ?"} </Chip>
              </div>
            </Card>
          </div>

          <div style={{ marginTop: 12 }}>
            <Card title="Conversation">
              <div style={{ maxHeight: 220, overflow: "auto", display: "grid", gap: 8 }}>
                {log.slice(-12).map((m) => (
                  <div
                    key={m.ts + m.role}
                    style={{
                      padding: "10px 12px",
                      borderRadius: 14,
                      background: m.role === "assistant" ? "rgba(60,160,255,0.10)" : "rgba(40,220,140,0.10)",
                      border: "1px solid rgba(255,255,255,0.08)",
                      fontSize: 13,
                      lineHeight: 1.4,
                    }}
                  >
                    <div style={{ fontWeight: 800, fontSize: 12, opacity: 0.8, marginBottom: 4 }}>
                      {m.role === "assistant" ? "TBW" : "TI"}
                    </div>
                    {m.text}
                  </div>
                ))}
              </div>
            </Card>
          </div>
        </div>
      </div>

      <Modal open={bookingModalOpen} onClose={() => setBookingModalOpen(false)} title="TBW Booking">
        <div style={{ fontSize: 13, opacity: 0.85, marginBottom: 10 }}>
          Rečeno: <b>{bookingRecap.said || "(—)"}</b>
        </div>

        <div style={{ fontSize: 13, opacity: 0.9, marginBottom: 10 }}>
          Grad: <b>{bookingRecap.city || DEFAULT_CITY}</b>
        </div>

        <button
          onClick={() => {
            // open again using current context
            openBooking(bookingRecap.city || cityLabel, { said: bookingRecap.said });
          }}
          style={{
            height: 46,
            width: "100%",
            borderRadius: 14,
            border: "1px solid rgba(255,255,255,0.12)",
            background: "rgba(255,255,255,0.06)",
            color: "rgba(255,255,255,0.92)",
            cursor: "pointer",
            fontWeight: 900,
          }}
        >
          Open booking search (new tab)
        </button>

        <div style={{ marginTop: 10, fontSize: 12, opacity: 0.75, lineHeight: 1.4 }}>
          Tip (mobitel): Booking se otvara u novom tabu. Vrati se na TBW tab — mikrofon će se pokušati ponovno uključiti ako je bio ON.
        </div>
      </Modal>
    </div>
  );
}
