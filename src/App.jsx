import React, { useEffect, useMemo, useRef, useState } from "react";

/**
 * TBW AI PREMIUM — App.jsx (STABILNA VERZIJA)
 * - Mic = kontinuirani razgovor (bez SEND-a)
 * - SEND = samo ručni unos
 * - Booking se otvara AUTOMATSKI kad se traži smještaj
 * - Grad koji se ZADNJI izgovori = JEDINI koji vrijedi
 * - Razgovor se nastavlja i nakon otvaranja Bookinga
 */

const DEFAULT_CITY = "Zagreb";

/* ------------------ HELPERS ------------------ */

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
  "beograd",
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
];

function titleCase(s) {
  return s
    .split(" ")
    .map((w) => w.charAt(0).toUpperCase() + w.slice(1))
    .join(" ");
}

function detectCity(text) {
  const t = normalize(text);
  for (const c of CITY_ALIASES) {
    const re = new RegExp(`\\b${c}\\b`, "i");
    if (re.test(t)) return titleCase(c);
  }
  return null;
}

function detectIntent(text) {
  const t = normalize(text);
  return (
    t.includes("smjestaj") ||
    t.includes("smještaj") ||
    t.includes("hotel") ||
    t.includes("apartman") ||
    t.includes("booking")
  );
}

function parseGuests(text) {
  const t = normalize(text);
  if (t.includes("2") || t.includes("dvoje")) return 2;
  if (t.includes("3") || t.includes("troje")) return 3;
  if (t.includes("4") || t.includes("cetiri")) return 4;
  return null;
}

function buildBookingUrl({ city, guests }) {
  const base = "https://www.booking.com/searchresults.hr.html";
  const p = new URLSearchParams();
  p.set("ss", city);
  if (guests) {
    p.set("group_adults", guests);
    p.set("no_rooms", "1");
  }
  return `${base}?${p.toString()}`;
}

/* ------------------ COMPONENT ------------------ */

export default function App() {
  const [typed, setTyped] = useState("");
  const [log, setLog] = useState([]);
  const [status, setStatus] = useState("Spremno");
  const [micOn, setMicOn] = useState(false);
  const [lastHeard, setLastHeard] = useState("");

  const [ctx, setCtx] = useState({
    city: null,
    guests: null,
  });

  const recogRef = useRef(null);
  const shouldListenRef = useRef(false);
  const speakingRef = useRef(false);

  const SpeechRecognition = useMemo(
    () => window.SpeechRecognition || window.webkitSpeechRecognition || null,
    []
  );

  /* ------------------ LOG ------------------ */

  const pushLog = (role, text) => {
    setLog((l) => [...l, { role, text, ts: Date.now() }]);
  };

  /* ------------------ TTS ------------------ */

  const speak = async (text) => {
    if (!("speechSynthesis" in window)) return;

    speakingRef.current = true;
    try {
      recogRef.current?.abort();

      const u = new SpeechSynthesisUtterance(text);
      u.lang = "hr-HR";
      u.rate = 0.95;
      u.pitch = 1.05;

      setStatus("Govorim...");
      await new Promise((res) => {
        u.onend = res;
        window.speechSynthesis.cancel();
        window.speechSynthesis.speak(u);
      });
    } finally {
      speakingRef.current = false;
      setStatus("Slušam...");
      if (shouldListenRef.current) startRecognition();
    }
  };

  /* ------------------ BOOKING ------------------ */

  const openBooking = (city, guests) => {
    const url = buildBookingUrl({ city, guests });
    window.open(url, "_blank", "noopener,noreferrer");
  };

  /* ------------------ CORE HANDLER ------------------ */

  const handleUserText = async (raw) => {
    if (!raw) return;
    const text = raw.trim();

    pushLog("user", text);
    setLastHeard(text);

    let nextCtx = { ...ctx };

    const city = detectCity(text);
    if (city) nextCtx.city = city;

    const guests = parseGuests(text);
    if (guests) nextCtx.guests = guests;

    setCtx(nextCtx);

    const wantsBooking = detectIntent(text);
    const finalCity = nextCtx.city || DEFAULT_CITY;

    if (wantsBooking) {
      openBooking(finalCity, nextCtx.guests);

      let reply = `Otvaram Booking za ${finalCity}.`;
      if (!nextCtx.guests) reply += " Koliko osoba?";
      else reply += " Reci ako želiš promijeniti grad ili broj osoba.";

      pushLog("assistant", reply);
      await speak(reply);
      return;
    }

    if (city) {
      const msg = `U redu. ${city}. Reci trebaš li smještaj.`;
      pushLog("assistant", msg);
      await speak(msg);
      return;
    }

    const fallback = `Reci grad i što trebaš, npr. "smještaj u Beogradu".`;
    pushLog("assistant", fallback);
    await speak(fallback);
  };

  /* ------------------ SPEECH ------------------ */

  const startRecognition = () => {
    if (!SpeechRecognition || speakingRef.current) return;

    if (!recogRef.current) {
      const r = new SpeechRecognition();
      r.lang = "hr-HR";
      r.continuous = true;
      r.interimResults = false;

      r.onstart = () => setStatus("Slušam...");
      r.onresult = (e) => {
        const t = e.results[e.results.length - 1][0].transcript;
        handleUserText(t);
      };
      r.onerror = () => {};
      r.onend = () => {
        if (shouldListenRef.current && !speakingRef.current) {
          try {
            r.start();
          } catch {}
        }
      };

      recogRef.current = r;
    }

    try {
      recogRef.current.start();
      setMicOn(true);
    } catch {}
  };

  const stopRecognition = () => {
    shouldListenRef.current = false;
    setMicOn(false);
    setStatus("Mic OFF");
    try {
      recogRef.current?.stop();
    } catch {}
  };

  const toggleMic = () => {
    if (micOn) stopRecognition();
    else {
      shouldListenRef.current = true;
      startRecognition();
    }
  };

  /* ------------------ INIT ------------------ */

  useEffect(() => {
    pushLog(
      "assistant",
      "TBW AI PREMIUM spreman. Reci npr. 'smještaj u Zagrebu'."
    );
  }, []);

  /* ------------------ UI ------------------ */

  return (
    <div style={{ padding: 20, fontFamily: "system-ui", background: "#fff" }}>
      <h1>TBW AI PREMIUM</h1>
      <h3>AI Safety Navigation</h3>

      <p>
        Status: <b>{status}</b> | 🎤 {micOn ? "ON" : "OFF"} | 📍{" "}
        {ctx.city || DEFAULT_CITY}
      </p>

      <div style={{ display: "flex", gap: 8, marginBottom: 10 }}>
        <input
          value={typed}
          onChange={(e) => setTyped(e.target.value)}
          onKeyDown={(e) => e.key === "Enter" && handleUserText(typed)}
          placeholder="Upiši ili govori"
        />
        <button onClick={() => handleUserText(typed)}>SEND</button>
        <button onClick={toggleMic}>{micOn ? "⏹" : "🎤"}</button>
      </div>

      {lastHeard && <div>Čuo sam: {lastHeard}</div>}

      <ul>
        {log.slice(-12).map((m) => (
          <li key={m.ts}>
            <b>{m.role === "assistant" ? "TBW" : "TI"}:</b> {m.text}
          </li>
        ))}
      </ul>
    </div>
  );
}
