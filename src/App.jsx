import React, { useEffect, useMemo, useRef, useState } from "react";

/**
 * TBW AI PREMIUM — App.jsx (mobile-first)
 * - Voice: Web Speech API (SpeechRecognition)
 * - TTS: SpeechSynthesis
 * - RULES:
 *   - SEND button = manual typing only
 *   - Mic button = continuous conversation (auto-handle, no SEND needed)
 *   - Booking opens automatically when user asks for accommodation/booking (with detected city)
 *   - Keeps context (city/guests/dates) and continues dialog
 */

const DEFAULT_CITY = "Zagreb";

// --- Helpers (Croatian-ish parsing) ---
const normalize = (s) =>
  (s || "")
    .toLowerCase()
    .replace(/č/g, "c")
    .replace(/ć/g, "c")
    .replace(/đ/g, "d")
    .replace(/š/g, "s")
    .replace(/ž/g, "z")
    .trim();

const CITY_ALIASES = [
  "zagreb",
  "split",
  "zadar",
  "rijeka",
  "osijek",
  "dubrovnik",
  "pula",
  "karlovac",
  "sibenik",
  "makarska",
  "varazdin",
  "slavonski brod",
  "vukovar",
  "trogir",
  "opatija",
  "krk",
  "hvar",
  "brac",
  "korcula",
];

function detectCity(text) {
  const t = normalize(text);
  // direct match for multi-word first
  for (const c of CITY_ALIASES.filter((x) => x.includes(" "))) {
    if (t.includes(c)) return titleCase(c);
  }
  for (const c of CITY_ALIASES.filter((x) => !x.includes(" "))) {
    // match whole word-ish
    const re = new RegExp(`\\b${c}\\b`, "i");
    if (re.test(t)) return titleCase(c);
  }

  // patterns like "u zagrebu"
  const m = t.match(/\bu\s+([a-zčćđšž]+)\b/i);
  if (m?.[1]) {
    const guess = normalize(m[1]);
    if (CITY_ALIASES.includes(guess)) return titleCase(guess);
  }

  return null;
}

function titleCase(s) {
  return s
    .split(" ")
    .map((w) => (w ? w[0].toUpperCase() + w.slice(1) : w))
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
    t.includes("book");

  const guests = t.includes("osob") || t.includes("ljud") || t.includes("nas") || t.includes("djece");

  return {
    accommodation,
    guests,
  };
}

function parseGuests(text) {
  const t = normalize(text);

  // "dvoje", "troje" etc.
  const map = {
    jedno: 1,
    dvoje: 2,
    dvojeje: 2,
    dvojeh: 2,
    troje: 3,
    cetvero: 4,
    petero: 5,
    sestero: 6,
  };
  for (const k of Object.keys(map)) {
    if (t.includes(k)) return map[k];
  }

  // numeric: "2 osobe", "za 3"
  const m = t.match(/\b(\d{1,2})\b/);
  if (m?.[1]) {
    const n = parseInt(m[1], 10);
    if (!Number.isNaN(n) && n >= 1 && n <= 20) return n;
  }
  return null;
}

function buildBookingUrl({ city, guests, checkin, checkout, lang = "hr" }) {
  // booking searchresults with city + optional params
  const base = `https://www.booking.com/searchresults.${lang}.html`;
  const params = new URLSearchParams();
  params.set("ss", city || DEFAULT_CITY);
  params.set("ssne", city || DEFAULT_CITY);
  params.set("ssne_untouched", city || DEFAULT_CITY);
  // guests:
  if (guests && Number.isFinite(guests)) {
    params.set("group_adults", String(Math.max(1, guests)));
    params.set("group_children", "0");
    params.set("no_rooms", "1");
  }
  // dates if available in YYYY-MM-DD
  if (checkin) params.set("checkin", checkin);
  if (checkout) params.set("checkout", checkout);

  return `${base}?${params.toString()}`;
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
  // look for two dates in one sentence
  const all = [...t.matchAll(/(\d{1,2}\.\d{1,2}(?:\.\d{4})?)/g)].map((x) => x[1]);
  if (all.length >= 2) {
    const a = parseDateHR(all[0]);
    const b = parseDateHR(all[1]);
    return { checkin: a, checkout: b };
  }
  // "od 16.12 do 18.12"
  const m = t.match(/od\s+(\d{1,2}\.\d{1,2}(?:\.\d{4})?)\s+do\s+(\d{1,2}\.\d{1,2}(?:\.\d{4})?)/i);
  if (m?.[1] && m?.[2]) {
    return { checkin: parseDateHR(m[1]), checkout: parseDateHR(m[2]) };
  }
  return { checkin: null, checkout: null };
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
        <div style={{ fontSize: 14, fontWeight: 700, color: "rgba(255,255,255,0.92)", marginBottom: 10 }}>
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
    city: null,
    guests: null,
    checkin: null,
    checkout: null,
    lastIntent: null,
    bookingOpenedForCity: null, // to prevent spam opens
  });

  // Booking concierge modal
  const [bookingModalOpen, setBookingModalOpen] = useState(false);
  const [bookingRecap, setBookingRecap] = useState({
    said: "",
    city: null,
    recs: [],
    url: "",
  });

  // Speech
  const recogRef = useRef(null);
  const speakingRef = useRef(false);
  const shouldListenRef = useRef(false);
  const restartTimerRef = useRef(null);
  const mountedRef = useRef(false);

  const SpeechRecognition = useMemo(() => {
    return window.SpeechRecognition || window.webkitSpeechRecognition || null;
  }, []);

  const canVoice = !!SpeechRecognition;
  const canTTS = typeof window !== "undefined" && "speechSynthesis" in window;

  const pushLog = (role, text) => {
    setLog((prev) => [...prev, { role, text, ts: Date.now() }]);
  };

  const speak = async (text, { lang = "hr-HR" } = {}) => {
    if (!canTTS || !text) return;

    // prevent feedback loop: pause recognition while speaking
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
        window.speechSynthesis.cancel(); // clean queue
        window.speechSynthesis.speak(u);
      });
    } finally {
      speakingRef.current = false;
      setStatus("🎤 Spremno.");
      // resume if mic should be on
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

    setBookingRecap((prev) => ({
      ...prev,
      city: city || DEFAULT_CITY,
      url,
    }));

    // Open in new tab/window (mobile will usually open a tab)
    try {
      window.open(url, "_blank", "noopener,noreferrer");
    } catch {
      // ignore
    }
  };

  const computeConciergeRecs = (city) => {
    const c = city || DEFAULT_CITY;
    // lightweight deterministic recs (no external APIs)
    return [
      {
        title: "Family-friendly hotel (24h recepcija, parking)",
        desc: "Kasni dolazak + obiteljska sigurnost, predvidljiva usluga.",
      },
      {
        title: "Mirniji boutique smještaj (tiho, centar, dobro osvijetljeno)",
        desc: "Manje stresa nakon puta; lakše pješke po centru.",
      },
      {
        title: "Apartman s dobrom izolacijom (self check-in)",
        desc: "Fleksibilno vrijeme dolaska; privatnost i mir.",
      },
    ].map((x) => ({ ...x, city: c }));
  };

  // --- Core NLU-ish handler ---
  const handleUserText = async (raw, { fromVoice = false } = {}) => {
    const text = (raw || "").trim();
    if (!text) return;

    // Log user message (for UI)
    pushLog("user", text);
    setLastHeard(text);

    let nextCtx = { ...ctx };

    // detect city
    const detectedCity = detectCity(text);
    if (detectedCity) {
      nextCtx.city = detectedCity;
      nextCtx.bookingOpenedForCity = null; // allow new open for new city
    }

    // detect guests/dates
    const g = parseGuests(text);
    if (g) nextCtx.guests = g;
    const dates = extractDates(text);
    if (dates.checkin) nextCtx.checkin = dates.checkin;
    if (dates.checkout) nextCtx.checkout = dates.checkout;

    const intent = detectIntent(text);
    if (intent.accommodation) nextCtx.lastIntent = "accommodation";

    setCtx(nextCtx);

    // Decide assistant behavior
    const city = nextCtx.city || DEFAULT_CITY;

    // If user asked accommodation/booking: open booking automatically (ONCE per city to avoid spam)
    if (intent.accommodation) {
      const said = text;
      const recs = computeConciergeRecs(city);
      const url = buildBookingUrl({
        city,
        guests: nextCtx.guests,
        checkin: nextCtx.checkin,
        checkout: nextCtx.checkout,
        lang: "hr",
      });

      setBookingRecap({ said, city, recs, url });
      setBookingModalOpen(true);

      // open booking automatically once per city (prevents continuous open spam)
      if (nextCtx.bookingOpenedForCity !== city) {
        openBooking(city, {
          guests: nextCtx.guests,
          checkin: nextCtx.checkin,
          checkout: nextCtx.checkout,
        });
        setCtx((p) => ({ ...p, bookingOpenedForCity: city }));
      }

      // Continue conversation intelligently (ask only what is missing)
      let follow = `U redu. Otvaram Booking za ${city}.`;
      if (!nextCtx.guests) follow += " Koliko osoba?";
      else if (!nextCtx.checkin || !nextCtx.checkout)
        follow += " Imaš li datume? (npr. od 16.12 do 18.12)";
      else follow += " Želiš hotel ili apartman?";

      pushLog("assistant", follow);
      await speak(follow);
      return;
    }

    // If user only said city (or changed city), confirm briefly and ask what next
    if (detectedCity && !intent.accommodation) {
      const msg = `OK — ${detectedCity}. Što tražiš: smještaj, ruta, ili preporuka?`;
      pushLog("assistant", msg);
      await speak(msg);
      return;
    }

    // If last intent was accommodation and user answered guests/dates, continue & refresh booking url silently
    if (nextCtx.lastIntent === "accommodation") {
      // If we now have guests or dates, we can update booking (but DO NOT spam open)
      // We'll only open again if we have new concrete info AND we haven't opened for this city yet.
      const msgParts = [];
      if (g) msgParts.push(`Zabilježio sam: ${g} ${g === 1 ? "osoba" : "osobe"}.`);
      if (dates.checkin && dates.checkout) msgParts.push(`Datumi: ${dates.checkin} → ${dates.checkout}.`);

      let msg = msgParts.length ? msgParts.join(" ") : "Razumijem.";
      if (!nextCtx.guests) msg += " Koliko osoba?";
      else if (!nextCtx.checkin || !nextCtx.checkout) msg += " Koji su datumi? (od 16.12 do 18.12)";
      else msg += " Želiš hotel ili apartman?";

      pushLog("assistant", msg);
      await speak(msg);

      // Update booking modal recap url
      const url = buildBookingUrl({
        city,
        guests: nextCtx.guests,
        checkin: nextCtx.checkin,
        checkout: nextCtx.checkout,
        lang: "hr",
      });
      setBookingRecap((prev) => ({ ...prev, city, url }));

      return;
    }

    // Default assistant reply
    const fallback = `Reci samo grad i što trebaš. Primjer: "Smještaj u ${DEFAULT_CITY}" ili "Booking ${DEFAULT_CITY} za 2 osobe".`;
    pushLog("assistant", fallback);
    await speak(fallback);
  };

  // --- SpeechRecognition setup ---
  const startRecognitionSafe = () => {
    if (!canVoice) {
      setStatus("❌ Ovaj preglednik ne podržava voice.");
      return;
    }
    if (speakingRef.current) return;

    // clear pending restart
    if (restartTimerRef.current) {
      clearTimeout(restartTimerRef.current);
      restartTimerRef.current = null;
    }

    // create once
    if (!recogRef.current) {
      const r = new SpeechRecognition();
      r.lang = "hr-HR";
      r.continuous = true;
      r.interimResults = true;

      let finalBuffer = "";

      r.onstart = () => {
        setStatus("🎤 Slušam...");
      };

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

        // show live interim status
        if (interim) setStatus(`🎤 ${interim}`);

        if (final) {
          // De-dupe & stabilize: buffer then flush after short pause
          finalBuffer = (finalBuffer ? finalBuffer + " " : "") + final;
          setLastHeard(finalBuffer.trim());

          // flush after 550ms idle
          if (restartTimerRef.current) clearTimeout(restartTimerRef.current);
          restartTimerRef.current = setTimeout(() => {
            const utter = finalBuffer.trim();
            finalBuffer = "";
            if (utter) {
              handleUserText(utter, { fromVoice: true });
            }
          }, 550);
        }
      };

      r.onerror = (e) => {
        // "no-speech" is common; do not spam logs
        if (e?.error === "no-speech") {
          setStatus("🎤 Slušam...");
        } else if (e?.error === "aborted") {
          // expected when we stop/abort while speaking
          setStatus("⏸️ Pauza...");
        } else if (e?.error) {
          setStatus(`⚠️ Voice: ${e.error}`);
        }

        // restart only if user wants mic on and we're not speaking
        if (shouldListenRef.current && !speakingRef.current) {
          restartTimerRef.current = setTimeout(() => {
            try {
              r.start();
            } catch {
              // ignore
            }
          }, 450);
        }
      };

      r.onend = () => {
        // restart if mic should be on
        if (shouldListenRef.current && !speakingRef.current) {
          restartTimerRef.current = setTimeout(() => {
            try {
              r.start();
            } catch {
              // ignore
            }
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
      // start can throw if already started
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
      // user gesture -> required on mobile
      shouldListenRef.current = true;
      startRecognitionSafe();
    } else {
      stopRecognition();
    }
  };

  // Initial greeting (once)
  useEffect(() => {
    if (mountedRef.current) return;
    mountedRef.current = true;

    const hello = "TBW AI PREMIUM spreman. Reci grad i što trebaš, npr. 'smještaj u Zagrebu'.";
    setStatus("🎤 Spremno.");
    pushLog("assistant", hello);
    // do NOT auto-speak on load (mobile restrictions)
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
    setBookingRecap((prev) => ({
      ...prev,
      city: cityLabel,
      url,
      recs: computeConciergeRecs(cityLabel),
      said: prev.said || "",
    }));
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
            Navigation is active. Booking, safety and concierge assist automatically when needed.
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
                  placeholder='Upiši ili klikni 🎤 i reci što trebaš (npr. "smještaj u Zagrebu")'
                  style={inputStyle}
                />

                {/* MIC = conversation (no SEND needed) */}
                <button
                  title={micOn ? "Zaustavi mikrofon" : "Pokreni mikrofon"}
                  style={micBtnStyle(micOn)}
                  onClick={toggleMic}
                >
                  {micOn ? "⏹️" : "🎤"}
                </button>

                {/* SEND = manual typing only */}
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
                AI navigacija, sigurnosni slojevi i booking engine su spremni.
              </div>
              <div style={{ marginTop: 10, display: "flex", gap: 10, flexWrap: "wrap" }}>
                <Chip>👥 {ctx.guests ? `${ctx.guests} osobe` : "gosti: ?"} </Chip>
                <Chip>📅 {ctx.checkin && ctx.checkout ? `${ctx.checkin} → ${ctx.checkout}` : "datumi: ?"} </Chip>
              </div>
            </Card>
          </div>

          {/* Conversation log (compact) */}
          <div style={{ marginTop: 12 }}>
            <Card title="Conversation">
              <div style={{ maxHeight: 220, overflow: "auto", display: "grid", gap: 8 }}>
                {log.slice(-12).map((m) => (
                  <div
                    key={m.ts + m.role}
                    style={{
                      padding: "10px 12px",
                      borderRadius: 14,
                      background:
                        m.role === "assistant" ? "rgba(60,160,255,0.10)" : "rgba(40,220,140,0.10)",
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

      {/* Booking concierge modal */}
      <Modal
        open={bookingModalOpen}
        onClose={() => setBookingModalOpen(false)}
        title="TBW 5★ Booking Concierge"
      >
        <div style={{ fontSize: 13, opacity: 0.85, marginBottom: 10 }}>
          Rečeno: <b>{bookingRecap.said || "(—)"}</b>
        </div>

        <div style={{ display: "grid", gap: 10 }}>
          <div style={{ fontWeight: 900, opacity: 0.92 }}>Preporuke ({bookingRecap.city || DEFAULT_CITY}):</div>

          {(bookingRecap.recs || []).slice(0, 3).map((r, idx) => (
            <div
              key={idx}
              style={{
                padding: 12,
                borderRadius: 16,
                border: "1px solid rgba(255,255,255,0.10)",
                background: "rgba(255,255,255,0.06)",
              }}
            >
              <div style={{ fontWeight: 900, marginBottom: 6 }}>{r.title}</div>
              <div style={{ fontSize: 13, opacity: 0.85 }}>{r.desc}</div>
            </div>
          ))}

          <button
            onClick={() => {
              // Always open with current context
              openBooking(bookingRecap.city || cityLabel);
            }}
            style={{
              height: 46,
              borderRadius: 14,
              border: "1px solid rgba(255,255,255,0.12)",
              background: "rgba(255,255,255,0.06)",
              color: "rgba(255,255,255,0.92)",
              cursor: "pointer",
              fontWeight: 900,
            }}
          >
            Open booking search
          </button>

          <button
            onClick={async () => {
              const msg = "OK. Ako želiš, reci budžet ili kvart. Primjer: 'do 120 eura, centar'.";
              pushLog("assistant", msg);
              await speak(msg);
            }}
            style={{
              height: 46,
              borderRadius: 14,
              border: "1px solid rgba(255,255,255,0.12)",
              background: "rgba(255,255,255,0.06)",
              color: "rgba(255,255,255,0.92)",
              cursor: "pointer",
              fontWeight: 900,
            }}
          >
            Show Plan B (safe alternatives)
          </button>
        </div>
      </Modal>
    </div>
  );
}

