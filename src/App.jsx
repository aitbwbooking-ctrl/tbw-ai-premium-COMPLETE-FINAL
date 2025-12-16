import { useEffect, useRef, useState } from "react";

export default function App() {
  const recognitionRef = useRef(null);
  const startedRef = useRef(false);

  const [text, setText] = useState("");
  const [log, setLog] = useState([]);
  const [listening, setListening] = useState(false);
  const [city, setCity] = useState(null);

  /* ---------- INIT SPEECH (CHROME HARD LOCK) ---------- */
  useEffect(() => {
    if (startedRef.current) return;
    startedRef.current = true;

    const SR =
      window.webkitSpeechRecognition || window.SpeechRecognition;

    if (!SR) {
      console.warn("SpeechRecognition not supported");
      return;
    }

    const rec = new SR();
    rec.lang = "hr-HR";
    rec.continuous = true;
    rec.interimResults = false;

    rec.onstart = () => setListening(true);

    rec.onend = () => {
      setListening(false);
      rec.start(); // AUTO CONTINUE
    };

    rec.onerror = () => {
      setListening(false);
      rec.start();
    };

    rec.onresult = (e) => {
      const t = e.results[e.results.length - 1][0].transcript.trim();
      handleInput(t, true);
    };

    recognitionRef.current = rec;
    rec.start();
  }, []);

  /* ---------- CORE LOGIC ---------- */
  function handleInput(value, isVoice = false) {
    if (!value) return;

    setLog((l) => [...l, value]);

    // DETECT CITY
    const cityMatch = value.match(
      /(zagreb|split|rijeka|zadar|osijek|pula)/i
    );
    if (cityMatch) {
      setCity(cityMatch[0]);
    }

    // AUTO BOOKING
    if (value.toLowerCase().includes("smještaj")) {
      openBooking(city || cityMatch?.[0]);
      speak(
        `U redu. Za koliko osoba tražite smještaj u ${city ||
          cityMatch?.[0]}?`
      );
      return;
    }

    // NORMAL RESPONSE
    speak("Recite slobodno što vas zanima.");
  }

  /* ---------- SPEAK ---------- */
  function speak(msg) {
    const u = new SpeechSynthesisUtterance(msg);
    u.lang = "hr-HR";
    u.rate = 0.95;
    u.pitch = 1.05;
    speechSynthesis.cancel();
    speechSynthesis.speak(u);
  }

  /* ---------- BOOKING ---------- */
  function openBooking(c) {
    if (!c) return;
    const url = `https://www.booking.com/searchresults.html?ss=${encodeURIComponent(
      c
    )}`;
    window.open(url, "_blank");
  }

  /* ---------- UI ---------- */
  return (
    <div style={{ padding: 20, fontFamily: "sans-serif" }}>
      <h2>TBW AI PREMIUM</h2>
      <p>AI Safety Navigation</p>

      <div style={{ marginBottom: 10 }}>
        <input
          value={text}
          onChange={(e) => setText(e.target.value)}
          placeholder="Upiši ili govori"
        />
        <button
          onClick={() => {
            handleInput(text, false);
            setText("");
          }}
        >
          SEND
        </button>
      </div>

      <div>
        <strong>Status:</strong>{" "}
        {listening ? "🎤 Mikrofon aktivan" : "⏸️ Pauza"}
      </div>

      <ul>
        {log.map((l, i) => (
          <li key={i}>{l}</li>
        ))}
      </ul>
    </div>
  );
}

