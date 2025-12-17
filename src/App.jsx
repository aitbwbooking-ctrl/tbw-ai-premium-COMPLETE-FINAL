import React, { useEffect, useMemo, useRef, useState } from "react";

/**
 * TBW AI PREMIUM — App.jsx (FULL, no skraćivanje)
 * Fokus popravaka:
 * 1) NEMA bijelog ekrana: stabilan dark UI + siguran JSX
 * 2) City parsing radi za CIJELI SVIJET (Paris/Tokio/NYC/Karlovac...) bez liste gradova
 * 3) Voice ponavljanje: dedupe + samo FINAL result (interim ne šalje upite)
 * 4) Booking otvara TOČAN grad (iz rečenice), i nastavlja razgovor u TBW
 * 5) Nakon otvaranja Booking-a, browser često pauzira mic -> prikazujemo jasan “Tap Mic to continue”
 *
 * Pravila:
 * - SEND = samo ručni unos
 * - MIC = voice conversation (final transkript ide u handler)
 */

const DEFAULT_CITY = "Zagreb";

// ------------------------ Helpers ------------------------
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

const titleCase = (s) =>
  (s || "")
    .trim()
    .split(/\s+/)
    .map((w) => (w ? w[0].toUpperCase() + w.slice(1) : w))
    .join(" ");

const stripJunk = (s) =>
  (s || "")
    .replace(/[“”"’'`]/g, "")
    .replace(/[.,!?;:(){}\[\]<>]/g, " ")
    .replace(/\s+/g, " ")
    .trim();

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

  const route =
    t.includes("ruta") ||
    t.includes("navigacij") ||
    t.includes("kako do") ||
    t.includes("put") ||
    t.includes("direkcij") ||
    t.includes("map");

  const recommendation =
    t.includes("preporuk") ||
    t.includes("sto vidjeti") ||
    t.includes("šta vidjeti") ||
    t.includes("restoran") ||
    t.includes("kafi") ||
    t.includes("izlet");

  return { accommodation, route, recommendation };
}

// Guests: "2 osobe", "za 4", "dvoje", "troje"...
function parseGuests(text) {
  const t = normalize(text);

  const map = {
    jedno: 1,
    dvoje: 2,
    troje: 3,
    cetvero: 4,
    četvero: 4,
    petero: 5,
    sestero: 6,
    šestero: 6,
    sedmero: 7,
    osmero: 8,
    devetero: 9,
    desetero: 10,
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

// Date parse: "16.12" / "16.12.2025" -> YYYY-MM-DD
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
    return { checkin: parseDateHR(all[0]), checkout: parseDateHR(all[1]) };
  }

  const m = t.match(
    /od\s+(\d{1,2}\.\d{1,2}(?:\.\d{4})?)\s+do\s+(\d{1,2}\.\d{1,2}(?:\.\d{4})?)/i
  );
  if (m?.[1] && m?.[2]) {
    return { checkin: parseDateHR(m[1]), checkout: parseDateHR(m[2]) };
  }

  return { checkin: null, checkout: null };
}

/**
 * GLOBAL CITY DETECTION (bez liste)
 * Cilj: ako user kaže "smještaj u Parizu" -> Parizu => Paris/Pariz (ne diramo, samo titleCase)
 * Podržava:
 * - "smještaj u X"
 * - "booking X"
 * - "hotel u X"
 * - "apartman u X"
 * - "u Tokiju" / "u New Yorku"
 *
 * Ako ne možemo sigurno: vraća null (ne smije izmišljati Zagreb).
 */
function detectCityGlobal(text) {
  const raw = stripJunk(text);
  const t = normalize(raw);

  // 1) "booking PARIZ" / "booking: Pariz"
  // uzmi sve nakon riječi booking/airbnb/hotel/apartman/smjestaj
  const kw = ["booking", "airbnb", "hotel", "apartman", "smjestaj", "smještaj", "nocenje", "nocevanje", "sobe"];
  for (const k of kw) {
    const re = new RegExp(`\\b${k}\\b\\s*(?:u\\s+)?(.+)$`, "i");
    const m = raw.match(re);
    if (m?.[1]) {
      const candidate = stripJunk(m[1]);
      const city = takeCityFromCandidate(candidate);
      if (city) return city;
    }
  }

  // 2) "smještaj u X" (najčešće)
  // uzmi nakon "u "
  const mu = raw.match(/\bu\s+(.+)$/i);
  if (mu?.[1]) {
    const candidate = stripJunk(mu[1]);
    const city = takeCityFromCandidate(candidate);
    if (city) return city;
  }

  return null;
}

function takeCityFromCandidate(candidate) {
  // stop riječi koje znače da je ostatak rečenice detalj, ne grad
  const stops = [
    "za",
    "od",
    "do",
    "sutra",
    "danas",
    "veceras",
    "večeras",
    "jutro",
    "popodne",
    "hotel",
    "apartman",
    "smjestaj",
    "smještaj",
    "booking",
    "airbnb",
    "nocenje",
    "nocevanje",
    "sobe",
    "osoba",
    "osobe",
    "ljudi",
    "djece",
    "dece",
    "noc",
    "noć",
    "noci",
    "noći",
  ];

  let s = stripJunk(candidate);

  // ako je user rekao "Karlovcu za pet osoba" -> uzmi prvi dio prije " za "
  const parts = s.split(/\s+/);
  const out = [];
  for (let i = 0; i < parts.length; i++) {
    const w = parts[i];
    if (!w) continue;
    const nw = normalize(w);
    if (stops.includes(nw)) break;
    // prekini i na brojevima
    if (/^\d+$/.test(nw)) break;
    out.push(w);
    // ograniči grad na max 4 riječi (New York City)
    if (out.length >= 4) break;
  }

  const city = out.join(" ").trim();
  // minimalno 2 slova
  if (!city || city.length < 2) return null;
  return titleCase(city);
}

function buildBookingUrl({ city, guests, checkin, checkout, lang = "hr" }) {
  const base = `https://www.booking.com/searchresults.${lang}.html`;
  const params = new URLSearchParams();
  const c = city || DEFAULT_CITY;

  params.set("ss", c);
  params.set("ssne", c);
  params.set("ssne_untouched", c);

  // guests
  if (guests && Number.isFinite(guests)) {
    params.set("group_adults", String(Math.max(1, guests)));
    params.set("group_children", "0");
    params.set("no_rooms", "1");
  }

  if (checkin) params.set("checkin", checkin);
  if (checkout) params.set("checkout", checkout);

  return `${base}?${params.toString()}`;
}

// ------------------------ UI Components ------------------------
function Chip({ children }) {
  return (
    <span
      style={{
        display: "inline-flex",
        alignItems: "center",
        gap: 8,
        padding: "8px 12px",
        borderRadius: 999,
        background: "rgba(255,255,255,0.06)",
        border: "1px solid rgba(255,255,255,0.10)",
        fontSize: 12,
        color: "rgba(255,255,255,0.86)",
        backdropFilter: "blur(10px)",
      }}
    >
      {children}
    </span>
  );
}

function Card({ title, children, style }) {
  return (
    <div
      style={{
        background: "rgba(255,255,255,0.06)",
        border: "1px solid rgba(255,255,255,0.10)",
        borderRadius: 20,
        padding: 16,
        boxShadow: "0 16px 44px rgba(0,0,0,0.40)",
        backdropFilter: "blur(12px)",
        ...style,
      }}
    >
      {title ? (
        <div style={{ fontSize: 16, fontWeight: 900, color: "rgba(255,255,255,0.95)", marginBottom: 10 }}>
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
        background: "rgba(0,0,0,0.62)",
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
          width: "min(560px, 100%)",
          borderRadius: 20,
          background: "rgba(12,14,20,0.96)",
          border: "1px solid rgba(255,255,255,0.12)",
          boxShadow: "0 28px 70px rgba(0,0,0,0.55)",
          overflow: "hidden",
        }}
      >
        <div style={{ padding: 14, display: "flex", alignItems: "center", justifyContent: "space-between" }}>
          <div style={{ fontWeight: 900, color: "rgba(255,255,255,0.95)", letterSpacing: 0.3 }}>{title}</div>
          <button
            onClick={onClose}
            style={{
              width: 38,
              height: 38,
              borderRadius: 12,
              border: "1px solid rgba(255,255,255,0.14)",
              background: "rgba(255,255,255,0.06)",
              color: "rgba(255,255,255,0.92)",
              cursor: "pointer",
              fontWeight: 900,
            }}
            aria-label="Close"
          >
            ✕
          </button>
        </div>
        <div style={{ padding: 14, paddingTop: 0 }}>{children}</div>
      </div>
    </div>
  );
}

// ------------------------ App ------------------------
export default function App() {
  // chat
  const [typed, setTyped] = useState("");
  const [log, setLog] = useState([]); // {role, text, ts}
  const [status, setStatus] = useState("Spremno");
  const [micOn, setMicOn] = useState(false);
  const [lastHeard, setLastHeard] = useState("");

  // context
  const [ctx, setCtx] = useState({
    city: DEFAULT_CITY,
    guests: null,
    checkin: null,
    checkout: null,
    lastIntent: null,
    lastBookingUrl: null,
    bookingOpenedAt: 0,
  });

  // booking modal
  const [bookingModalOpen, setBookingModalOpen] = useState(false);
  const [bookingRecap, setBookingRecap] = useState({
    said: "",
    city: DEFAULT_CITY,
    url: "",
    recs: [],
  });

  // speech
  const recogRef = useRef(null);
  const shouldListenRef = useRef(false);
  const speakingRef = useRef(false);

  // dedupe for voice (sprječava ponavljanje “smještaj smještaj…”)
  const lastFinalRef = useRef({ text: "", ts: 0 });

  const mountedRef = useRef(false);

  const SpeechRecognition = useMemo(() => {
    return window.SpeechRecognition || window.webkitSpeechRecognition || null;
  }, []);

  const canVoice = !!SpeechRecognition;
  const canTTS = typeof window !== "undefined" && "speechSynthesis" in window;

  const pushLog = (role, text) => {
    setLog((prev) => [...prev, { role, text, ts: Date.now() }]);
  };

  const safeSpeak = async (text, { lang = "hr-HR" } = {}) => {
    if (!canTTS || !text) return;

    // na mobitelu TTS + mic često rade konflikt, zato: stop mic dok govori
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
      setStatus(shouldListenRef.current ? "🎤 Slušam..." : "Spremno");
      // mic se NE pali automatski (browser gesture), ali ako je već ON, pokušaj restart
      if (shouldListenRef.current) {
        startRecognitionSafe();
      }
    }
  };

  const computeConciergeRecs = (city) => {
    const c = city || DEFAULT_CITY;
    return [
      { title: "Hotel (sigurno + recepcija 24/7)", desc: "Za kasni dolazak i stabilnu uslugu.", city: c },
      { title: "Apartman (self check-in)", desc: "Fleksibilan dolazak, privatnost i mir.", city: c },
      { title: "Boutique smještaj (mirno + centar)", desc: "Manje stresa nakon puta; lako pješke.", city: c },
    ];
  };

  const openBooking = (city, extra = {}) => {
    const url = buildBookingUrl({
      city: city || DEFAULT_CITY,
      guests: extra.guests ?? ctx.guests,
      checkin: extra.checkin ?? ctx.checkin,
      checkout: extra.checkout ?? ctx.checkout,
      lang: "hr",
    });

    setCtx((p) => ({ ...p, lastBookingUrl: url, bookingOpenedAt: Date.now() }));

    // VAŽNO: otvaranje novog taba može pauzirati mic -> nakon povratka user tapne mic
    try {
      window.open(url, "_blank", "noopener,noreferrer");
    } catch {
      // ignore
    }

    return url;
  };

  // ------------------------ Core Handler ------------------------
  const handleUserText = async (raw, { fromVoice = false } = {}) => {
    const text = (raw || "").trim();
    if (!text) return;

    // log user
    pushLog("user", text);
    setLastHeard(text);

    // detect intent
    const intent = detectIntent(text);

    // city detection (global)
    const detectedCity = detectCityGlobal(text);

    // guests & dates
    const g = parseGuests(text);
    const dates = extractDates(text);

    // update ctx
    setCtx((prev) => {
      const next = { ...prev };

      if (detectedCity) next.city = detectedCity;
      if (g) next.guests = g;
      if (dates.checkin) next.checkin = dates.checkin;
      if (dates.checkout) next.checkout = dates.checkout;

      if (intent.accommodation) next.lastIntent = "accommodation";
      else if (intent.route) next.lastIntent = "route";
      else if (intent.recommendation) next.lastIntent = "recommendation";

      return next;
    });

    // local copy for immediate logic
    const city = detectedCity || ctx.city || DEFAULT_CITY;
    const guests = g || ctx.guests;
    const checkin = dates.checkin || ctx.checkin;
    const checkout = dates.checkout || ctx.checkout;

    // 1) Accommodation flow
    if (intent.accommodation) {
      const recs = computeConciergeRecs(city);
      const url = buildBookingUrl({ city, guests, checkin, checkout, lang: "hr" });

      setBookingRecap({ said: text, city, url, recs });
      setBookingModalOpen(true);

      // otvori booking ODMAH (ali točno s gradom)
      const openedUrl = openBooking(city, { guests, checkin, checkout });

      // Assistant follow-up (ne smije ponavljati gluposti)
      let follow = `U redu. Otvaram Booking za ${city}.`;
      if (!guests) follow += " Koliko osoba?";
      else if (!checkin || !checkout) follow += " Imaš li datume? (npr. od 16.12 do 18.12)";
      else follow += " Želiš hotel ili apartman?";

      pushLog("assistant", follow);
      // NE forsiramo TTS ako user radi na mobitelu s mic-om, ali može
      if (!fromVoice) await safeSpeak(follow);

      // status hint: browser often pauses mic after new tab
      setStatus("Spremno");
      return;
    }

    // 2) If user only provided city
    if (detectedCity && !intent.accommodation && !intent.route && !intent.recommendation) {
      const msg = `OK — ${detectedCity}. Reci: "smještaj u ${detectedCity}" ili "booking ${detectedCity}".`;
      pushLog("assistant", msg);
      if (!fromVoice) await safeSpeak(msg);
      return;
    }

    // 3) Continue accommodation conversation after booking opened
    // If last intent was accommodation, user might respond with guests/dates/hotel/apartman
    const lastIntent = ctx.lastIntent;
    if (lastIntent === "accommodation" || intent.accommodation) {
      const msgParts = [];
      if (g) msgParts.push(`Zabilježio sam: ${g} ${g === 1 ? "osoba" : "osobe"}.`);
      if (dates.checkin && dates.checkout) msgParts.push(`Datumi: ${dates.checkin} → ${dates.checkout}.`);

      let msg = msgParts.length ? msgParts.join(" ") : "Razumijem.";
      if (!guests) msg += " Koliko osoba?";
      else if (!checkin || !checkout) msg += " Koji su datumi? (od 16.12 do 18.12)";
      else msg += " Želiš hotel ili apartman?";

      pushLog("assistant", msg);
      if (!fromVoice) await safeSpeak(msg);

      // Update modal url (ali NE spamaj otvaranje novog taba)
      const url = buildBookingUrl({ city, guests, checkin, checkout, lang: "hr" });
      setBookingRecap((prev) => ({ ...prev, city, url }));

      return;
    }

    // 4) Fallback (kratko, bez loop-a)
    const fallback = `Reci npr. "smještaj u ${city}" ili "booking ${city} za 2 osobe".`;
    pushLog("assistant", fallback);
    if (!fromVoice) await safeSpeak(fallback);
  };

  // ------------------------ Speech Recognition ------------------------
  const startRecognitionSafe = () => {
    if (!canVoice) {
      setStatus("⚠️ Voice: not-allowed (browser)");
      return;
    }
    if (speakingRef.current) return;

    if (!recogRef.current) {
      const r = new SpeechRecognition();
      r.lang = "hr-HR";
      r.continuous = true;
      r.interimResults = true;

      r.onstart = () => setStatus("🎤 Slušam...");

      r.onresult = (event) => {
        let interim = "";
        let finalText = "";

        for (let i = event.resultIndex; i < event.results.length; i++) {
          const res = event.results[i];
          const txt = (res[0]?.transcript || "").trim();
          if (!txt) continue;

          if (res.isFinal) {
            finalText += (finalText ? " " : "") + txt;
          } else {
            interim += (interim ? " " : "") + txt;
          }
        }

        // show interim but do NOT send
        if (interim) setStatus(`🎤 ${interim}`);

        if (finalText) {
          const cleaned = stripJunk(finalText);

          // DEDUPE: blokiraj ponavljanje istog u 2.5 sekunde
          const now = Date.now();
          const last = lastFinalRef.current;
          const normNow = normalize(cleaned);
          const normLast = normalize(last.text);

          if (normNow && normNow === normLast && now - last.ts < 2500) {
            // ignore duplicate
            return;
          }

          // DEDUPE 2: ako je jako kratko i izgleda kao “smještaj smještaj” spam, odreži ponavljanja riječi
          const deSpam = (s) => {
            const w = s.split(/\s+/);
            const out = [];
            for (let i = 0; i < w.length; i++) {
              const prev = out[out.length - 1];
              if (prev && normalize(prev) === normalize(w[i])) continue; // remove immediate duplicates
              out.push(w[i]);
            }
            return out.join(" ").trim();
          };

          const stable = deSpam(cleaned);

          lastFinalRef.current = { text: stable, ts: now };
          setLastHeard(stable);

          // SEND voice to handler
          handleUserText(stable, { fromVoice: true });
        }
      };

      r.onerror = (e) => {
        const err = e?.error || "unknown";
        if (err === "no-speech") setStatus("🎤 Slušam...");
        else if (err === "aborted") setStatus("⏸️ Pauza...");
        else setStatus(`⚠️ Voice: ${err}`);

        // keep trying only if user wants mic on
        if (shouldListenRef.current && !speakingRef.current) {
          try {
            r.stop();
          } catch {}
          setTimeout(() => {
            if (shouldListenRef.current) {
              try {
                r.start();
              } catch {}
            }
          }, 400);
        }
      };

      r.onend = () => {
        if (shouldListenRef.current && !speakingRef.current) {
          setTimeout(() => {
            if (shouldListenRef.current) {
              try {
                r.start();
              } catch {}
            }
          }, 350);
        } else {
          setStatus("Spremno");
        }
      };

      recogRef.current = r;
    }

    try {
      recogRef.current.start();
      setMicOn(true);
      setStatus("🎤 Slušam...");
    } catch {
      setMicOn(true);
      setStatus("🎤 Slušam...");
    }
  };

  const stopRecognition = () => {
    shouldListenRef.current = false;
    setMicOn(false);
    setStatus("Spremno");
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

  // ------------------------ Init ------------------------
  useEffect(() => {
    if (mountedRef.current) return;
    mountedRef.current = true;

    // initial log
    const hello =
      "TBW AI PREMIUM spreman. Reci grad i što trebaš, npr. 'smještaj u Karlovcu' ili 'booking Pariz'.";
    pushLog("assistant", hello);
    setStatus("Spremno");
  }, []);

  // manual send
  const onManualSend = async () => {
    const t = typed.trim();
    if (!t) return;
    setTyped("");
    await handleUserText(t, { fromVoice: false });
  };

  // ------------------------ Styles (DARK, no white) ------------------------
  const pageStyle = {
    minHeight: "100vh",
    background:
      "radial-gradient(1200px 700px at 20% 10%, rgba(20,255,140,0.12), transparent 60%), radial-gradient(900px 600px at 80% 20%, rgba(60,160,255,0.12), transparent 60%), linear-gradient(180deg, #06070C 0%, #070A12 40%, #04050A 100%)",
    color: "rgba(255,255,255,0.92)",
    fontFamily:
      'ui-sans-serif, system-ui, -apple-system, Segoe UI, Roboto, "Helvetica Neue", Arial, "Noto Sans", "Liberation Sans", sans-serif',
  };

  const containerStyle = {
    maxWidth: 980,
    margin: "0 auto",
    padding: "18px 14px 120px",
  };

  const headerStyle = {
    display: "flex",
    alignItems: "center",
    justifyContent: "space-between",
    gap: 12,
    padding: "6px 4px 14px",
  };

  const brandStyle = {
    fontWeight: 900,
    letterSpacing: 1.2,
    fontSize: 14,
    opacity: 0.95,
  };

  const bookingBtnStyle = {
    padding: "10px 14px",
    borderRadius: 999,
    border: "1px solid rgba(255,255,255,0.14)",
    background: "rgba(255,255,255,0.06)",
    color: "rgba(255,255,255,0.94)",
    cursor: "pointer",
    fontWeight: 900,
    letterSpacing: 0.6,
  };

  const heroStyle = {
    padding: 18,
    borderRadius: 22,
    border: "1px solid rgba(255,255,255,0.12)",
    background: "linear-gradient(180deg, rgba(255,255,255,0.07), rgba(255,255,255,0.03))",
    boxShadow: "0 18px 55px rgba(0,0,0,0.45)",
    backdropFilter: "blur(12px)",
  };

  const h1Style = { fontSize: 44, lineHeight: 1.04, margin: "14px 0 10px", fontWeight: 950 };
  const subStyle = { fontSize: 14, color: "rgba(255,255,255,0.75)", marginBottom: 14 };

  const rowStyle = { display: "flex", flexWrap: "wrap", gap: 10, marginBottom: 14 };

  const inputWrapStyle = {
    display: "flex",
    gap: 10,
    alignItems: "center",
    width: "100%",
  };

  const inputStyle = {
    flex: 1,
    minWidth: 160,
    padding: "12px 14px",
    borderRadius: 14,
    border: "1px solid rgba(255,255,255,0.12)",
    background: "rgba(0,0,0,0.22)",
    color: "rgba(255,255,255,0.95)",
    outline: "none",
  };

  const sendStyle = {
    padding: "12px 14px",
    borderRadius: 14,
    border: "1px solid rgba(255,255,255,0.12)",
    background: "rgba(255,255,255,0.06)",
    color: "rgba(255,255,255,0.92)",
    cursor: "pointer",
    fontWeight: 900,
  };

  const micStyle = (on) => ({
    width: 48,
    height: 48,
    borderRadius: 14,
    border: "1px solid rgba(255,255,255,0.12)",
    background: on ? "rgba(0,255,140,0.16)" : "rgba(255,255,255,0.06)",
    color: "rgba(255,255,255,0.92)",
    cursor: "pointer",
    fontWeight: 900,
    display: "grid",
    placeItems: "center",
  });

  const convoBoxStyle = {
    marginTop: 12,
    borderRadius: 18,
    border: "1px solid rgba(255,255,255,0.10)",
    overflow: "hidden",
  };

  const msgStyle = (role) => ({
    padding: "12px 14px",
    background: role === "assistant" ? "rgba(255,255,255,0.04)" : "rgba(0,255,140,0.08)",
    borderTop: "1px solid rgba(255,255,255,0.06)",
    fontSize: 14,
    lineHeight: 1.35,
    whiteSpace: "pre-wrap",
  });

  const smallHintStyle = {
    marginTop: 10,
    fontSize: 12,
    color: "rgba(255,255,255,0.65)",
  };

  const floatingBar = {
    position: "fixed",
    left: 0,
    right: 0,
    bottom: 0,
    padding: "10px 12px",
    background: "rgba(0,0,0,0.55)",
    borderTop: "1px solid rgba(255,255,255,0.10)",
    backdropFilter: "blur(10px)",
    zIndex: 999,
  };

  const floatInner = {
    maxWidth: 980,
    margin: "0 auto",
    display: "flex",
    alignItems: "center",
    justifyContent: "space-between",
    gap: 10,
  };

  // ------------------------ Render ------------------------
  return (
    <div style={pageStyle}>
      <div style={containerStyle}>
        <div style={headerStyle}>
          <div style={brandStyle}>TBW AI PREMIUM</div>

          <button
            style={bookingBtnStyle}
            onClick={() => {
              // manual booking open for current city
              const url = openBooking(ctx.city || DEFAULT_CITY, {});
              const recs = computeConciergeRecs(ctx.city || DEFAULT_CITY);
              setBookingRecap({
                said: "Manual open",
                city: ctx.city || DEFAULT_CITY,
                url,
                recs,
              });
              setBookingModalOpen(true);
              setStatus("Spremno");
            }}
          >
            BOOKING
          </button>
        </div>

        <div style={heroStyle}>
          <div style={h1Style}>AI Safety Navigation</div>
          <div style={subStyle}>Navigation, booking and concierge assist automatically when needed.</div>

          <div style={rowStyle}>
            <Chip>📍 {ctx.city || DEFAULT_CITY}</Chip>
            <Chip>🎤 {micOn ? "ON" : "OFF"}</Chip>
            <Chip>Status: {status}</Chip>
          </div>

          <Card title="TBW AI Search">
            <div style={inputWrapStyle}>
              <input
                value={typed}
                onChange={(e) => setTyped(e.target.value)}
                placeholder="Upiši (SEND) ili stisni 🎤 i reci"
                style={inputStyle}
              />
              <button style={sendStyle} onClick={onManualSend}>
                SEND
              </button>
              <button
                style={micStyle(micOn)}
                onClick={toggleMic}
                title={canVoice ? "Mic" : "Voice not supported"}
              >
                🎤
              </button>
            </div>

            <div style={smallHintStyle}>
              {canVoice ? (
                <>
                  Nakon otvaranja Booking-a, browser često pauzira mikrofon. Vrati se u TBW i dodirni 🎤 za nastavak.
                </>
              ) : (
                <>Voice: not-allowed (provjeri browser permission za mikrofon).</>
              )}
              {lastHeard ? <div style={{ marginTop: 8 }}>Čuo sam: <b>{lastHeard}</b></div> : null}
            </div>
          </Card>

          <div style={{ height: 14 }} />

          <Card title="Conversation">
            <div style={convoBoxStyle}>
              {log.length === 0 ? (
                <div style={msgStyle("assistant")}>TBW: Spremno.</div>
              ) : (
                log.slice(-20).map((m) => (
                  <div key={m.ts} style={msgStyle(m.role)}>
                    <b>{m.role === "assistant" ? "TBW" : "TI"}:</b> {m.text}
                  </div>
                ))
              )}
            </div>
          </Card>
        </div>
      </div>

      {/* Booking concierge modal (does NOT embed booking, only recap + link) */}
      <Modal
        open={bookingModalOpen}
        onClose={() => setBookingModalOpen(false)}
        title={`Booking Concierge — ${bookingRecap.city || DEFAULT_CITY}`}
      >
        <div style={{ fontSize: 13, color: "rgba(255,255,255,0.80)", marginBottom: 10 }}>
          Rekao si: <b>{bookingRecap.said || "-"}</b>
        </div>

        <div style={{ display: "grid", gap: 10 }}>
          <div
            style={{
              padding: 12,
              borderRadius: 16,
              border: "1px solid rgba(255,255,255,0.10)",
              background: "rgba(255,255,255,0.04)",
            }}
          >
            <div style={{ fontWeight: 900, marginBottom: 6 }}>Otvoreni link</div>
            <div style={{ fontSize: 12, opacity: 0.85, wordBreak: "break-word" }}>
              {bookingRecap.url || ctx.lastBookingUrl || "—"}
            </div>

            <div style={{ display: "flex", gap: 10, marginTop: 10, flexWrap: "wrap" }}>
              <button
                style={sendStyle}
                onClick={() => {
                  const url = bookingRecap.url || ctx.lastBookingUrl;
                  if (url) {
                    try {
                      window.open(url, "_blank", "noopener,noreferrer");
                    } catch {}
                  }
                }}
              >
                OPEN AGAIN
              </button>

              <button
                style={sendStyle}
                onClick={() => {
                  setBookingModalOpen(false);
                }}
              >
                EXIT
              </button>
            </div>
          </div>

          <div
            style={{
              padding: 12,
              borderRadius: 16,
              border: "1px solid rgba(255,255,255,0.10)",
              background: "rgba(255,255,255,0.04)",
            }}
          >
            <div style={{ fontWeight: 900, marginBottom: 8 }}>Preporuke (AI Concierge)</div>
            <div style={{ display: "grid", gap: 8 }}>
              {(bookingRecap.recs || []).map((r, idx) => (
                <div
                  key={idx}
                  style={{
                    padding: 10,
                    borderRadius: 14,
                    border: "1px solid rgba(255,255,255,0.08)",
                    background: "rgba(0,0,0,0.18)",
                  }}
                >
                  <div style={{ fontWeight: 900 }}>{r.title}</div>
                  <div style={{ fontSize: 12, opacity: 0.8 }}>{r.desc}</div>
                </div>
              ))}
            </div>

            <div style={{ marginTop: 10, fontSize: 12, opacity: 0.75 }}>
              Nastavi razgovor ovdje: reci npr. “za 2 osobe” ili “od 16.12 do 18.12”.
            </div>
          </div>
        </div>
      </Modal>

      {/* bottom bar */}
      <div style={floatingBar}>
        <div style={floatInner}>
          <div style={{ fontSize: 12, color: "rgba(255,255,255,0.75)" }}>
            Grad: <b>{ctx.city || DEFAULT_CITY}</b>{" "}
            {ctx.guests ? (
              <>
                | Gosti: <b>{ctx.guests}</b>
              </>
            ) : null}
            {ctx.checkin && ctx.checkout ? (
              <>
                {" "}
                | Datumi: <b>{ctx.checkin}</b> → <b>{ctx.checkout}</b>
              </>
            ) : null}
          </div>

          <div style={{ display: "flex", gap: 10 }}>
            <button
              style={sendStyle}
              onClick={() => {
                // quick booking with current ctx
                const url = openBooking(ctx.city || DEFAULT_CITY, {
                  guests: ctx.guests,
                  checkin: ctx.checkin,
                  checkout: ctx.checkout,
                });
                setBookingRecap({
                  said: "Quick open",
                  city: ctx.city || DEFAULT_CITY,
                  url,
                  recs: computeConciergeRecs(ctx.city || DEFAULT_CITY),
                });
                setBookingModalOpen(true);
                setStatus("Spremno");
              }}
            >
              BOOKING
            </button>

            <button
              style={micStyle(micOn)}
              onClick={toggleMic}
              title={canVoice ? "Mic" : "Voice not supported"}
            >
              🎤
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
