import { useEffect, useRef, useState } from "react";

export default function App() {
  const recognitionRef = useRef(null);
  const speakingRef = useRef(false);

  const [input, setInput] = useState("");
  const [log, setLog] = useState([]);
  const [mode, setMode] = useState("idle"); // idle | booking
  const [step, setStep] = useState("city"); // city | persons | dates | done
  const [memory, setMemory] = useState({
    city: null,
    persons: null,
    dates: null,
  });
  const [bookingOpen, setBookingOpen] = useState(false);

  /* ---------- VOICE OUTPUT ---------- */
  function speak(text) {
    if (!window.speechSynthesis) return;
    if (speakingRef.current) return;

    speakingRef.current = true;
    const u = new SpeechSynthesisUtterance(text);
    u.lang = "hr-HR";
    u.rate = 0.95;
    u.pitch = 1.1;
    u.onend = () => (speakingRef.current = false);
    window.speechSynthesis.cancel();
    window.speechSynthesis.speak(u);
  }

  /* ---------- HANDLE USER INPUT ---------- */
  function handleText(text) {
    if (!text) return;

    setLog((l) => [...l, "🗣️ " + text]);

    const lower = text.toLowerCase();

    // trigger booking
    if (
      lower.includes("smještaj") ||
      lower.includes("hotel") ||
      lower.includes("apartman")
    ) {
      setMode("booking");
    }

    // CITY
    if (!memory.city && mode === "booking") {
      setMemory((m) => ({ ...m, city: text }));
      setStep("persons");
      speak("Za koliko osoba tražite smještaj?");
      return;
    }

    // PERSONS
    if (memory.city && !memory.persons && mode === "booking") {
      const num = text.match(/\d+/);
      if (num) {
        setMemory((m) => ({ ...m, persons: num[0] }));
        setStep("dates");
        speak("Za koje datume?");
        return;
      }
      speak("Molim recite broj osoba.");
      return;
    }

    // DATES
    if (memory.city && memory.persons && !memory.dates && mode === "booking") {
      setMemory((m) => ({ ...m, dates: text }));
      setStep("done");
      setBookingOpen(true);
      speak(
        `Otvaram booking za ${memory.city}, ${memory.persons} osoba.`
      );
      return;
    }

    if (mode === "idle") {
      speak("Kako vam mogu pomoći?");
    }
  }

  /* ---------- MICROPHONE ---------- */
  useEffect(() => {
    const SR =
      window.SpeechRecognition || window.webkitSpeechRecognition;
    if (!SR) return;

    const r = new SR();
    r.lang = "hr-HR";
    r.continuous = true;
    r.interimResults = false;

    r.onresult = (e) => {
      const t = e.results[e.results.length - 1][0].transcript.trim();
      handleText(t);
    };

    r.onend = () => {
      r.start(); // keep alive
    };

    recognitionRef.current = r;
    r.start();

    speak("Sustav aktivan. Slobodno govorite.");

    return () => r.stop();
  }, [memory, mode]);

  /* ---------- MANUAL SEND ---------- */
  function manualSend() {
    handleText(input);
    setInput("");
  }

  /* ---------- BOOKING URL ---------- */
  const bookingUrl =
    bookingOpen &&
    `https://www.booking.com/searchresults.hr.html?ss=${encodeURIComponent(
      memory.city || ""
    )}`;

  /* ---------- UI ---------- */
  return (
    <div style={{ padding: 20, fontFamily: "system-ui" }}>
      <h1>TBW AI PREMIUM</h1>
      <h2>AI Safety Navigation</h2>

      <div style={{ marginBottom: 10 }}>
        <input
          value={input}
          onChange={(e) => setInput(e.target.value)}
          placeholder="Upiši ili govori"
        />
        <button onClick={manualSend}>SEND</button>
      </div>

      <div>
        <strong>Status:</strong> 🎤 Mikrofon aktivan
      </div>

      <ul>
        {log.map((l, i) => (
          <li key={i}>{l}</li>
        ))}
      </ul>

      {bookingOpen && (
        <div style={{ marginTop: 20, padding: 10, border: "1px solid #444" }}>
          <h3>TBW ★ Booking Concierge</h3>
          <p>
            Grad: <b>{memory.city}</b>
            <br />
            Osobe: <b>{memory.persons}</b>
            <br />
            Datumi: <b>{memory.dates}</b>
          </p>
          <a href={bookingUrl} target="_blank">
            Otvori booking pretragu
          </a>
        </div>
      )}
    </div>
  );
}

