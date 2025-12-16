import { useRef, useState } from "react";

export default function App() {
  const recRef = useRef(null);
  const [active, setActive] = useState(false);
  const [log, setLog] = useState([]);

  function startVoice() {
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
      const text =
        e.results[e.results.length - 1][0].transcript;
      setLog((l) => [...l, "🗣 " + text]);

      // odgovor glasom (DOZVOLJENO jer je nakon klika)
      const u = new SpeechSynthesisUtterance(
        "Čuo sam: " + text
      );
      u.lang = "hr-HR";
      window.speechSynthesis.cancel();
      window.speechSynthesis.speak(u);
    };

    rec.onerror = (e) => {
      setLog((l) => [...l, "❌ " + e.error]);
    };

    rec.start();
    recRef.current = rec;
    setActive(true);
  }

  function stopVoice() {
    recRef.current?.stop();
    setActive(false);
  }

  return (
    <div style={{ padding: 20 }}>
      <h1>TBW AI PREMIUM – VOICE TEST</h1>

      {!active ? (
        <button onClick={startVoice}>
          🎤 Pokreni mikrofon
        </button>
      ) : (
        <button onClick={stopVoice}>
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

