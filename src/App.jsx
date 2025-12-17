import React, { useEffect, useMemo, useRef, useState } from "react";

/**
 * TBW AI PREMIUM — App.jsx (mobile-first)
 * FINAL STABLE VERSION
 */

const DEFAULT_CITY = "Zagreb";

/* ===================== HELPERS ===================== */

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

const titleCase = (s) =>
  s
    .split(" ")
    .map((w) => w.charAt(0).toUpperCase() + w.slice(1))
    .join(" ");

const detectCity = (text) => {
  const t = normalize(text);
  for (const c of CITY_ALIASES) {
    if (t.includes(c)) return titleCase(c);
  }
  return null;
};

const detectIntent = (text) => {
  const t = normalize(text);
  return {
    accommodation:
      t.includes("smjestaj") ||
      t.includes("hotel") ||
      t.includes("apartman") ||
      t.includes("booking"),
  };
};

const parseGuests = (text) => {
  const m = normalize(text).match(/\b(\d{1,2})\b/);
  return m ? parseInt(m[1], 10) : null;
};

const buildBookingUrl = ({ city, guests }) => {
  const params = new URLSearchParams();
  params.set("ss", city || DEFAULT_CITY);
  if (guests) {
    params.set("group_adults", guests);
    params.set("no_rooms", 1);
  }
  return `https://www.booking.com/searchresults.hr.html?${params.toString()}`;
};

/* ===================== UI HELPERS ===================== */

const Chip = ({ children }) => (
  <span
    style={{
      padding: "6px 10px",
      borderRadius: 999,
      background: "rgba(255,255,255,0.08)",
      fontSize: 12,
    }}
  >
    {children}
  </span>
);

const Card = ({ title, children }) => (
  <div
    style={{
      borderRadius: 18,
      padding: 14,
      background: "rgba(255,255,255,0.06)",
      border: "1px solid rgba(255,255,255,0.10)",
      boxShadow: "0 12px 30px rgba(0,0,0,0.25)",
    }}
  >
    {title && (
      <div style={{ fontWeight: 800, marginBottom: 10 }}>{title}</div>
    )}
    {children}
  </div>
);

const Modal = ({ open, onClose, title, children }) => {
  if (!open) return null;
  return (
    <div
      onClick={onClose}
      style={{
        position: "fixed",
        inset: 0,
        background: "rgba(0,0,0,0.55)",
        display: "flex",
        justifyContent: "center",
        alignItems: "center",
        zIndex: 9999,
      }}
    >
      <div
        onClick={(e) => e.stopPropagation()}
        style={{
          width: "min(520px, 100%)",
          borderRadius: 18,
          background: "#0e121e",
          padding: 16,
        }}
      >
        <div style={{ fontWeight: 900, marginBottom: 12 }}>{title}</div>
        {children}
      </div>
    </div>
  );
};

/* ===================== APP ===================== */

export default function App() {
  const [typed, setTyped] = useState("");
  const [log, setLog] = useState([]);
  const [status, setStatus] = useState("Spremno");
  const [micOn, setMicOn] = useState(false);
  const [ctx, setCtx] = useState({
    city: DEFAULT_CITY,
    guests: null,
  });

  const [bookingOpen, setBookingOpen] = useState(false);
  const recogRef = useRef(null);

  const SpeechRecognition = useMemo(
    () => window.SpeechRecognition || window.webkitSpeechRecognition || null,
    []
  );

  const pushLog = (role, text) =>
    setLog((p) => [...p, { role, text, id: Date.now() }]);

  const speak = (text) => {
    if (!("speechSynthesis" in window)) return;
    const u = new SpeechSynthesisUtterance(text);
    u.lang = "hr-HR";
    window.speechSynthesis.cancel();
    window.speechSynthesis.speak(u);
  };

  const handleUserText = (text) => {
    pushLog("user", text);

    const city = detectCity(text) || ctx.city;
    const guests = parseGuests(text) || ctx.guests;
    const intent = detectIntent(text);

    setCtx({ city, guests });

    if (intent.accommodation) {
      const url = buildBookingUrl({ city, guests });
      window.open(url, "_blank");
      setBookingOpen(true);
      const msg = `Otvaram smještaj za ${city}.`;
      pushLog("assistant", msg);
      speak(msg);
      return;
    }

    const msg = `U redu. Reci npr. "smještaj u ${city}".`;
    pushLog("assistant", msg);
    speak(msg);
  };

  const toggleMic = () => {
    if (!SpeechRecognition) {
      setStatus("Voice nije podržan");
      return;
    }

    if (!micOn) {
      const r = new SpeechRecognition();
      r.lang = "hr-HR";
      r.continuous = true;
      r.onresult = (e) => {
        const t = e.results[e.results.length - 1][0].transcript;
        handleUserText(t);
      };
      r.start();
      recogRef.current = r;
      setMicOn(true);
    } else {
      recogRef.current?.stop();
      setMicOn(false);
    }
  };

  /* ===================== STYLES ===================== */

  const pageStyle = {
    minHeight: "100vh",
    background:
      "linear-gradient(180deg, #070A12 0%, #05060A 100%)",
    color: "#fff",
    padding: 16,
  };

  const heroStyle = {
    padding: 18,
    borderRadius: 22,
    border: "1px solid rgba(255,255,255,0.10)",
    background:
      "linear-gradient(180deg, rgba(255,255,255,0.06), rgba(255,255,255,0.03))",
    boxShadow: "0 18px 50px rgba(0,0,0,0.35)",
    backdropFilter: "blur(10px)",
  };

  /* ===================== RENDER ===================== */

  return (
    <div style={pageStyle}>
      <div style={heroStyle}>
        <h1>TBW AI PREMIUM</h1>
        <p>AI Safety Navigation</p>

        <div style={{ display: "flex", gap: 10 }}>
          <Chip>📍 {ctx.city}</Chip>
          <Chip>🎤 {micOn ? "ON" : "OFF"}</Chip>
        </div>

        <Card title="TBW AI Search">
          <input
            value={typed}
            onChange={(e) => setTyped(e.target.value)}
            placeholder="Upiši ili govori"
            style={{ width: "100%", padding: 10 }}
          />

          <div style={{ display: "flex", gap: 10, marginTop: 10 }}>
            <button onClick={() => handleUserText(typed)}>SEND</button>
            <button onClick={toggleMic}>🎤</button>
          </div>

          <div style={{ marginTop: 10 }}>Status: {status}</div>
        </Card>

        <Card title="Conversation">
          {log.map((m) => (
            <div key={m.id}>
              <b>{m.role === "assistant" ? "TBW" : "TI"}:</b> {m.text}
            </div>
          ))}
        </Card>
      </div>

      <Modal open={bookingOpen} onClose={() => setBookingOpen(false)} title="Booking">
        Booking otvoren u novom tabu.
      </Modal>
    </div>
  );
}

