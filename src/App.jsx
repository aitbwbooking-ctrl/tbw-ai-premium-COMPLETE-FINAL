import React, { useEffect, useRef, useState } from "react";
import "./App.css";

/* TBW CORE */
import { t } from "./tbw/core/i18n";
import { speak, makeRecognizer } from "./tbw/core/voice";
import { detectContextTrigger, shouldBridgeToBooking } from "./tbw/core/contextBridge";

/* GATES */
import PermissionGate from "./tbw/ui/PermissionGate";
import LegalGate, { legalAccepted } from "./tbw/ui/LegalGate";
import RobotGate, { robotOk } from "./tbw/ui/RobotGate";

/* UI */
import TickerNav from "./tbw/ui/TickerNav";

/* BOOKING */
import BookingModal from "./tbw/booking/BookingModal";

/* PARENTAL */
import ParentalPanel from "./tbw/parental/ParentalPanel";

/* =========================================================
   TBW AI PREMIUM — APP ROOT
   ========================================================= */

export default function App() {
  /* ---------- GLOBAL STATE ---------- */
  const [navActive, setNavActive] = useState(true); // navigation always ON (locked)
  const [navRisk, setNavRisk] = useState(false); // later fed by NavEngine (snow, closures, ETA drift)

  /* ---------- GATES ---------- */
  const [showLegal, setShowLegal] = useState(false);
  const [showRobot, setShowRobot] = useState(false);
  const [showPerm, setShowPerm] = useState(false);

  /* ---------- BOOKING ---------- */
  const [bookingOpen, setBookingOpen] = useState(false);
  const [bookingSeed, setBookingSeed] = useState("");

  /* ---------- PARENTAL ---------- */
  const [parentalOpen, setParentalOpen] = useState(false);

  /* ---------- TICKER ---------- */
  const [criticalTicker, setCriticalTicker] = useState(null);
  // { active:true, text:"NESREĆA 23 km ispred – smanjite brzinu" }

  /* ---------- VOICE CONTEXT LISTENER ---------- */
  const recRef = useRef(null);
  const finalTextRef = useRef("");

  /* =========================================================
     BOOT SEQUENCE — HARD LOCKED
     ========================================================= */
  useEffect(() => {
    // Order is locked: LEGAL → ROBOT → PERMISSIONS
    if (!legalAccepted()) {
      setShowLegal(true);
      return;
    }
    if (!robotOk()) {
      setShowRobot(true);
      return;
    }
    setShowPerm(true);
  }, []);

  /* =========================================================
     CONTEXTUAL AUTO-CONCIERGE BRIDGE (CACB™)
     Navigation listens, Booking joins ONLY if needed
     ========================================================= */
  useEffect(() => {
    if (!navActive) return;

    const r = makeRecognizer({ continuous: true });
    if (!r) return;

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
      if (!merged) return;

      const contextHit = detectContextTrigger(merged);
      const shouldHelp = shouldBridgeToBooking({
        contextHit,
        navRisk,
      });

      if (shouldHelp && !bookingOpen) {
        // One calm sentence – no interruption, no command needed
        speak(
          "Mogu pomoći. Vidim otežane uvjete i moguće kašnjenje. Želite da provjerim opcije?",
          { priority: "normal" }
        );
        setBookingSeed(merged);
        setBookingOpen(true);
      }
    };

    r.onend = () => {
      try {
        r.start();
      } catch {}
    };

    try {
      r.start();
    } catch {}

    return () => {
      try {
        r.stop();
      } catch {}
      recRef.current = null;
    };
  }, [navActive, navRisk, bookingOpen]);

  /* =========================================================
     SIMULATED NAV RISK (REMOVE WHEN REAL ENGINE FEEDS IT)
     ========================================================= */
  useEffect(() => {
    // demo: after 15s simulate snow / risk
    const tmr = setTimeout(() => {
      setNavRisk(true);
      setCriticalTicker({
        active: true,
        text: "POJAČAN SNIJEG NA RUTI — MOGUĆE KAŠNJENJE",
      });
      speak(
        "Upozorenje. Pojačan snijeg na ruti. Preporučujem povećanje razmaka.",
        { priority: "critical" }
      );
    }, 15000);

    return () => clearTimeout(tmr);
  }, []);

  /* =========================================================
     UI
     ========================================================= */
  return (
    <div className="tbw-app-root">
      {/* FIXED HEADER */}
      <header className="tbw-header">
        <div className="tbw-logo">TBW AI PREMIUM</div>
        <div className="tbw-actions">
          <button
            className="tbw-btn"
            onClick={() => setParentalOpen(true)}
          >
            Family / Safety
          </button>
        </div>
      </header>

      {/* TICKER */}
      <TickerNav critical={criticalTicker} />

      {/* HERO / NAVIGATION CORE */}
      <main className="tbw-main">
        <section className="tbw-hero">
          <h1>AI Safety Navigation</h1>
          <p>
            Navigation is active. Booking, safety and concierge assist
            automatically when needed.
          </p>

          <div className="tbw-nav-status">
            <span className="dot green" />
            Navigation running
          </div>

          <div className="tbw-manual-actions">
            <button
              className="tbw-btn-primary"
              onClick={() => {
                speak(
                  "TBW se privremeno isključuje. U slučaju ponovne aktivacije, recite samo Hey TBW.",
                  { priority: "normal" }
                );
                // SAFE MODE remains silently active (locked)
              }}
            >
              ISKLJUČI (SAFE MODE)
            </button>

            <button
              className="tbw-btn-secondary"
              onClick={() => {
                setBookingSeed("hotel");
                setBookingOpen(true);
              }}
            >
              OTVORI BOOKING
            </button>
          </div>
        </section>

        {/* SCROLLABLE AREA BELOW SEARCH / HERO */}
        <section className="tbw-scroll">
          <h2>Status & Information</h2>
          <p>
            Ovdje idu dodatni paneli (route details, safety overlays,
            explanations). Scroll je dozvoljen samo ispod hero dijela.
          </p>
        </section>
      </main>

      {/* ================= MODALS ================= */}

      {/* LEGAL */}
      <LegalGate
        open={showLegal}
        onAccepted={() => {
          setShowLegal(false);
          setShowRobot(true);
        }}
      />

      {/* ROBOT */}
      <RobotGate
        open={showRobot}
        onOk={() => {
          setShowRobot(false);
          setShowPerm(true);
        }}
      />

      {/* PERMISSIONS */}
      <PermissionGate
        open={showPerm}
        onOk={() => setShowPerm(false)}
      />

      {/* BOOKING 5★ CONCIERGE */}
      <BookingModal
        open={bookingOpen}
        seedPrompt={bookingSeed}
        cityFallback="Split"
        onClose={() => setBookingOpen(false)}
      />

      {/* PARENTAL */}
      <ParentalPanel
        open={parentalOpen}
        onDone={() => setParentalOpen(false)}
      />
    </div>
  );
}

