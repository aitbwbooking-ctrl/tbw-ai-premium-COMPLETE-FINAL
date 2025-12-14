import React, { useEffect, useState } from "react";
import "./App.css";

/* UI */
import BookingModal from "./tbw/booking/BookingModal";

/* GATES */
import LocationGate from "./tbw/permissions/LocationGate";

/* ============================
   APP STATES
   ============================ */
const BOOT = "BOOT";
const READY = "READY";
const RUNNING = "RUNNING";

export default function App() {
  const [appState, setAppState] = useState(BOOT);

  const [location, setLocation] = useState(null);
  const [bookingOpen, setBookingOpen] = useState(false);

  /* ============================
     SILENT BOOT (NO AUDIO!)
     ============================ */
  useEffect(() => {
    // NEMA GOVORA
    // NEMA MIKROFONA
    // NEMA GEO BLOKA
    setAppState(READY);
  }, []);

  /* ============================
     LOCATION GRANTED CALLBACK
     ============================ */
  const handleLocationGranted = (payload) => {
    setLocation(payload);
    setAppState(RUNNING);
  };

  /* ============================
     RENDER
     ============================ */

  /* ---- BOOT (ne vidi se) ---- */
  if (appState === BOOT) {
    return null;
  }

  /* ---- READY: PERMISSION ---- */
  if (appState === READY) {
    return (
      <div className="tbw-app-root">
        <LocationGate onGranted={handleLocationGranted} />
      </div>
    );
  }

  /* ---- RUNNING: FULL APP ---- */
  return (
    <div className="tbw-app-root">
      {/* ================= HEADER ================= */}
      <header className="tbw-header">
        <div className="tbw-logo">TBW AI PREMIUM</div>
        <div className="tbw-actions">
          <button
            className="tbw-btn-secondary"
            onClick={() => setBookingOpen(true)}
          >
            BOOKING
          </button>
        </div>
      </header>

      {/* ================= TICKER ================= */}
      <div className="tbw-ticker tbw-ticker-idle">
        <div className="tbw-ticker-inner">
          TBW EMERGENCY PULT • Safety-first navigation active
        </div>
      </div>

      {/* ================= MAIN ================= */}
      <main className="tbw-main">
        {/* HERO / NAV CORE */}
        <section className="tbw-hero">
          <h1>NAVIGATION ACTIVE</h1>
          <p>
            TBW sigurnosni navigacijski sustav je aktivan.
            {location?.mode && (
              <>
                <br />
                <b>Način lokacije:</b> {location.mode}
              </>
            )}
          </p>

          <div className="tbw-nav-status">
            <div className="dot green" />
            SUSTAV AKTIVAN
          </div>

          <div className="tbw-manual-actions">
            <button
              className="tbw-btn-primary"
              onClick={() => setBookingOpen(true)}
            >
              OTVORI BOOKING
            </button>
          </div>
        </section>

        {/* SCROLLABLE AREA */}
        <section className="tbw-scroll">
          <h2>Status</h2>
          <p>
            Navigacija, sigurnosni sustavi i booking engine su spremni.
            Glas i mikrofon aktiviraju se isključivo ručno.
          </p>
        </section>
      </main>

      {/* ================= MODALS ================= */}
      <BookingModal
        open={bookingOpen}
        onClose={() => setBookingOpen(false)}
      />
    </div>
  );
}

