import React, { useEffect, useRef, useState } from "react";

export default function AISearch({ onOpenBooking }) {
  const [text, setText] = useState("");
  const [listening, setListening] = useState(false);
  const recRef = useRef(null);

  useEffect(() => {
    const SR = window.SpeechRecognition || window.webkitSpeechRecognition;
    if (!SR) {
      alert("Ovaj preglednik ne podržava glasovno prepoznavanje.");
      return;
    }

    const rec = new SR();
    rec.lang = "hr-HR";
    rec.continuous = false;          // ⬅️ KLJUČNO za Android
    rec.interimResults = false;
    rec.maxAlternatives = 1;

    rec.onstart = () => {
      setListening(true);
    };

    rec.onresult = (e) => {
      const transcript = e.results[0][0].transcript;
      setText(transcript);

      const t = transcript.toLowerCase();
      if (
        t.includes("booking") ||
        t.includes("rezerv") ||
        t.includes("hotel") ||
        t.includes("apartman")
      ) {
        onOpenBooking?.();
      }
    };

    rec.onerror = () => {
      setListening(false);
    };

    rec.onend = () => {
      setListening(false); // ⬅️ NE restartamo automatski
    };

    recRef.current = rec;

    return () => {
      try {
        rec.stop();
      } catch {}
    };
  }, [onOpenBooking]);

  const startMic = async () => {
    try {
      await navigator.mediaDevices.getUserMedia({ audio: true });
    } catch {
      alert("TBW treba dozvolu za mikrofon.");
      return;
    }

    try {
      recRef.current.start(); // ⬅️ user click → dozvoljeno
    } catch {}
  };

  const send = () => {
    const t = text.toLowerCase();
    if (
      t.includes("booking") ||
      t.includes("rezerv") ||
      t.includes("hotel") ||
      t.includes("apartman")
    ) {
      onOpenBooking?.();
    }
  };

  return (
    <section className="tbw-card">
      <div className="tbw-card-title">TBW AI Search</div>

      <div className="tbw-row">
        <input
          className="tbw-input"
          value={text}
          onChange={(e) => setText(e.target.value)}
          placeholder="Upiši ili klikni 🎤 i govori…"
        />

        <button className="tbw-mic" onClick={startMic}>
          {listening ? "🔴" : "🎤"}
        </button>

        <button className="tbw-send" onClick={send}>
          SEND
        </button>
      </div>

      <div className="tbw-hint">
        {listening
          ? "Slušam… govori sada."
          : "Klikni 🎤 za glasovno pretraživanje."}
      </div>
    </section>
  );
}

