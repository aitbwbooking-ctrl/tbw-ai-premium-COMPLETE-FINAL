import React, { useEffect, useRef, useState } from "react";
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
  seedPrompt = "",
}) {
  const SR = window.SpeechRecognition || window.webkitSpeechRecognition;

  const recRef = useRef(null);
  const keepAliveRef = useRef(false);

  const [listening, setListening] = useState(false);
  const [transcript, setTranscript] = useState("");
  const [typed, setTyped] = useState("");
  const [intent, setIntent] = useState(null);
  const [city, setCity] = useState(cityFallback);
  const [suggestions, setSuggestions] = useState([]);

  // reset on open/close
  useEffect(() => {
    if (!open) {
      stopMic();
      setTranscript("");
      setTyped("");
      setSuggestions([]);
      setIntent(null);
      setCity(cityFallback);
      return;
    }

    // seed prompt (if app passed something)
    if (seedPrompt) {
      setTyped(seedPrompt);
      // no auto-speak on open (silent policy)
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open]);

  const applyQuery = (q) => {
    const query = (q || "").trim();
    if (!query) return;

    const i = detectBookingIntent(query) || "hotel";
    const c = extractCity(query, cityFallback) || cityFallback;

    setIntent(i);
    setCity(c);

    const list = conciergeSuggest({ city: c, intent: i });
    setSuggestions(list.filter((x) => !x.avoid).slice(0, 3));

    // TTS is allowed here because it is user-initiated flow (query/voice)
    speak(`U redu. Opcije za ${i} u gradu ${c}.`, { priority: "normal" });
  };

  const startMic = () => {
    if (!SR) {
      // PC fallback: show message and rely on text input
      speak("Ovaj uređaj ne podržava prepoznavanje govora. Koristite unos teksta.", {
        priority: "critical",
      });
      return;
    }

    // stop any previous instance
    stopMic();

    keepAliveRef.current = true;
    setListening(true);

    const r = new SR();
    r.lang = navigator.language || "hr-HR";
    r.interimResults = true;
    r.continuous = true;

    r.onresult = (e) => {
      let live = "";
      for (let i = e.resultIndex; i < e.results.length; i++) {
        live += e.results[i][0].transcript;
      }
      const text = (live || "").trim();
      if (text) setTranscript(text);
    };

    r.onerror = () => {
      // do not loop aggressively; switch off but keep UI usable
      keepAliveRef.current = false;
      setListening(false);
    };

    r.onend = () => {
      // browser can end recognition unexpectedly (mobile power saving etc.)
      if (keepAliveRef.current && open) {
        try {
          r.start();
        } catch {
          // if restart fails, just stop
          keepAliveRef.current = false;
          setListening(false);
        }
      } else {
        setListening(false);
      }
    };

    try {
      r.start(); // MUST be direct user gesture -> onClick
      recRef.current = r;
    } catch {
      keepAliveRef.current = false;
      setListening(false);
    }
  };

  const stopMic = () => {
    keepAliveRef.current = false;
    try {
      recRef.current?.stop();
    } catch {}
    recRef.current = null;
    setListening(false);
  };

  const commitVoiceQuery = () => {
    // user says something, then taps "POŠALJI" to process
    applyQuery(transcript);
  };

  const commitTypedQuery = () => {
    applyQuery(typed);
  };

  return (
    <ModalShell open={open} title="TBW 5★ Booking Concierge" onClose={onClose}>
      {/* MIC CONTROLS */}
      <div style={{ display: "flex", gap: 10 }}>
        <button
          onClick={listening ? stopMic : startMic}
          style={{
            flex: 1,
            padding: "14px",
            borderRadius: 16,
            fontWeight: 900,
            background: listening ? "rgba(0,255,120,.25)" : "rgba(255,255,255,.08)",
            border: "1px solid rgba(255,255,255,.15)",
            color: "#e8eef6",
          }}
        >
          🎙️ {listening ? "STOP" : "GOVORI (1x klik)"}
        </button>

        <button
          onClick={commitVoiceQuery}
          style={{
            width: 140,
            padding: "14px",
            borderRadius: 16,
            fontWeight: 900,
            background: "rgba(255,255,255,.06)",
            border: "1px solid rgba(255,255,255,.12)",
            color: "#e8eef6",
          }}
        >
          POŠALJI
        </button>
      </div>

      <div style={{ marginTop: 12, opacity: 0.9 }}>
        <b>Rečeno:</b> {transcript || "—"}
      </div>

      {/* TEXT INPUT (MANDATORY) */}
      <div style={{ marginTop: 14, display: "flex", gap: 10 }}>
        <input
          value={typed}
          onChange={(e) => setTyped(e.target.value)}
          placeholder="Upiši: npr. najjeftiniji smještaj Karlovac za Novu godinu…"
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
          onClick={commitTypedQuery}
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
          SEND
        </button>
      </div>

      {/* SUGGESTIONS */}
      {suggestions.length > 0 && (
        <div style={{ marginTop: 16 }}>
          <b>Preporuke:</b>
          {suggestions.map((s, i) => (
            <div key={i} style={{ marginTop: 10 }}>
              <div style={{ fontWeight: 900 }}>{s.title}</div>
              <div style={{ fontSize: 13, opacity: 0.8 }}>{s.why}</div>
            </div>
          ))}
        </div>
      )}

      {/* ACTIONS */}
      <div style={{ marginTop: 16 }}>
        {conciergeActions({ city, intent }).map((a, i) => (
          <button
            key={i}
            onClick={a.run}
            style={{
              marginTop: 10,
              width: "100%",
              padding: 12,
              borderRadius: 14,
              background: "rgba(255,255,255,.06)",
              border: "1px solid rgba(255,255,255,.12)",
              color: "#e8eef6",
              fontWeight: 900,
            }}
          >
            {a.label}
          </button>
        ))}
      </div>
    </ModalShell>
  );
}

