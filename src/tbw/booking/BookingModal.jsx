import React, { useEffect, useMemo, useRef, useState } from "react";
import ModalShell from "../ui/ModalShell";
import { t } from "../core/i18n";
import { makeRecognizer, speak } from "../core/voice";
import { conciergeActions, conciergeSuggest, detectBookingIntent, extractCity } from "./bookingEngine";

export default function BookingModal({
  open,
  onClose,
  seedPrompt = "",
  cityFallback = "Split",
}) {
  const [listening, setListening] = useState(false);
  const [lastUser, setLastUser] = useState(seedPrompt || "");
  const [intent, setIntent] = useState(null);
  const [city, setCity] = useState(cityFallback);
  const [suggestions, setSuggestions] = useState([]);
  const [whyNot, setWhyNot] = useState([]);
  const recRef = useRef(null);
  const finalTextRef = useRef("");

  const actions = useMemo(() => conciergeActions({ city, intent: intent || "hotel" }), [city, intent]);

  useEffect(() => {
    if (!open) return;

    // Seed
    if (seedPrompt) {
      const i = detectBookingIntent(seedPrompt) || "hotel";
      const c = extractCity(seedPrompt, cityFallback) || cityFallback;
      setIntent(i);
      setCity(c);
      const items = conciergeSuggest({ city: c, intent: i });
      setSuggestions(items.filter((x) => !x.avoid).slice(0, 3));
      setWhyNot(items.filter((x) => x.avoid).slice(0, 2));

      speak(
        `Mogu pomoći. ${i === "hotel" ? "Tražim smještaj" : "Provjeravam opcije" } u gradu ${c}.`,
        { priority: "normal" }
      );
    } else {
      speak("Booking concierge je spreman. Pritisnite mikrofon i recite što trebate.", { priority: "normal" });
    }
  }, [open, seedPrompt, cityFallback]);

  const startListening = () => {
    const r = makeRecognizer({ continuous: true });
    if (!r) {
      speak("Ovaj uređaj ne podržava prepoznavanje govora u pregledniku.", { priority: "critical" });
      return;
    }
    recRef.current = r;
    finalTextRef.current = "";

    r.onresult = (e) => {
      let interim = "";
      for (let i = e.resultIndex; i < e.results.length; i++) {
        const res = e.results[i];
        const txt = res[0]?.transcript || "";
        if (res.isFinal) finalTextRef.current += txt + " ";
        else interim += txt;
      }
      const merged = (finalTextRef.current + interim).trim();
      setLastUser(merged);
    };

    r.onend = () => {
      // Keep alive while modal open and listening
      if (open && listening) {
        try { r.start(); } catch {}
      }
    };

    try {
      r.start();
      setListening(true);
    } catch {
      setListening(false);
    }
  };

  const stopListening = () => {
    setListening(false);
    try { recRef.current?.stop(); } catch {}
    recRef.current = null;

    const text = (lastUser || "").trim();
    if (!text) return;

    const i = detectBookingIntent(text) || "hotel";
    const c = extractCity(text, cityFallback) || cityFallback;

    setIntent(i);
    setCity(c);

    const items = conciergeSuggest({ city: c, intent: i });
    const good = items.filter((x) => !x.avoid).slice(0, 3);
    const bad = items.filter((x) => x.avoid).slice(0, 2);

    setSuggestions(good);
    setWhyNot(bad);

    // 5★ response: short, calm, decisive
    const top = good[0]?.title ? `Preporuka: ${good[0].title}.` : "Imam preporuke.";
    speak(
      `U redu. ${top} Želite li da otvorim rezultate ili da predložim plan B?`,
      { priority: "normal" }
    );
  };

  return (
    <ModalShell open={open} title="TBW 5★ Booking Concierge" onClose={onClose}>
      <div style={s.row}>
        <button
          style={{ ...s.micBtn, ...(listening ? s.micOn : s.micOff) }}
          onClick={() => (listening ? stopListening() : startListening())}
        >
          {listening ? "🎙️ ACTIVE" : "🎙️ TALK"}
        </button>
        <div style={s.meta}>
          <div style={s.metaLine}><b>City:</b> {city || "-"}</div>
          <div style={s.metaLine}><b>Intent:</b> {intent || "-"}</div>
        </div>
      </div>

      <div style={s.userBox}>
        <div style={s.userLabel}>You said:</div>
        <div style={s.userText}>{lastUser || "—"}</div>
      </div>

      <div style={s.section}>
        <div style={s.h}>Top recommendations</div>
        {suggestions.length === 0 ? (
          <div style={s.p}>Say what you need (hotel, taxi, rent-a-car, flight, ferry, train, bus, bike, events, restaurants, sights).</div>
        ) : (
          suggestions.map((x, idx) => (
            <div key={idx} style={s.item}>
              <div style={s.title}>{idx + 1}. {x.title}</div>
              <div style={s.why}>{x.why}</div>
            </div>
          ))
        )}
      </div>

      {whyNot.length > 0 && (
        <div style={s.section}>
          <div style={s.h}>Not recommended (and why)</div>
          {whyNot.map((x, idx) => (
            <div key={idx} style={{ ...s.item, borderColor: "rgba(255,80,80,.25)" }}>
              <div style={s.title}>✕ {x.title}</div>
              <div style={s.why}>{x.why}</div>
            </div>
          ))}
        </div>
      )}

      <div style={s.section}>
        <div style={s.h}>Actions</div>
        <div style={s.actions}>
          {actions.map((a, idx) => (
            <button key={idx} style={s.actBtn} onClick={a.run}>{a.label}</button>
          ))}
        </div>
      </div>

      <div style={{ opacity: 0.7, fontSize: 12, marginTop: 10 }}>
        {t("TBW_EMERGENCY_PULT")}
      </div>
    </ModalShell>
  );
}

const s = {
  row: { display: "flex", gap: 12, alignItems: "center" },
  micBtn: {
    width: 140, padding: "12px 12px", borderRadius: 16,
    border: "1px solid rgba(255,255,255,.12)",
    color: "#e8eef6", fontWeight: 900, cursor: "pointer"
  },
  micOff: { background: "rgba(255,255,255,.06)" },
  micOn: { background: "rgba(0,255,120,.14)" },
  meta: { flex: 1, opacity: 0.9 },
  metaLine: { fontSize: 13, lineHeight: 1.25 },
  userBox: { marginTop: 14, padding: 12, borderRadius: 16, background: "rgba(255,255,255,.04)" },
  userLabel: { fontSize: 12, opacity: 0.75, marginBottom: 6 },
  userText: { fontSize: 14, fontWeight: 700 },
  section: { marginTop: 14 },
  h: { fontSize: 14, fontWeight: 900, marginBottom: 8 },
  p: { opacity: 0.85, fontSize: 13, lineHeight: 1.35 },
  item: { padding: 12, borderRadius: 16, border: "1px solid rgba(255,255,255,.10)", background: "rgba(255,255,255,.03)", marginBottom: 8 },
  title: { fontWeight: 900 },
  why: { fontSize: 13, opacity: 0.85, marginTop: 6, lineHeight: 1.35 },
  actions: { display: "flex", flexWrap: "wrap", gap: 10 },
  actBtn: {
    padding: "10px 12px", borderRadius: 14, cursor: "pointer",
    border: "1px solid rgba(255,255,255,.12)", background: "rgba(255,255,255,.06)", color: "#e8eef6", fontWeight: 800
  }
};
