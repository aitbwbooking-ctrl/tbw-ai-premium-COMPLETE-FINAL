import { useEffect, useRef, useState } from "react";
import "./App.css";

/* ===============================
   TBW AI PREMIUM – FINAL APP.JSX
   =============================== */

const SpeechRecognition =
  window.SpeechRecognition || window.webkitSpeechRecognition;

export default function App() {
  const recognitionRef = useRef(null);
  const listeningRef = useRef(false);

  const [input, setInput] = useState("");
  const [messages, setMessages] = useState([]);
  const [context, setContext] = useState({
    city: null,
    people: null,
    reason: null,
    booking: false,
  });

  /* -------------------------------
     SPEECH SYNTHESIS (VOICE)
  -------------------------------- */
  const speak = (text) => {
    if (!window.speechSynthesis) return;
    const utter = new SpeechSynthesisUtterance(text);
    utter.lang = "hr-HR";
    utter.rate = 0.95;
    utter.pitch = 1.1;
    window.speechSynthesis.cancel();
    window.speechSynthesis.speak(utter);
  };

  /* -------------------------------
     SPEECH RECOGNITION INIT
  -------------------------------- */
  useEffect(() => {
    if (!SpeechRecognition) return;

    const rec = new SpeechRecognition();
    rec.lang = "hr-HR";
    rec.continuous = true;
    rec.interimResults = false;

    rec.onresult = (e) => {
      const text = e.results[e.results.length - 1][0].transcript.trim();
      handleUserMessage(text, true);
    };

    rec.onerror = () => {
      listeningRef.current = false;
    };

    rec.onend = () => {
      if (listeningRef.current) rec.start();
    };

    recognitionRef.current = rec;
  }, []);

  /* -------------------------------
     START / STOP MIC
  -------------------------------- */
  const toggleMic = () => {
    if (!recognitionRef.current) return;

    if (listeningRef.current) {
      recognitionRef.current.stop();
      listeningRef.current = false;
    } else {
      recognitionRef.current.start();
      listeningRef.current = true;
      speak("Slušam. Slobodno recite.");
    }
  };

  /* -------------------------------
     MAIN AI LOGIC
  -------------------------------- */
  const handleUserMessage = (text, fromMic = false) => {
    setMessages((m) => [...m, { role: "user", text }]);

    let newContext = { ...context };

    /* --- CITY DETECTION --- */
    const cityMatch = text.match(
      /(zagreb|split|rijeka|osijek|zadar|karlovac)/i
    );
    if (cityMatch) newContext.city = cityMatch[0];

    /* --- BOOKING INTENT --- */
    if (
      text.match(
        /(smještaj|hotel|apartman|booking|noćenje|nova godina)/i
      )
    ) {
      newContext.booking = true;
    }

    setContext(newContext);

    /* --- RESPONSE LOGIC --- */
    let response = "";

    if (newContext.booking) {
      if (!newContext.city) {
        response = "Za koji grad tražite smještaj?";
      } else if (!newContext.people) {
        response = `U redu, ${newContext.city}. Koliko osoba dolazi?`;
      } else {
        response = `Otvaram ponude smještaja za ${newContext.city}.`;
        openBooking(newContext.city);
      }
    } else {
      response = "Kako vam mogu pomoći?";
    }

    setMessages((m) => [...m, { role: "ai", text: response }]);
    speak(response);
  };

  /* -------------------------------
     BOOKING OPEN (AUTO)
  -------------------------------- */
  const openBooking = (city) => {
    const url = `https://www.booking.com/searchresults.hr.html?ss=${encodeURIComponent(
      city
    )}`;
    window.open(url, "_blank");
  };

  /* -------------------------------
     SEND BUTTON (TEXT ONLY)
  -------------------------------- */
  const sendText = () => {
    if (!input.trim()) return;
    handleUserMessage(input, false);
    setInput("");
  };

  /* ===============================
     UI
  =============================== */
  return (
    <div className="app">
      <header className="header">
        <h1>TBW AI PREMIUM</h1>
        <button className="booking-btn">BOOKING</button>
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
        <div className="messages">
          {messages.map((m, i) => (
            <div key={i} className={m.role}>
              {m.text}
            </div>
          ))}
        </div>

        <div className="input-bar">
          <button className="mic" onClick={toggleMic}>
            🎤
          </button>

          <input
            value={input}
            onChange={(e) => setInput(e.target.value)}
            placeholder="Upiši ili govori..."
          />

          <button className="send" onClick={sendText}>
            SEND
          </button>
        </div>
      </section>

      <footer className="status-bar">
        Sustav aktivan – AI navigacija i booking engine spremni.
      </footer>
    </div>
  );
}

