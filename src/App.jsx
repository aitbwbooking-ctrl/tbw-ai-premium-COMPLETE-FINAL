import React, { useEffect, useMemo, useRef, useState } from "react";

/*
 TBW AI PREMIUM – FINAL STATE MACHINE
 - Global city detection (ANY CITY IN WORLD)
 - Booking flow resets on city change
 - No repeated phrases
 - Booking opens with correct city
 - Conversation continues after Booking
 - Mobile safe (mic pause handled)
*/

const DEFAULT_CITY = "Zagreb";

/* =========================
   NORMALIZATION
========================= */
const normalize = (s = "") =>
  s
    .toLowerCase()
    .replace(/[čć]/g, "c")
    .replace(/đ/g, "d")
    .replace(/[š]/g, "s")
    .replace(/[ž]/g, "z")
    .trim();

/* =========================
   CITY DETECTION – GLOBAL
========================= */
function detectCity(text) {
  if (!text) return null;

  const t = normalize(text);

  // remove booking words
  const cleaned = t
    .replace(/\b(smjestaj|smještaj|booking|hotel|apartman|nocenje|rezervacija|book)\b/g, "")
    .replace(/\b(u|za|na)\b/g, "")
    .trim();

  if (!cleaned) return null;

  // Title Case every word (works for ALL cities worldwide)
  return cleaned
    .split(" ")
    .map(w => w.charAt(0).toUpperCase() + w.slice(1))
    .join(" ");
}

/* =========================
   INTENT
========================= */
function detectIntent(text) {
  const t = normalize(text);
  return {
    accommodation:
      t.includes("smjestaj") ||
      t.includes("smještaj") ||
      t.includes("booking") ||
      t.includes("hotel") ||
      t.includes("apartman"),
  };
}

/* =========================
   GUESTS
========================= */
function parseGuests(text) {
  const t = normalize(text);
  const words = {
    jedan: 1,
    dvoje: 2,
    troje: 3,
    cetiri: 4,
    pet: 5,
    sest: 6,
  };

  for (const k in words) {
    if (t.includes(k)) return words[k];
  }

  const m = t.match(/\b(\d{1,2})\b/);
  if (m) return parseInt(m[1], 10);

  return null;
}

/* =========================
   BOOKING URL
========================= */
function buildBookingUrl(city, guests) {
  const p = new URLSearchParams();
  p.set("ss", city);
  p.set("group_adults", guests || 2);
  p.set("no_rooms", 1);
  return `https://www.booking.com/searchresults.hr.html?${p.toString()}`;
}

/* =========================
   APP
========================= */
export default function App() {
  const [input, setInput] = useState("");
  const [log, setLog] = useState([]);
  const [status, setStatus] = useState("Spremno");
  const [micOn, setMicOn] = useState(false);

  const [ctx, setCtx] = useState({
    city: DEFAULT_CITY,
    guests: null,
    intent: null,
    awaitingGuests: false,
  });

  const recogRef = useRef(null);
  const SpeechRecognition =
    window.SpeechRecognition || window.webkitSpeechRecognition || null;

  /* =========================
     LOG
  ========================= */
  const push = (role, text) =>
    setLog(l => [...l, { role, text, ts: Date.now() }]);

  /* =========================
     CORE HANDLER
  ========================= */
  const handleText = (raw) => {
    const text = raw.trim();
    if (!text) return;

    push("user", text);

    const detectedCity = detectCity(text);
    const intent = detectIntent(text);
    const guests = parseGuests(text);

    setCtx(prev => {
      let next = { ...prev };

      // 🔴 CITY CHANGE = HARD RESET
      if (detectedCity && detectedCity !== prev.city) {
        next.city = detectedCity;
        next.guests = null;
        next.intent = null;
        next.awaitingGuests = false;
      }

      if (intent.accommodation) {
        next.intent = "accommodation";
      }

      if (guests) {
        next.guests = guests;
        next.awaitingGuests = false;
      }

      return next;
    });

    setTimeout(() => respond(text, detectedCity, intent, guests), 0);
  };

  /* =========================
     RESPONSE LOGIC
  ========================= */
  const respond = (_, detectedCity, intent, guests) => {
    setCtx(current => {
      const city = detectedCity || current.city;

      // BOOKING FLOW
      if (intent?.accommodation || current.intent === "accommodation") {
        if (!current.guests && !guests) {
          push("assistant", `U redu. Otvaram Booking za ${city}. Koliko osoba?`);
          setStatus("Čekam broj osoba");
          window.open(buildBookingUrl(city, 2), "_blank");
          return { ...current, city, awaitingGuests: true };
        }

        if (guests || current.guests) {
          const g = guests || current.guests;
          push("assistant", `Tražim smještaj za ${g} osoba u ${city}.`);
          window.open(buildBookingUrl(city, g), "_blank");
          setStatus("Booking otvoren");
          return {
            city,
            guests: g,
            intent: null,
            awaitingGuests: false,
          };
        }
      }

      // CITY ONLY
      if (detectedCity && !intent?.accommodation) {
        push(
          "assistant",
          `OK. ${city}. Reci npr. "smještaj u ${city}" ili "booking ${city} za 2 osobe".`
        );
      }

      return current;
    });
  };

  /* =========================
     VOICE
  ========================= */
  const toggleMic = () => {
    if (!SpeechRecognition) {
      setStatus("Voice nije podržan");
      return;
    }

    if (!recogRef.current) {
      const r = new SpeechRecognition();
      r.lang = "hr-HR";
      r.continuous = true;

      r.onresult = e => {
        const txt = e.results[e.results.length - 1][0].transcript;
        handleText(txt);
      };

      r.onend = () => setMicOn(false);
      recogRef.current = r;
    }

    if (!micOn) {
      recogRef.current.start();
      setMicOn(true);
      setStatus("Slušam...");
    } else {
      recogRef.current.stop();
      setMicOn(false);
      setStatus("Zaustavljeno");
    }
  };

  /* =========================
     UI
  ========================= */
  return (
    <div style={{ minHeight: "100vh", background: "#000", color: "#fff", padding: 20 }}>
      <h1>TBW AI PREMIUM</h1>
      <p>AI Safety Navigation</p>

      <div>
        📍 {ctx.city} | 🎤 {micOn ? "ON" : "OFF"}
      </div>

      <input
        value={input}
        onChange={e => setInput(e.target.value)}
        placeholder="Upiši ili govori"
      />
      <button onClick={() => { handleText(input); setInput(""); }}>
        SEND
      </button>
      <button onClick={toggleMic}>🎤</button>

      <p>Status: {status}</p>

      <hr />

      {log.map((m, i) => (
        <div key={i}>
          <b>{m.role === "user" ? "TI" : "TBW"}:</b> {m.text}
        </div>
      ))}
    </div>
  );
  }
