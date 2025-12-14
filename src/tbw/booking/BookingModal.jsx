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

  const [listening, setListening] = useState(false);
  const [log, setLog] = useState([]);

  const [state, setState] = useState({
    city: null,
    persons: null,
    dates: null,
    priorities: [],
  });

  /* ========== INIT ========= */
  useEffect(() => {
    if (!open) {
      stopVoice();
      setLog([]);
      setState({
        city: null,
        persons: null,
        dates: null,
        priorities: [],
      });
      return;
    }

    if (context?.raw) {
      extractFromContext(context.raw);
    }

    speak(
      "Mogu li vam pomoći u izboru najpovoljnijeg smještaja? Recite za koliko osoba tražite i koje su vam želje.",
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

  /* ========== PROCESS ========= */
  const extractFromContext = (text) => {
    const dates = parseHumanDates(text);
    if (dates) setState((s) => ({ ...s, dates }));
  };

  const handleInput = (text) => {
    setLog((l) => [...l, { from: "user", text }]);

    const dates = parseHumanDates(text);
    if (dates) {
      setState((s) => ({ ...s, dates }));
    }

    const num = text.match(/\d+/);
    if (num) {
      setState((s) => ({ ...s, persons: num[0] }));
      speak(`U redu. ${num[0]} osoba. Imate li budžet ili posebne zahtjeve?`);
      return;
    }

    if (text.toLowerCase().includes("pokaži") || text.toLowerCase().includes("nađi")) {
      const url = buildAffiliateUrl(state);
      window.open(url, "_blank");
      speak("Otvaram najbolje dostupne opcije prema vašim kriterijima.");
      return;
    }

    speak("Razumijem. Možete mi reći još detalja ili reći pokaži ponudu.");
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

