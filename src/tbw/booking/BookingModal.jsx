import React, { useRef, useState } from "react";
import ModalShell from "../ui/ModalShell";
import { speak } from "../core/voice";
import {
  detectBookingIntent,
  extractCity,
  conciergeSuggest,
  conciergeActions,
} from "./bookingEngine";

export default function BookingModal({
  open,
  onClose,
  cityFallback = "Split",
}) {
  const recRef = useRef(null);
  const [listening, setListening] = useState(false);
  const [transcript, setTranscript] = useState("");
  const [intent, setIntent] = useState(null);
  const [city, setCity] = useState(cityFallback);
  const [suggestions, setSuggestions] = useState([]);

  // 🔒 USER-GESTURE ONLY
  const startMic = () => {
    const SR = window.SpeechRecognition || window.webkitSpeechRecognition;
    if (!SR) {
      speak("Ovaj uređaj ne podržava prepoznavanje govora.", {
        priority: "critical",
      });
      return;
    }

    const r = new SR();
    r.lang = navigator.language || "hr-HR";
    r.interimResults = true;
    r.continuous = false;

    r.onresult = (e) => {
      let final = "";
      for (let i = 0; i < e.results.length; i++) {
        final += e.results[i][0].transcript;
      }
      setTranscript(final.trim());
    };

    r.onend = () => {
      setListening(false);

      if (!transcript) return;

      const i = detectBookingIntent(transcript) || "hotel";
      const c = extractCity(transcript, cityFallback) || cityFallback;

      setIntent(i);
      setCity(c);

      const list = conciergeSuggest({ city: c, intent: i });
      setSuggestions(list.filter((x) => !x.avoid).slice(0, 3));

      speak(
        `U redu. Pronašao sam opcije za ${i} u gradu ${c}.`,
        { priority: "normal" }
      );
    };

    setTranscript("");
    setListening(true);
    r.start();
    recRef.current = r;
  };

  return (
    <ModalShell open={open} title="TBW 5★ Booking Concierge" onClose={onClose}>
      <button
        onClick={startMic}
        style={{
          width: "100%",
          padding: "14px",
          borderRadius: 16,
          fontWeight: 900,
          background: listening ? "rgba(0,255,120,.25)" : "rgba(255,255,255,.08)",
          border: "1px solid rgba(255,255,255,.15)",
          color: "#e8eef6",
        }}
      >
        🎙️ {listening ? "SLUŠAM…" : "GOVORI"}
      </button>

      <div style={{ marginTop: 14, opacity: 0.85 }}>
        <b>Rečeno:</b> {transcript || "—"}
      </div>

      {suggestions.length > 0 && (
        <div style={{ marginTop: 16 }}>
          <b>Preporuke:</b>
          {suggestions.map((s, i) => (
            <div key={i} style={{ marginTop: 8 }}>
              <div style={{ fontWeight: 800 }}>{s.title}</div>
              <div style={{ fontSize: 13, opacity: 0.8 }}>{s.why}</div>
            </div>
          ))}
        </div>
      )}

      <div style={{ marginTop: 16 }}>
        {conciergeActions({ city, intent }).map((a, i) => (
          <button
            key={i}
            onClick={a.run}
            style={{
              marginTop: 8,
              width: "100%",
              padding: 10,
              borderRadius: 12,
              background: "rgba(255,255,255,.06)",
              border: "1px solid rgba(255,255,255,.12)",
              color: "#e8eef6",
              fontWeight: 800,
            }}
          >
            {a.label}
          </button>
        ))}
      </div>
    </ModalShell>
  );
}

