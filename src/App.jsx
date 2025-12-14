import React, { useEffect, useState } from "react";
import "./App.css";

/* Gates */
import LocationGate from "./tbw/permissions/LocationGate";

/* Core UI */
import BookingModal from "./tbw/booking/BookingModal";
import MainSearch from "./tbw/search/MainSearch";

const BOOT = "BOOT";
const READY = "READY";
const RUNNING = "RUNNING";

export default function App() {
  const [appState, setAppState] = useState(BOOT);

  // location payload (non-blocking)
  const [location, setLocation] = useState(null);

  // last voice/search context shared across app (NAV ↔ BOOKING ↔ SEARCH)
  const [voiceContext, setVoiceContext] = useState(null);

  // modals
  const [bookingOpen, setBookingOpen] = useState(false);

  /* ========== SILENT BOOT (NO AUDIO / NO MIC / NO LOOPS) ========== */
  useEffect(() => {
    setAppState(READY);
  }, []);

  /* ========== LOCATION CALLBACK ========== */
  const handleLocationGranted = (payload) => {
    setLocation(payload || { mode: "FALLBACK" });
    setAppState(RUNNING);
  };

  /* ========== OPEN BOOKING (ALWAYS CONTEXT-AWARE) ========== */
  const openBooking = (ctx = null) => {
    if (ctx) setVoiceContext(ctx);
    setBookingOpen(true);
  };

  /* ---------------- BOOT ---------------- */
  if (appState === BOOT) return null;

  /* ---------------- READY: LOCATION ---------------- */
  if (appState === READY) {
    return (
      <div className="tbw-app-root">
        <LocationGate onGranted={handleLocationGranted} />
      </div>
    );
  }

  /* ---------------- RUNNING: FULL APP ---------------- */
  return (
    <div className="tbw-app-root">
      {/* HEADER */}
      <header className="tbw-header">
        <div className="tbw-logo">TBW AI PREMIUM</div>

        <div className="tbw-actions">
          <button className="tbw-btn-secondary" onClick={() => openBooking(voiceContext)}>
            BOOKING
          </button>
        </div>
      </header>

      {/* TICKER (idle by default) */}
      <div className="tbw-ticker tbw-ticker-idle">
        <div className="tbw-ticker-inner">
          TBW EMERGENCY PULT • Safety-first navigation active •{" "}
          {location?.mode ? `LOC:${location.mode}` : "LOC:—"}
        </div>
      </div>

      {/* MAIN */}
      <main className="tbw-main">
        {/* HERO */}
        <section className="tbw-hero">
          <h1>TBW AI Search</h1>
          <p>
            Human mode aktivan. Glas i tekst. Booking se otvara automatski kad ga zatražiš.
          </p>

          <div className="tbw-nav-status">
            <div className="dot green" />
            SYSTEM RUNNING
          </div>

          <div className="tbw-manual-actions">
            <button className="tbw-btn-primary" onClick={() => openBooking(voiceContext)}>
              OTVORI BOOKING
            </button>
          </div>
        </section>

        {/* SCROLLABLE CONTENT */}
        <section className="tbw-scroll">
          <MainSearch
            // kad god search dobije kontekst, spremi ga globalno
            onContextUpdate={(ctx) => setVoiceContext(ctx)}
            // kad search prepozna booking intent, otvori booking odmah
            onOpenBooking={(ctx) => openBooking(ctx)}
          />
        </section>
      </main>

      {/* MODALS */}
      <BookingModal
        open={bookingOpen}
        context={voiceContext}
        onClose={() => setBookingOpen(false)}
      />
    </div>
  );
}

