import React, { useEffect, useMemo, useRef, useState } from "react";

/**
 * TBW AI PREMIUM — App.jsx (mobile-first)
 * POPRAVAK:
 * 1) Deduplikacija govora (nema ponavljanja)
 * 2) Booking se otvara za TOČNO prepoznati grad
 * 3) Razgovor se nastavlja nakon Bookinga
 */

const DEFAULT_CITY = "Zagreb";

/* ---------------- HELPERS ---------------- */

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
  "zagreb","split","zadar","rijeka","osijek","dubrovnik","pula","karlovac",
  "sibenik","makarska","varazdin","slavonski brod","vukovar","trogir",
  "opatija","krk","hvar","brac","korcula",
];

const titleCase = (s) =>
  s.split(" ").map(w => w ? w[0].toUpperCase() + w.slice(1) : w).join(" ");

function detectCity(text) {
  const t = normalize(text);
  for (const c of CITY_ALIASES) {
    const re = new RegExp(`\\b${c}\\b`, "i");
    if (re.test(t)) return titleCase(c);
  }
  const m = t.match(/\bu\s+([a-zčćđšž]+)/i);
  if (m && CITY_ALIASES.includes(normalize(m[1]))) return titleCase(m[1]);
  return null;
}

function detectIntent(text) {
  const t = normalize(text);
  return {
    accommodation:
      t.includes("smjestaj") || t.includes("smještaj") ||
      t.includes("hotel") || t.includes("apartman") ||
      t.includes("booking") || t.includes("airbnb"),
  };
}

function parseGuests(text) {
  const t = normalize(text);
  const map = { jedno:1, dvoje:2, troje:3, cetvero:4, petero:5 };
  for (const k in map) if (t.includes(k)) return map[k];
  const m = t.match(/\b(\d{1,2})\b/);
  return m ? parseInt(m[1],10) : null;
}

function buildBookingUrl({ city, guests }) {
  const p = new URLSearchParams();
  p.set("ss", city || DEFAULT_CITY);
  if (guests) {
    p.set("group_adults", guests);
    p.set("no_rooms", 1);
  }
  return `https://www.booking.com/searchresults.hr.html?${p.toString()}`;
}

/* ---------------- UI HELPERS ---------------- */

const Chip = ({ children }) => (
  <span style={{
    padding:"6px 10px",borderRadius:999,fontSize:12,
    background:"rgba(255,255,255,0.06)",border:"1px solid rgba(255,255,255,0.08)"
  }}>{children}</span>
);

const Card = ({ title, children }) => (
  <div style={{
    background:"rgba(255,255,255,0.06)",
    border:"1px solid rgba(255,255,255,0.1)",
    borderRadius:18,padding:14
  }}>
    {title && <div style={{fontWeight:700,marginBottom:10}}>{title}</div>}
    {children}
  </div>
);

/* ---------------- APP ---------------- */

export default function App() {
  const [typed, setTyped] = useState("");
  const [log, setLog] = useState([]);
  const [status, setStatus] = useState("Spremno");
  const [micOn, setMicOn] = useState(false);

  const [ctx, setCtx] = useState({
    city: DEFAULT_CITY,
    guests: null,
    bookingOpenedForCity: null,
  });

  const recogRef = useRef(null);
  const lastProcessedRef = useRef(""); // 🔒 DEDUP

  const SpeechRecognition = useMemo(
    () => window.SpeechRecognition || window.webkitSpeechRecognition || null,
    []
  );

  const pushLog = (role, text) =>
    setLog((l) => [...l, { role, text, ts: Date.now() }]);

  const speak = (text) => {
    if (!("speechSynthesis" in window)) return;
    const u = new SpeechSynthesisUtterance(text);
    u.lang = "hr-HR";
    window.speechSynthesis.cancel();
    window.speechSynthesis.speak(u);
  };

  /* -------- CORE HANDLER (POPRAVLJEN) -------- */

  const handleUserText = (raw) => {
    const text = raw.trim();
    if (!text) return;

    const norm = normalize(text);
    if (norm === lastProcessedRef.current) return; // ✅ NEMA DUPLIKATA
    lastProcessedRef.current = norm;

    pushLog("user", text);

    const detectedCity = detectCity(text);
    const guests = parseGuests(text);
    const intent = detectIntent(text);

    const nextCity = detectedCity || ctx.city;

    setCtx((c) => ({
      ...c,
      city: nextCity,
      guests: guests ?? c.guests,
    }));

    if (intent.accommodation) {
      const url = buildBookingUrl({ city: nextCity, guests });
      if (ctx.bookingOpenedForCity !== nextCity) {
        window.open(url, "_blank");
        setCtx((c) => ({ ...c, bookingOpenedForCity: nextCity }));
      }

      let reply = `Otvorio sam smještaj u ${nextCity}.`;
      if (!guests) reply += " Koliko osoba?";
      pushLog("assistant", reply);
      speak(reply);
      return;
    }

    const fallback = `U redu. Reci npr. "smještaj u ${nextCity}".`;
    pushLog("assistant", fallback);
    speak(fallback);
  };

  /* -------- MIC -------- */

  const toggleMic = () => {
    if (!SpeechRecognition) {
      setStatus("Voice not supported");
      return;
    }

    if (!recogRef.current) {
      const r = new SpeechRecognition();
      r.lang = "hr-HR";
      r.continuous = true;
      r.onresult = (e) => {
        const res = e.results[e.results.length - 1][0].transcript;
        handleUserText(res);
      };
      recogRef.current = r;
    }

    if (!micOn) {
      recogRef.current.start();
      setMicOn(true);
      setStatus("Slušam...");
    } else {
      recogRef.current.stop();
      setMicOn(false);
      setStatus("Spremno");
    }
  };

  const onSend = () => {
    handleUserText(typed);
    setTyped("");
  };

  /* ---------------- UI ---------------- */

  return (
    <div style={{minHeight:"100vh",padding:20,color:"#fff",background:"#05060A"}}>
      <h2>TBW AI PREMIUM</h2>
      <h3>AI Safety Navigation</h3>

      <div style={{display:"flex",gap:10}}>
        <Chip>📍 {ctx.city}</Chip>
        <Chip>🎤 {micOn ? "ON" : "OFF"}</Chip>
      </div>

      <Card title="TBW AI Search">
        <input
          value={typed}
          onChange={(e)=>setTyped(e.target.value)}
          placeholder="Upiši ili govori"
        />
        <button onClick={onSend}>SEND</button>
        <button onClick={toggleMic}>🎤</button>
        <div>Status: {status}</div>
      </Card>

      <Card title="Conversation">
        {log.slice(-6).map(m=>(
          <div key={m.ts}>
            <b>{m.role==="assistant"?"TBW":"TI"}:</b> {m.text}
          </div>
        ))}
      </Card>
    </div>
  );
}

