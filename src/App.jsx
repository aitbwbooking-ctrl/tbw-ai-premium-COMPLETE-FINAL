import React, { useEffect, useMemo, useRef, useState } from "react";

export default function App() {
  // ===== Core state =====
  const [query, setQuery] = useState("");
  const [heard, setHeard] = useState("");
  const [status, setStatus] = useState("Navigation running");
  const [micState, setMicState] = useState("idle"); // idle | listening | processing | error
  const [micGranted, setMicGranted] = useState(false);
  const [srSupported, setSrSupported] = useState(true);

  // Booking concierge
  const [bookingOpen, setBookingOpen] = useState(false);
  const [bookingHeard, setBookingHeard] = useState("");
  const [bookingRecs, setBookingRecs] = useState([]);

  // ===== Speech Recognition (STT) =====
  const recognitionRef = useRef(null);
  const listeningRef = useRef(false);
  const lastStartAtRef = useRef(0);

  // Prevent multiple permission prompts
  const micWarmupDoneRef = useRef(false);

  const SpeechRecognitionClass =
    typeof window !== "undefined"
      ? window.SpeechRecognition || window.webkitSpeechRecognition
      : null;

  useEffect(() => {
    if (!SpeechRecognitionClass) {
      setSrSupported(false);
      setStatus("Voice not supported on this browser");
      return;
    }

    try {
      const r = new SpeechRecognitionClass();
      r.continuous = false; // IMPORTANT for mobile stability
      r.interimResults = false;
      r.maxAlternatives = 1;
      r.lang = "hr-HR";

      r.onstart = () => {
        listeningRef.current = true;
        setMicState("listening");
        setStatus("Microphone is active. Speak normally.");
        console.log("[TBW] SR start");
      };

      r.onresult = (event) => {
        try {
          const text =
            event?.results?.[0]?.[0]?.transcript?.trim?.() ||
            "";
          if (text) {
            setHeard(text);
            setQuery(text);
            setStatus("Heard. Ready.");
          } else {
            setStatus("No speech detected.");
          }
        } catch {
          setStatus("Speech result error.");
        }
      };

      r.onerror = (e) => {
        // Typical mobile errors: "no-speech", "aborted", "not-allowed"
        console.warn("[TBW] SR error:", e?.error, e);
        listeningRef.current = false;

        if (e?.error === "not-allowed" || e?.error === "service-not-allowed") {
          setMicGranted(false);
          setMicState("error");
          setStatus("Microphone permission denied.");
          return;
        }

        // IMPORTANT: do NOT auto-restart (causes loops on Android)
        setMicState("error");
        setStatus(
          e?.error === "no-speech"
            ? "No speech detected. Tap again and speak."
            : e?.error === "aborted"
            ? "Listening stopped. Tap again."
            : "Voice error. Tap again."
        );
      };

      r.onend = () => {
        listeningRef.current = false;
        setMicState((prev) => (prev === "listening" ? "idle" : prev));
        console.log("[TBW] SR end");
      };

      recognitionRef.current = r;
    } catch (err) {
      console.error("[TBW] SR init failed:", err);
      setSrSupported(false);
      setStatus("Voice init failed on this browser");
    }

    return () => {
      try {
        recognitionRef.current?.abort?.();
      } catch {}
      recognitionRef.current = null;
    };
  }, []);

  // ===== Speech Synthesis (TTS) =====
  const canSpeak = useMemo(() => {
    return typeof window !== "undefined" && "speechSynthesis" in window;
  }, []);

  function speak(text) {
    try {
      if (!canSpeak || !text) return;
      window.speechSynthesis.cancel();
      const u = new SpeechSynthesisUtterance(text);
      u.lang = "hr-HR";
      u.rate = 1.0;
      u.pitch = 1.0;
      window.speechSynthesis.speak(u);
    } catch (e) {
      console.warn("[TBW] TTS failed:", e);
    }
  }

  // ===== Mic button behavior (IMPORTANT: user gesture only) =====
  async function warmupMicOnce() {
    if (micWarmupDoneRef.current) return;
    micWarmupDoneRef.current = true;

    // This triggers a single permission prompt in many browsers,
    // then we stop tracks immediately to avoid “busy mic”.
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      setMicGranted(true);
      stream.getTracks().forEach((t) => t.stop());
    } catch (e) {
      setMicGranted(false);
      // keep warmupDoneRef true to avoid infinite prompts
      console.warn("[TBW] getUserMedia denied:", e);
    }
  }

  async function startListening() {
    if (!srSupported) {
      setStatus("Voice not supported on this browser");
      return;
    }
    const r = recognitionRef.current;
    if (!r) {
      setStatus("Voice not ready");
      return;
    }

    // Prevent rapid double-start (mobile taps)
    const now = Date.now();
    if (now - lastStartAtRef.current < 700) return;
    lastStartAtRef.current = now;

    // If already listening, stop
    if (listeningRef.current) {
      try {
        r.stop();
      } catch {}
      return;
    }

    setMicState("processing");
    setStatus("Preparing microphone…");

    await warmupMicOnce();

    // Start recognition (no loops)
    try {
      r.start();
    } catch (e) {
      // If start called too soon after end, some browsers throw
      console.warn("[TBW] SR start throw:", e);
      setMicState("error");
      setStatus("Voice start failed. Tap again.");
    }
  }

  // ===== Simple “AI” reply mock (your real AI later) =====
  function buildReply(text) {
    const t = (text || "").toLowerCase();
    if (!t.trim()) return "Napiši ili reci što trebaš.";

    if (t.includes("karlovac") && (t.includes("smještaj") || t.includes("hotel") || t.includes("nova godina") || t.includes("novu godinu"))) {
      return "Razumijem. Otvaram TBW Booking Concierge s preporukama za Karlovac (Nova godina).";
    }

    if (t.includes("bok") || t.includes("pozdrav")) return "Bok! Reci gdje ideš i što ti treba.";
    if (t.includes("navigacija") || t.includes("route") || t.includes("put")) return "Navigacija je aktivna. Reci odakle i kamo ideš.";
    return "OK. Reci detalje (grad, datum, budžet) i predložit ću najbolje opcije.";
  }

  function onSend() {
    const text = query.trim();
    if (!text) return;

    setStatus("Processing…");
    const reply = buildReply(text);

    // If it looks like booking request, open concierge
    const t = text.toLowerCase();
    const bookingIntent =
      t.includes("smještaj") ||
      t.includes("hotel") ||
      t.includes("apartman") ||
      t.includes("booking") ||
      t.includes("nova godina") ||
      t.includes("novu godinu");

    if (bookingIntent) {
      openBookingConcierge(text);
    }

    setStatus("System active");
    // TTS: on desktop should speak; on some mobiles may be restricted until user gesture
    speak(reply);
  }

  function openBookingConcierge(spokenText) {
    setBookingHeard(spokenText);

    // Lightweight, stable “recommendations” like your screenshot
    const recs = [
      {
        title: "Family-friendly hotel (24h reception, parking)",
        subtitle: "Late arrivals + family safety, predictable service.",
        tag: "SAFE",
      },
      {
        title: "Quiet boutique stay (low-noise, central, well-lit)",
        subtitle: "Less stress after long drive; easy walkable center.",
        tag: "CALM",
      },
    ];

    setBookingRecs(recs);
    setBookingOpen(true);
  }

  function bookingSearchUrl() {
    // Very simple booking.com search URL. You can later replace with partner/affiliate parameters.
    const q = encodeURIComponent(bookingHeard || query || "Karlovac smještaj");
    return `https://www.booking.com/searchresults.html?ss=${q}`;
  }

  // ===== UI =====
  const s = styles;

  return (
    <div style={s.page}>
      <header style={s.header}>
        <div style={s.brand}>TBW AI PREMIUM</div>
        <button
          style={s.bookingBtn}
          onClick={() => openBookingConcierge(query || "Smještaj i booking preporuke")}
        >
          BOOKING
        </button>
      </header>

      <main style={s.main}>
        <section style={s.heroCard}>
          <div style={s.heroTitle}>AI Safety Navigation</div>
          <div style={s.heroSub}>
            Navigation is active. Booking, safety and concierge assist automatically when needed.
          </div>

          <div style={s.dotRow}>
            <span style={s.dot} />
            <span style={s.dotText}>Navigation running</span>
          </div>
        </section>

        <section style={s.searchWrap}>
          <div style={s.searchCard}>
            <div style={s.searchTitle}>TBW AI Search</div>

            <div style={s.searchRow}>
              <input
                style={s.input}
                value={query}
                onChange={(e) => setQuery(e.target.value)}
                placeholder="Upiši ili klikni 🎤 i reci što trebaš"
              />

              <button
                style={{
                  ...s.micBtn,
                  ...(micState === "listening" ? s.micBtnLive : null),
                }}
                onClick={startListening}
                aria-label="Mic"
                title={micState === "listening" ? "Stop" : "Start"}
              >
                {micState === "listening" ? "●" : "🎤"}
              </button>

              <button style={s.sendBtn} onClick={onSend}>
                SEND
              </button>
            </div>

            <div style={s.smallInfo}>
              {srSupported ? (
                micState === "listening" ? (
                  <span>🎙️ Mikrofon je aktivan. Pričaj normalno.</span>
                ) : micGranted ? (
                  <span>✅ Mikrofon dopušten. Klikni 🎤 i govori.</span>
                ) : (
                  <span>ℹ️ Klikni 🎤 da odobriš mikrofon (ako te pita).</span>
                )
              ) : (
                <span>⚠️ Ovaj browser nema SpeechRecognition. Probaj Chrome/Edge.</span>
              )}
            </div>

            {heard ? (
              <div style={s.heardLine}>
                <span style={s.heardLabel}>Rečeno:</span> <span>{heard}</span>
              </div>
            ) : null}
          </div>

          <div style={s.statusCard}>
            <div style={s.dotRow}>
              <span style={s.dot} />
              <span style={s.dotText}>Sustav aktivan</span>
            </div>
            <div style={s.statusSub}>
              {status}
            </div>
          </div>
        </section>
      </main>

      {/* Booking Concierge Modal */}
      {bookingOpen ? (
        <div style={s.modalOverlay} onClick={() => setBookingOpen(false)}>
          <div style={s.modal} onClick={(e) => e.stopPropagation()}>
            <div style={s.modalTop}>
              <div style={s.modalTitle}>TBW 5★ Booking Concierge</div>
              <button style={s.modalClose} onClick={() => setBookingOpen(false)}>
                ×
              </button>
            </div>

            <button style={s.modalSpeakBtn} onClick={startListening}>
              🎤 GOVORI
            </button>

            <div style={s.modalBlock}>
              <div style={s.modalLabel}>Rečeno:</div>
              <div style={s.modalText}>{bookingHeard || heard || query || "-"}</div>
            </div>

            <div style={s.modalBlock}>
              <div style={s.modalLabel}>Preporuke:</div>

              <div style={s.recList}>
                {bookingRecs.map((r, idx) => (
                  <div key={idx} style={s.recCard}>
                    <div style={s.recTitle}>{r.title}</div>
                    <div style={s.recSub}>{r.subtitle}</div>
                  </div>
                ))}
              </div>
            </div>

            <div style={s.modalBtns}>
              <a href={bookingSearchUrl()} target="_blank" rel="noreferrer" style={s.modalBtnPrimary}>
                Open booking search
              </a>
              <button
                style={s.modalBtn}
                onClick={() => {
                  speak("Plan B: sigurnije alternative. Reci budžet i datume.");
                  setStatus("Plan B ready");
                }}
              >
                Show Plan B (safe alternatives)
              </button>
            </div>
          </div>
        </div>
      ) : null}
    </div>
  );
}

const styles = {
  page: {
    minHeight: "100vh",
    background: "radial-gradient(1200px 600px at 20% 10%, rgba(70,90,150,0.35), transparent 55%), linear-gradient(180deg, #06090f, #050810)",
    color: "#e9eefc",
    fontFamily: "system-ui, -apple-system, Segoe UI, Roboto, Arial, sans-serif",
  },
  header: {
    position: "sticky",
    top: 0,
    zIndex: 10,
    display: "flex",
    alignItems: "center",
    justifyContent: "space-between",
    padding: "14px 16px",
    background: "rgba(0,0,0,0.35)",
    backdropFilter: "blur(10px)",
    borderBottom: "1px solid rgba(255,255,255,0.06)",
  },
  brand: {
    fontWeight: 800,
    letterSpacing: "0.06em",
    fontSize: 14,
    opacity: 0.95,
  },
  bookingBtn: {
    border: "1px solid rgba(255,255,255,0.14)",
    background: "rgba(255,255,255,0.06)",
    color: "#e9eefc",
    borderRadius: 999,
    padding: "10px 14px",
    fontWeight: 700,
    cursor: "pointer",
  },
  main: {
    maxWidth: 760,
    margin: "0 auto",
    padding: "18px 14px 24px",
  },
  heroCard: {
    borderRadius: 18,
    padding: "18px 16px",
    background: "linear-gradient(180deg, rgba(30,40,80,0.65), rgba(10,12,20,0.35))",
    border: "1px solid rgba(255,255,255,0.08)",
    boxShadow: "0 10px 30px rgba(0,0,0,0.35)",
  },
  heroTitle: { fontSize: 34, fontWeight: 900, letterSpacing: "-0.02em" },
  heroSub: { marginTop: 8, opacity: 0.78, lineHeight: 1.4 },
  dotRow: { display: "flex", alignItems: "center", gap: 10, marginTop: 14 },
  dot: { width: 10, height: 10, borderRadius: 999, background: "#33dd77", boxShadow: "0 0 14px rgba(51,221,119,0.55)" },
  dotText: { fontWeight: 700, opacity: 0.95 },

  searchWrap: { marginTop: 16, display: "grid", gap: 12 },
  searchCard: {
    borderRadius: 18,
    padding: "14px 14px 12px",
    background: "rgba(255,255,255,0.04)",
    border: "1px solid rgba(255,255,255,0.08)",
    boxShadow: "0 10px 25px rgba(0,0,0,0.25)",
  },
  searchTitle: { fontWeight: 900, fontSize: 18, marginBottom: 10, opacity: 0.95 },
  searchRow: { display: "grid", gridTemplateColumns: "1fr 56px 88px", gap: 10, alignItems: "center" },
  input: {
    width: "100%",
    padding: "14px 14px",
    borderRadius: 14,
    border: "1px solid rgba(255,255,255,0.10)",
    background: "rgba(0,0,0,0.35)",
    color: "#e9eefc",
    outline: "none",
    fontSize: 14,
  },
  micBtn: {
    height: 50,
    borderRadius: 14,
    border: "1px solid rgba(255,255,255,0.12)",
    background: "rgba(255,255,255,0.06)",
    color: "#e9eefc",
    fontSize: 18,
    cursor: "pointer",
  },
  micBtnLive: {
    background: "rgba(255,60,60,0.20)",
    border: "1px solid rgba(255,60,60,0.45)",
  },
  sendBtn: {
    height: 50,
    borderRadius: 14,
    border: "none",
    background: "#33dd77",
    color: "#03130a",
    fontWeight: 900,
    cursor: "pointer",
  },
  smallInfo: { marginTop: 10, opacity: 0.8, fontSize: 13 },
  heardLine: { marginTop: 10, opacity: 0.92, fontSize: 14 },
  heardLabel: { fontWeight: 900, marginRight: 6 },

  statusCard: {
    borderRadius: 18,
    padding: "14px 14px",
    background: "rgba(255,255,255,0.03)",
    border: "1px solid rgba(255,255,255,0.08)",
  },
  statusSub: { marginTop: 6, opacity: 0.8, lineHeight: 1.35 },

  // Modal
  modalOverlay: {
    position: "fixed",
    inset: 0,
    background: "rgba(0,0,0,0.55)",
    display: "flex",
    alignItems: "center",
    justifyContent: "center",
    padding: 14,
    zIndex: 50,
  },
  modal: {
    width: "min(560px, 100%)",
    borderRadius: 18,
    background: "linear-gradient(180deg, rgba(20,24,35,0.95), rgba(10,12,20,0.95))",
    border: "1px solid rgba(255,255,255,0.10)",
    boxShadow: "0 18px 60px rgba(0,0,0,0.55)",
    padding: 14,
  },
  modalTop: { display: "flex", alignItems: "center", justifyContent: "space-between" },
  modalTitle: { fontWeight: 900, fontSize: 18 },
  modalClose: {
    width: 40,
    height: 40,
    borderRadius: 12,
    border: "1px solid rgba(255,255,255,0.12)",
    background: "rgba(255,255,255,0.06)",
    color: "#e9eefc",
    fontSize: 24,
    cursor: "pointer",
  },
  modalSpeakBtn: {
    marginTop: 12,
    width: "100%",
    height: 48,
    borderRadius: 14,
    border: "1px solid rgba(255,255,255,0.12)",
    background: "rgba(255,255,255,0.06)",
    color: "#e9eefc",
    fontWeight: 900,
    cursor: "pointer",
  },
  modalBlock: { marginTop: 12 },
  modalLabel: { opacity: 0.75, fontWeight: 800, marginBottom: 6 },
  modalText: { opacity: 0.95, lineHeight: 1.35 },

  recList: { display: "grid", gap: 10, marginTop: 10 },
  recCard: {
    borderRadius: 14,
    padding: 12,
    border: "1px solid rgba(255,255,255,0.10)",
    background: "rgba(255,255,255,0.04)",
  },
  recTitle: { fontWeight: 900, marginBottom: 4 },
  recSub: { opacity: 0.78, lineHeight: 1.35 },

  modalBtns: { display: "grid", gap: 10, marginTop: 14 },
  modalBtnPrimary: {
    textDecoration: "none",
    textAlign: "center",
    padding: "12px 14px",
    borderRadius: 14,
    background: "rgba(255,255,255,0.06)",
    border: "1px solid rgba(255,255,255,0.12)",
    color: "#e9eefc",
    fontWeight: 900,
  },
  modalBtn: {
    padding: "12px 14px",
    borderRadius: 14,
    background: "rgba(255,255,255,0.04)",
    border: "1px solid rgba(255,255,255,0.10)",
    color: "#e9eefc",
    fontWeight: 900,
    cursor: "pointer",
  },
};

