import React, { useEffect, useMemo, useRef, useState } from "react";

/* =========================================================
   TBW AI PREMIUM – App.jsx (FULL VERSION – STABILNA)
   ========================================================= */

/* -------------------- HELPERS -------------------- */

const DEFAULT_CITY = "Zagreb";

const normalize = (s = "") =>
  s
    .toLowerCase()
    .replace(/č/g, "c")
    .replace(/ć/g, "c")
    .replace(/đ/g, "d")
    .replace(/š/g, "s")
    .replace(/ž/g, "z")
    .trim();

const titleCaseSmart = (s = "") =>
  s
    .split(" ")
    .filter(Boolean)
    .map(w => w.charAt(0).toUpperCase() + w.slice(1))
    .join(" ");

/* -------------------- CITY DETECTION (GLOBAL) -------------------- */
/* OVO JE KLJUČNI POPRAVAK – više se NIKAD neće dogoditi
   "City: Smještaj U Karlovcu" */

function detectCityGlobal(raw) {
  if (!raw) return null;

  const t = normalize(raw);

  const STOP_WORDS = [
    "smjestaj","smještaj","booking","hotel","apartman","hostel",
    "za","u","in","to","for","od","do","osoba","osobe","ljudi"
  ];

  let cityPart = t;
  const m = t.match(/\bu\s+(.+)$/i);
  if (m?.[1]) cityPart = m[1];

  const words = cityPart
    .split(" ")
    .filter(w => w.length > 1 && !STOP_WORDS.includes(w));

  if (!words.length) return null;

  return titleCaseSmart(words.join(" "));
}

/* -------------------- INTENT -------------------- */

function detectIntent(text) {
  const t = normalize(text);
  return {
    accommodation:
      t.includes("smjestaj") ||
      t.includes("smještaj") ||
      t.includes("booking") ||
      t.includes("hotel") ||
      t.includes("apartman")
  };
}

function parseGuests(text) {
  const t = normalize(text);

  const MAP = {
    jedno: 1, dvoje: 2, troje: 3,
    cetiri: 4, pet: 5, sest: 6
  };

  for (const k in MAP) {
    if (t.includes(k)) return MAP[k];
  }

  const m = t.match(/\b(\d{1,2})\b/);
  if (m) {
    const n = parseInt(m[1], 10);
    if (n > 0 && n < 20) return n;
  }
  return null;
}

/* -------------------- BOOKING URL -------------------- */

function buildBookingUrl(city, guests) {
  const p = new URLSearchParams();
  p.set("ss", city || DEFAULT_CITY);
  if (guests) {
    p.set("group_adults", guests);
    p.set("no_rooms", 1);
  }
  return `https://www.booking.com/searchresults.html?${p.toString()}`;
}

/* ========================================================= */

export default function App() {

  /* -------------------- STATE -------------------- */

  const [input, setInput] = useState("");
  const [log, setLog] = useState([]);
  const [status, setStatus] = useState("Spremno");
  const [micOn, setMicOn] = useState(false);

  const [ctx, setCtx] = useState({
    city: DEFAULT_CITY,
    guests: null,
    bookingOpened: false
  });

  /* -------------------- SPEECH -------------------- */

  const recogRef = useRef(null);
  const shouldListenRef = useRef(false);
  const SpeechRecognition =
    window.SpeechRecognition || window.webkitSpeechRecognition;

  /* -------------------- LOG -------------------- */

  const pushLog = (role, text) => {
    setLog(l => [...l, { role, text }]);
  };

  /* -------------------- CORE HANDLER -------------------- */

  const handleUserText = (raw) => {
    if (!raw) return;

    pushLog("user", raw);

    const city = detectCityGlobal(raw);
    const guests = parseGuests(raw);
    const intent = detectIntent(raw);

    setCtx(prev => {
      const next = { ...prev };
      if (city) {
        next.city = city;
        next.bookingOpened = false;
      }
      if (guests) next.guests = guests;
      return next;
    });

    const finalCity = city || ctx.city || DEFAULT_CITY;

    /* --- BOOKING --- */
    if (intent.accommodation) {
      if (!ctx.bookingOpened) {
        const url = buildBookingUrl(finalCity, guests || ctx.guests);
        window.open(url, "_blank");
        setCtx(p => ({ ...p, bookingOpened: true }));
      }

      let reply = `U redu. Otvaram Booking za ${finalCity}.`;
      if (!guests && !ctx.guests) reply += " Koliko osoba?";

      pushLog("assistant", reply);
      setStatus(reply);
      return;
    }

    /* --- FOLLOW UP --- */
    if (guests && ctx.bookingOpened) {
      const url = buildBookingUrl(finalCity, guests);
      window.open(url, "_blank");
      pushLog("assistant", `U redu. ${guests} osobe. Ažuriram Booking.`);
      return;
    }

    pushLog(
      "assistant",
      `Spreman. Reci npr. "smještaj u ${DEFAULT_CITY}".`
    );
  };

  /* -------------------- MIC CONTROL -------------------- */

  const startMic = () => {
    if (!SpeechRecognition) {
      setStatus("Voice nije podržan u ovom browseru.");
      return;
    }

    if (!recogRef.current) {
      const r = new SpeechRecognition();
      r.lang = "hr-HR";
      r.continuous = true;
      r.interimResults = false;

      r.onresult = (e) => {
        const text = e.results[e.results.length - 1][0].transcript;
        handleUserText(text);
      };

      r.onerror = () => setMicOn(false);
      r.onend = () => {
        if (shouldListenRef.current) r.start();
      };

      recogRef.current = r;
    }

    shouldListenRef.current = true;
    recogRef.current.start();
    setMicOn(true);
    setStatus("Slušam...");
  };

  const stopMic = () => {
    shouldListenRef.current = false;
    recogRef.current?.stop();
    setMicOn(false);
    setStatus("Mikrofon pauziran");
  };

  /* -------------------- UI -------------------- */

  return (
    <div style={{ padding: 20, fontFamily: "system-ui", color: "#fff", background: "#000", minHeight: "100vh" }}>
      <h1>TBW AI PREMIUM</h1>
      <h3>AI Safety Navigation</h3>

      <p>
        📍 {ctx.city} | 🎤 {micOn ? "ON" : "OFF"}
      </p>

      <div style={{ display: "flex", gap: 6 }}>
        <input
          value={input}
          onChange={e => setInput(e.target.value)}
          placeholder="Upiši ili govori"
          style={{ flex: 1 }}
        />
        <button onClick={() => { handleUserText(input); setInput(""); }}>
          SEND
        </button>
        {!micOn ? (
          <button onClick={startMic}>🎤</button>
        ) : (
          <button onClick={stopMic}>⏹</button>
        )}
      </div>

      <p>Status: {status}</p>

      {!micOn && (
        <p style={{ fontSize: 12, opacity: 0.7 }}>
          🎤 Nakon otvaranja Bookinga, browser pauzira mikrofon.
          Dodirni 🎤 za nastavak razgovora.
        </p>
      )}

      <hr />

      <div>
        {log.map((m, i) => (
          <div key={i}>
            <b>{m.role === "user" ? "TI" : "TBW"}:</b> {m.text}
          </div>
        ))}
      </div>
    </div>
  );
    }
