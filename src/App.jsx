import { useRef, useState } from "react";

export default function App() {
  const recRef = useRef(null);
  const speakingRef = useRef(false);
  const [active, setActive] = useState(false);
  const [log, setLog] = useState([]);

  function startRecognition() {
    const SR =
      window.SpeechRecognition || window.webkitSpeechRecognition;

    if (!SR) {
      alert("SpeechRecognition nije podržan");
      return;
    }

    const rec = new SR();
    rec.lang = "hr-HR";
    rec.continuous = true;
    rec.interimResults = false;

    rec.onresult = (e) => {
      if (speakingRef.current) return; // ⛔ ignore while speaking

      const text =
        e.results[e.results.length - 1][0].transcript.trim();

      setLog((l) => [...l, "🗣 " + text]);

      speak(text);
    };

    rec.onerror = (e) => {
      setLog((l) => [...l, "❌ " + e.error]);
    };

    rec.start();
    recRef.current = rec;
    setActive(true);
  }

  function stopRecognition() {
    recRef.current?.stop();
    setActive(false);
  }

  function speak(text) {
    if (!text) return;

    speakingRef.current = true;
    recRef.current?.stop(); // 🔇 stop mic while speaking

    const u = new SpeechSynthesisUtterance(
      "Čuo sam: " + text
    );
    u.lang = "hr-HR";
    u.rate = 0.95;
    u.pitch = 1;

    u.onend = () => {
      speakingRef.current = false;
      recRef.current?.start(); // 🎤 resume mic
    };

    window.speechSynthesis.cancel();
    window.speechSynthesis.speak(u);
  }

  return (
    <div style={{ padding: 20 }}>
      <h1>TBW AI PREMIUM – VOICE TEST</h1>

      {!active ? (
        <button onClick={startRecognition}>
          🎤 Pokreni mikrofon
        </button>
      ) : (
        <button onClick={stopRecognition}>
          ⛔ Zaustavi
        </button>
      )}

      <ul>
        {log.map((l, i) => (
          <li key={i}>{l}</li>
        ))}
      </ul>
    </div>
  );
}

