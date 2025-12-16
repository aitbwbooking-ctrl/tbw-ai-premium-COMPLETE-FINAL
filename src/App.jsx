import { useEffect, useRef, useState } from "react";
import "./App.css";

/* =========================
   TBW AI PREMIUM – STABLE
   ========================= */

export default function App() {
  const [messages, setMessages] = useState([]);
  const [input, setInput] = useState("");
  const [listening, setListening] = useState(false);
  const [city, setCity] = useState(null);
  const [bookingOpen, setBookingOpen] = useState(false);

  const recognitionRef = useRef(null);
  const speakingRef = useRef(false);
  const greetedRef = useRef(false);

  /* ---------- SPEAK ---------- */
  const speak = (text) => {
    if (!window.speechSynthesis) return;

    speakingRef.current = true;
    recognitionRef.current?.stop();

    const utter = new SpeechSynthesisUtterance(text);
    utter.lang = "hr-HR";
    utter.rate = 0.95;
    utter.pitch = 1.1;

    utter.onend = () => {
      speakingRef.current = false;
      startListening();
    };

    window.speechSynthesis.cancel();
    window.speechSynthesis.speak(utter);
  };

  /* ---------- LISTEN ---------- */
  const startListening = () => {
    if (speakingRef.current) return;
    if (!recognitionRef.current) return;

    try {
      recognitionRef.current.start();
      setListening(true);
    } catch {}
  };

  const stopListening = () => {
    try {
      recognitionRef.current?.stop();
      setListening(false);
    } catch {}
  };

  /* ---------- HANDLE USER ---------- */
  const handleUser = (text) => {
    if (!text) return;

    setMessages((m) => [...m, { role: "user", text }]);

    // CITY DETECTION
    const cityMatch = text.match(/zagreb|split|rijeka|osijek|zadar/i);
    if (cityMatch && !city) {
      const detectedCity =
        cityMatch[0].charAt(0).toUpperCase() + cityMatch[0].slice(1);
      setCity(detectedCity);
    }

    // BOOKING TRIGGER
    if (/smještaj|hotel|booking|apartman/i.test(text)) {
      setBookingOpen(true);
    }

    respond(text);
  };

  /* ---------- AI RESPONSE ---------- */
  const respond = (text) => {
    let reply = "";

    if (!city) {
      reply = "Za koji grad tražite smještaj?";
    } else if (!bookingOpen) {
      reply = `Tražite smještaj u gradu ${city}. Koliko osoba dolazi i za koje datume?`;
      setBookingOpen(true);
    } else {
      reply = `U redu. Tražim smještaj u gradu ${city}. Recite mi još datume i broj osoba.`;
    }

    setMessages((m) => [...m, { role: "ai", text: reply }]);
    speak(reply);
  };

  /* ---------- INIT ---------- */
  useEffect(() => {
    const SR =
      window.SpeechRecognition || window.webkitSpeechRecognition;
    if (!SR) return;

    const rec = new SR();
    rec.lang = "hr-HR";
    rec.continuous = true;
    rec.interimResults = false;

    rec.onresult = (e) => {
      if (speakingRef.current) return;
      const transcript =
        e.results[e.results.length - 1][0].transcript.trim();
      handleUser(transcript);
    };

    rec.onerror = () => stopListening();
    rec.onend = () => {
      if (!speakingRef.current) startListening();
    };

    recognitionRef.current = rec;

    if (!greetedRef.current) {
      greetedRef.current = true;
      const greet = "Kako vam mogu pomoći?";
      setMessages([{ role: "ai", text: greet }]);
      speak(greet);
    }
  }, []);

  /* ---------- UI ---------- */
  return (
    <div className="app">
      <header className="header">
        <h1>TBW AI PREMIUM</h1>
        <button onClick={() => setBookingOpen(true)}>BOOKING</button>
      </header>

      <section className="hero">
        <h2>AI Safety Navigation</h2>
        <p>
          Navigation is active. Booking, safety and concierge assist
          automatically when needed.
        </p>
        <span className="status">● Navigation running</span>
      </section>

      <section className="chat">
        {messages.map((m, i) => (
          <div key={i} className={`msg ${m.role}`}>
            {m.text}
          </div>
        ))}
      </section>

      <section className="input">
        <input
          value={input}
          onChange={(e) => setInput(e.target.value)}
          placeholder="Upiši ili klikni 🎤 i reci što trebaš"
        />
        <button
          onClick={() => {
            handleUser(input);
            setInput("");
          }}
        >
          SEND
        </button>
        <button
          className={listening ? "mic active" : "mic"}
          onClick={() =>
            listening ? stopListening() : startListening()
          }
        >
          🎤
        </button>
      </section>

      {bookingOpen && (
        <div className="modal">
          <div className="modal-box">
            <h3>TBW 5★ Booking Concierge</h3>
            <p>
              {city
                ? `Pretražujem smještaj za grad ${city}.`
                : "Odaberite grad."}
            </p>
            <button
              onClick={() =>
                window.open(
                  `https://www.booking.com/searchresults.html?ss=${city || ""}`,
                  "_blank"
                )
              }
            >
              Open booking search
            </button>
            <button onClick={() => setBookingOpen(false)}>
              Zatvori
            </button>
          </div>
        </div>
      )}
    </div>
  );
}

