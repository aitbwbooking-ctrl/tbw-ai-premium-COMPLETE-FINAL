import React, { useEffect, useRef, useState } from "react";
import ModalShell from "../ui/ModalShell";
import { speak } from "../core/voice";
import { parseHumanDates } from "../core/dateParser";
import { buildAffiliateUrl } from "../core/affiliate";

const PAUSE_MS = 1200;

export default function BookingModal({ open, onClose, context }) {
  const SR = window.SpeechRecognition || window.webkitSpeechRecognition;

  const recRef = useRef(null);
  const timerRef = useRef(null);
  const openedRef = useRef(false); // ⬅️ sprječava duplo otvaranje

  const [listening, setListening] = useState(false);
  const [log, setLog] = useState([]);

  const [state, setState] = useState({
    city: null,
    persons: null,
    dates: null,
    intent: null,
  });

  /* ========== INIT ========= */
  useEffect(() => {
    if (!open) {
      stopVoice();
      openedRef.current = false;
      setLog([]);
      setState({
        city: null,
        persons: null,
        dates: null,
        intent: null,
      });
      return;
    }

    if (context?.raw) {
      bootstrapFromContext(context.raw);
    }

    speak(
      "U redu. Pronalazim najpovoljnije opcije. Recite još samo za koliko osoba.",
      { priority: "normal" }
    );

    startVoice();
    // eslint-disable-next-line
  }, [open]);

  /* ========== VOICE ========= */
  const startVoice = () => {
    if (!SR) return;

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

      clearTimeout(timerRef.current);
      timerRef.current = setTimeout(() => handleInput(txt), PAUSE_MS);
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

  /* ========== CONTEXT ========= */
  const bootstrapFromContext = (text) => {
    const lower = text.toLowerCase();

    if (lower.includes("najpovoljn")) {
      setState((s) => ({ ...s, intent: "cheap" }));
    }

    const dates = parseHumanDates(text);
    if (dates) {
      setState((s) => ({ ...s, dates }));
    }
  };

  /* ========== PROCESS ========= */
  const handleInput = (text) => {
    setLog((l) => [...l, { from: "user", text }]);

    const lower = text.toLowerCase();

    // persons
    const num = text.match(/\d+/);
    if (num) {
      setState((s) => ({ ...s, persons: num[0] }));
      speak(`U redu. ${num[0]} osoba.`);
    }

    // intent
    if (
      lower.includes("najpovoljn") ||
      lower.includes("jeftin") ||
      lower.includes("apartman") ||
      lower.includes("hotel")
    ) {
      setState((s) => ({ ...s, intent: "stay" }));
    }

    // dates
    const dates = parseHumanDates(text);
    if (dates) {
      setState((s) => ({ ...s, dates }));
    }

    tryAutoOpen();
  };

  /* ========== AUTO OPEN ========= */
  const tryAutoOpen = () => {
    if (openedRef.current) return;

    const filled =
      (state.intent ? 1 : 0) +
      (state.persons ? 1 : 0) +
      (state.dates ? 1 : 0);

    if (filled >= 2) {
      openedRef.current = true;

      speak("Otvaram najbolje dostupne ponude prema vašim kriterijima.");

      const url = buildAffiliateUrl(state);
      window.open(url, "_blank");
    }
  };

  return (
    <ModalShell open={open} title="TBW 5★ Booking Concierge" onClose={onClose}>
      <div style={{ opacity: 0.9 }}>
        🎙️ {listening ? "Razgovor aktivan" : "—"}
      </div>

      <div style={{ marginTop: 14 }}>
        {log.map((x, i) => (
          <div key={i}>
            <b>{x.from}:</b> {x.text}
          </div>
        ))}
      </div>
    </ModalShell>
  );
}

