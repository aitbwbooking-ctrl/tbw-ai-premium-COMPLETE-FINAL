import React, { useEffect, useRef, useState } from "react";
import ModalShell from "../ui/ModalShell";
import { speak } from "../core/voice";
import { parseHumanDates } from "../core/dateParser";
import { buildAffiliateUrl } from "../core/affiliate";

const PAUSE = 1200;

export default function BookingModal({ open, onClose, context }) {
  const SR = window.SpeechRecognition || window.webkitSpeechRecognition;

  const recRef = useRef(null);
  const timerRef = useRef(null);

  const [listening, setListening] = useState(false);
  const [conversation, setConversation] = useState([]);
  const [state, setState] = useState({
    city: context?.city || null,
    persons: null,
    dates: context?.dates || null,
    priorities: [],
  });

  useEffect(() => {
    if (!open) return stop();

    speak(
      "Mogu li vam pomoći u izboru najpovoljnijeg smještaja? Recite za koliko osoba tražite i koji su vam prioriteti.",
      { priority: "normal" }
    );

    start();
    // eslint-disable-next-line
  }, [open]);

  const start = () => {
    if (!SR) return;
    stop();

    const r = new SR();
    r.lang = navigator.language || "hr-HR";
    r.interimResults = true;
    r.continuous = true;

    r.onresult = (e) => {
      let t = "";
      for (let i = e.resultIndex; i < e.results.length; i++) {
        t += e.results[i][0].transcript;
      }
      if (!t) return;

      clearTimeout(timerRef.current);
      timerRef.current = setTimeout(() => process(t), PAUSE);
    };

    r.start();
    recRef.current = r;
    setListening(true);
  };

  const stop = () => {
    try { recRef.current?.stop(); } catch {}
    setListening(false);
  };

  const process = (text) => {
    setConversation((c) => [...c, { from: "user", text }]);

    const dates = parseHumanDates(text);
    if (dates) setState((s) => ({ ...s, dates }));

    if (text.match(/\d+/)) {
      const p = text.match(/\d+/)[0];
      setState((s) => ({ ...s, persons: p }));
      speak(`U redu, ${p} osoba. Imate li budžet ili posebne zahtjeve?`);
      return;
    }

    if (text.includes("pokaži") || text.includes("nađi")) {
      const url = buildAffiliateUrl(state);
      window.open(url, "_blank");
      speak("Otvaram najpovoljnije opcije prema vašim kriterijima.");
    }
  };

  return (
    <ModalShell open={open} title="TBW 5★ Booking Concierge" onClose={onClose}>
      <div style={{ opacity: 0.9 }}>
        🎙️ {listening ? "Razgovor aktivan" : "—"}
      </div>

      <div style={{ marginTop: 14 }}>
        {conversation.map((c, i) => (
          <div key={i}><b>{c.from}:</b> {c.text}</div>
        ))}
      </div>
    </ModalShell>
  );
}

