import React, { useEffect, useRef, useState } from "react";
import BookingModal from "./tbw/booking/BookingModal";
import Header from "./tbw/layout/Header";
import Hero from "./tbw/layout/Hero";
import AISearch from "./tbw/search/AISearch";
import StatusPanel from "./tbw/status/StatusPanel";
import { speak } from "./tbw/core/voice";

export default function App() {
  const SR = window.SpeechRecognition || window.webkitSpeechRecognition;

  const recRef = useRef(null);
  const speakingRef = useRef(false);
  const silenceTimer = useRef(null);

  const [bookingOpen, setBookingOpen] = useState(false);
  const [lastUtterance, setLastUtterance] = useState("");
  const [systemRunning, setSystemRunning] = useState(true);

  /* ================= VOICE ENGINE ================= */

  const startListening = () => {
    if (!SR) return;

    stopListening();

    const r = new SR();
    r.lang = navigator.language || "hr-HR";
    r.continuous = true;
    r.interimResults = false;

    r.onresult = (e) => {
      if (speakingRef.current) return;

      const text =
        e.results[e.results.length - 1][0].transcript?.trim();
      if (!text) return;

      setLastUtterance(text);

      clearTimeout(silenceTimer.current);
      silenceTimer.current = setTimeout(() => {
        handleFinalSpeech(text);
      }, 1200);
    };

    r.start();
    recRef.current = r;
  };

  const stopListening = () => {
    try {
      recRef.current?.stop();
    } catch {}
  };

  /* ================= HUMAN LOGIC ================= */

  const handleFinalSpeech = (text) => {
    const lower = text.toLowerCase();

    if (
      lower.includes("smještaj") ||
      lower.includes("hotel") ||
      lower.includes("apartman") ||
      lower.includes("booking")
    ) {
      openBooking(text);
    }
  };

  const openBooking = (raw) => {
    if (bookingOpen) return;

    speakSafe(
      "U redu. Otvaram booking i pomažem vam pronaći najbolju opciju.",
      () => setBookingOpen(true)
    );
  };

  /* ================= SPEAK SAFE ================= */

  const speakSafe = (text, after) => {
    speakingRef.current = true;
    stopListening();

    speak(text, {
      onEnd: () => {
        speakingRef.current = false;
        startListening();
        after && after();
      },
    });
  };

  /* ================= INIT ================= */

  useEffect(() => {
    startListening();
    return () => stopListening();
    // eslint-disable-next-line
  }, []);

  /* ================= UI ================= */

  return (
    <>
      <Header />

      <Hero />

      <AISearch
        systemRunning={systemRunning}
        onOpenBooking={() => openBooking(lastUtterance)}
      />

      <StatusPanel />

      <BookingModal
        open={bookingOpen}
        onClose={() => setBookingOpen(false)}
        context={{ raw: lastUtterance }}
      />
    </>
  );
}

