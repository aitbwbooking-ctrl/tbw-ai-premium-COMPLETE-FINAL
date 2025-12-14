import React, { useRef } from "react";
import { speak } from "../core/voice";

export default function MainSearch({ onOpenBooking, onContextUpdate }) {
  const SR = window.SpeechRecognition || window.webkitSpeechRecognition;
  const recRef = useRef(null);

  const start = () => {
    if (!SR) return;

    const r = new SR();
    r.lang = navigator.language || "hr-HR";
    r.continuous = true;

    r.onresult = (e) => {
      let t = "";
      for (let i = e.resultIndex; i < e.results.length; i++) {
        t += e.results[i][0].transcript;
      }
      if (!t) return;

      const ctx = { raw: t };
      onContextUpdate(ctx);

      if (t.includes("smještaj") || t.includes("apartman")) {
        speak("Razumijem. Otvaram booking.");
        onOpenBooking(ctx);
      }
    };

    r.start();
    recRef.current = r;
  };

  return (
    <button onClick={start} style={{ padding: 16, fontWeight: 900 }}>
      🎙️ GOVORI
    </button>
  );
}
