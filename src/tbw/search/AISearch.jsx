import React, { useEffect, useRef, useState } from "react";

export default function AISearch({ onOpenBooking }) {
  const [text, setText] = useState("");
  const [listening, setListening] = useState(false);
  const recRef = useRef(null);

  useEffect(() => {
    const SR = window.SpeechRecognition || window.webkitSpeechRecognition;
    if (!SR) return;

    const rec = new SR();
    rec.lang = navigator.language || "hr-HR";
    rec.continuous = true;
    rec.interimResults = false;
    rec.maxAlternatives = 1;

    rec.onresult = (e) => {
      const last = e.results?.[e.results.length - 1];
      const transcript = last?.[0]?.transcript?.trim();
      if (!transcript) return;

      setText(transcript);

      // AUTO-AKCIJA: ako user kaže "booking", "rezerviraj", "apartman", otvori booking
      const t = transcript.toLowerCase();
      if (
        t.includes("booking") ||
        t.includes("rezerv") ||
        t.includes("apartman") ||
        t.includes("hotel")
      ) {
        onOpenBooking?.();
      }
    };

    rec.onerror = () => {
      // ništa agresivno - web SR zna “aborted/no-speech”
    };

    rec.onend = () => {
      // Ako je mic uključen, pokušaj nastaviti (ali bez spam start-a)
      if (listening) {
        try {
          rec.start();
        } catch {}
      }
    };

    recRef.current = rec;

    return () => {
      try {
        rec.stop();
      } catch {}
      recRef.current = null;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [listening]);

  const toggleMic = async () => {
    const rec = recRef.current;
    if (!rec) {
      alert("Mikrofon nije podržan na ovom browseru. Koristi Chrome.");
      return;
    }

    if (!listening) {
      // user gesture → traži browser permission za mic (stabilno)
      try {
        await navigator.mediaDevices.getUserMedia({ audio: true });
      } catch {
        alert("TBW ne može raditi bez dozvole za mikrofon.");
        return;
      }

      setListening(true);
      try {
        rec.start();
      } catch {}
    } else {
      setListening(false);
      try {
        rec.stop();
      } catch {}
    }
  };

  const send = () => {
    // Ovdje kasnije vežemo TBW AI logiku; sad samo stabiliziramo input/mic
    // Za sada: ako user upiše/izgovori "booking" → otvori booking
    const t = (text || "").toLowerCase();
    if (
      t.includes("booking") ||
      t.includes("rezerv") ||
      t.includes("apartman") ||
      t.includes("hotel")
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
          placeholder="Upiši ili klikni 🎤 i reci što trebaš…"
        />

        <button className="tbw-mic" onClick={toggleMic} aria-label="Mic">
          {listening ? "🔴" : "🎤"}
        </button>

        <button className="tbw-send" onClick={send}>
          SEND
        </button>
      </div>

      <div className="tbw-hint">
        {listening
          ? "Mikrofon je aktivan. Pričaj normalno."
          : "Klikni 🎤 za glas ili koristi tipkovnicu."}
      </div>
    </section>
  );
}
