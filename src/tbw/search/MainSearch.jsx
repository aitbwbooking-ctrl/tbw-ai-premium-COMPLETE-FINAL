import React, { useRef, useState } from "react";
import { speak } from "../core/voice";

const PAUSE_MS = 1200;

export default function MainSearch({ onContextUpdate, onOpenBooking }) {
  const SR = window.SpeechRecognition || window.webkitSpeechRecognition;

  const recRef = useRef(null);
  const timerRef = useRef(null);

  const [listening, setListening] = useState(false);
  const [liveText, setLiveText] = useState("");
  const [typed, setTyped] = useState("");

  /* ========== VOICE ========= */
  const startVoice = () => {
    if (!SR) {
      speak("Mikrofon nije podržan. Koristite unos teksta.");
      return;
    }

    stopVoice();

    const r = new SR();
    r.lang = navigator.language || "hr-HR";
    r.continuous = true;
    r.interimResults = true;

    r.onresult = (e) => {
      let txt = "";
      for (let i = e.resultIndex; i < e.results.length; i++) {
        txt += e.results[i][0].transcript;
      }
      txt = txt.trim();
      if (!txt) return;

      setLiveText(txt);

      clearTimeout(timerRef.current);
      timerRef.current = setTimeout(() => {
        processQuery(txt);
      }, PAUSE_MS);
    };

    r.start();
    recRef.current = r;
    setListening(true);
  };

  const stopVoice = () => {
    try {
      recRef.current?.stop();
    } catch {}
    setListening(false);
  };

  /* ========== PROCESS ========= */
  const processQuery = (query) => {
    const ctx = { raw: query };
    onContextUpdate(ctx);

    const q = query.toLowerCase();

    if (
      q.includes("booking") ||
      q.includes("smještaj") ||
      q.includes("apartman") ||
      q.includes("hotel")
    ) {
      speak("Razumijem. Otvaram booking.");
      onOpenBooking(ctx);
      return;
    }

    speak("Razumijem. Ako želite, mogu otvoriti booking ili pomoći s navigacijom.");
  };

  /* ========== TEXT ========= */
  const submitText = () => {
    if (!typed.trim()) return;
    processQuery(typed.trim());
    setTyped("");
  };

  return (
    <div style={{ marginTop: 20 }}>
      <button
        onClick={listening ? stopVoice : startVoice}
        style={{
          padding: 16,
          width: "100%",
          borderRadius: 16,
          fontWeight: 900,
          background: listening ? "rgba(0,255,120,.25)" : "rgba(255,255,255,.08)",
          border: "1px solid rgba(255,255,255,.15)",
          color: "#e8eef6",
        }}
      >
        🎙️ {listening ? "SLUŠAM (STOP)" : "GOVORI"}
      </button>

      <div style={{ marginTop: 10, opacity: 0.9 }}>
        <b>Rečeno:</b> {liveText || "—"}
      </div>

      {/* TEXT INPUT */}
      <div style={{ display: "flex", gap: 10, marginTop: 14 }}>
        <input
          value={typed}
          onChange={(e) => setTyped(e.target.value)}
          placeholder="Upiši ako ne želiš govoriti…"
          style={{
            flex: 1,
            padding: 12,
            borderRadius: 14,
            border: "1px solid rgba(255,255,255,.12)",
            background: "rgba(255,255,255,.05)",
            color: "#e8eef6",
            fontWeight: 700,
          }}
        />
        <button
          onClick={submitText}
          style={{
            width: 120,
            padding: 12,
            borderRadius: 14,
            fontWeight: 900,
            background: "rgba(0,255,153,.85)",
            border: "none",
            color: "#04110b",
          }}
        >
          POŠALJI
        </button>
      </div>
    </div>
  );
}

