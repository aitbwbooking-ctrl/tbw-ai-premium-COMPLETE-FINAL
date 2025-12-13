import { useState } from "react";

/* ================== PARTNER CONFIG ================== */
const PARTNERS = {
  booking: { enabled: false, affiliateId: "" },
  airbnb: { enabled: false, affiliateId: "" },
  expedia: { enabled: false, affiliateId: "" },
};

/* ================== APP ================== */
export default function App() {
  const [activeWindow, setActiveWindow] = useState(null);

  return (
    <div style={styles.app}>
      {/* HEADER */}
      <header style={styles.header}>
        <div>
          <div style={styles.logo}>TBW AI PREMIUM</div>
          <div style={styles.sub}>Navigator · Safety · Booking</div>
        </div>
        <div style={styles.status}>LIVE · TRIAL</div>
      </header>

      {/* TICKER */}
      <div style={styles.ticker}>
        <div style={styles.tickerInner}>
          Live traffic · Weather · Safety · Events · Booking · TBW AI
        </div>
      </div>

      {/* HERO + SEARCH */}
      <section style={styles.hero}>
        <div style={styles.heroOverlay}>
          <h1 style={styles.city}>Paris</h1>

          <div style={styles.searchBox}>
            <input
              style={styles.searchInput}
              placeholder="Ask TBW AI…"
            />
            <button style={styles.searchBtn}>AI</button>
          </div>
        </div>
      </section>

      {/* SCROLL AREA */}
      <main style={styles.scroll}>
        <GridButton label="Navigation" onClick={() => setActiveWindow("nav")} />
        <GridButton label="Booking" onClick={() => setActiveWindow("booking")} />
        <GridButton label="Child Mode" onClick={() => setActiveWindow("child")} />
        <GridButton label="SOS / Emergency" onClick={() => setActiveWindow("sos")} />
        <GridButton label="Services" onClick={() => setActiveWindow("services")} />
        <GridButton label="Events" onClick={() => setActiveWindow("events")} />
        <GridButton label="Transport" onClick={() => setActiveWindow("transport")} />
        <GridButton label="Cafés & Restaurants" onClick={() => setActiveWindow("food")} />
        <GridButton label="Gas & Charging" onClick={() => setActiveWindow("fuel")} />
        <GridButton label="Marine" onClick={() => setActiveWindow("marine")} />
      </main>

      {/* WINDOW */}
      {activeWindow && (
        <div style={styles.windowOverlay} onClick={() => setActiveWindow(null)}>
          <div style={styles.window} onClick={(e) => e.stopPropagation()}>
            <h2>{activeWindow.toUpperCase()}</h2>

            {activeWindow === "booking" && (
              <p>
                AI receptionist active.  
                Booking / Airbnb partner IDs are not yet connected.
              </p>
            )}

            <button style={styles.closeBtn} onClick={() => setActiveWindow(null)}>
              Close
            </button>
          </div>
        </div>
      )}
    </div>
  );
}

/* ================== COMPONENTS ================== */
function GridButton({ label, onClick }) {
  return (
    <button style={styles.card} onClick={onClick}>
      {label}
    </button>
  );
}

/* ================== STYLES ================== */
const styles = {
  app: {
    background: "#050b08",
    color: "#eafff6",
    minHeight: "100vh",
    fontFamily: "system-ui",
  },

  header: {
    position: "fixed",
    top: 0,
    left: 0,
    right: 0,
    zIndex: 10,
    padding: "12px 16px",
    display: "flex",
    justifyContent: "space-between",
    background: "rgba(0,0,0,0.6)",
    backdropFilter: "blur(12px)",
    borderBottom: "1px solid rgba(60,255,179,0.15)",
  },

  logo: { fontWeight: 900, letterSpacing: "0.1em" },
  sub: { fontSize: 12, opacity: 0.7 },

  status: {
    padding: "6px 12px",
    borderRadius: 999,
    background: "rgba(255,210,70,0.15)",
    color: "#ffd246",
    fontWeight: 800,
  },

  ticker: {
    marginTop: 64,
    background: "rgba(0,0,0,0.4)",
    overflow: "hidden",
    whiteSpace: "nowrap",
  },

  tickerInner: {
    padding: "8px 16px",
    animation: "marquee 18s linear infinite",
  },

  hero: {
    height: 220,
    background:
      "url('/hero-paris.jpg') center/cover no-repeat",
    position: "relative",
  },

  heroOverlay: {
    position: "absolute",
    inset: 0,
    background: "rgba(0,0,0,0.55)",
    display: "flex",
    flexDirection: "column",
    justifyContent: "center",
    alignItems: "center",
    gap: 14,
  },

  city: { fontSize: 36, margin: 0 },

  searchBox: {
    display: "flex",
    gap: 8,
    width: "90%",
    maxWidth: 480,
  },

  searchInput: {
    flex: 1,
    padding: 12,
    borderRadius: 999,
    border: "none",
  },

  searchBtn: {
    padding: "0 20px",
    borderRadius: 999,
    border: "none",
    background: "#3cffb3",
    fontWeight: 900,
  },

  scroll: {
    padding: "16px",
    marginTop: 220,
    display: "grid",
    gridTemplateColumns: "repeat(auto-fit,minmax(160px,1fr))",
    gap: 12,
  },

  card: {
    padding: 16,
    borderRadius: 18,
    background: "rgba(0,0,0,0.45)",
    border: "1px solid rgba(255,255,255,0.08)",
    color: "#eafff6",
    fontWeight: 700,
  },

  windowOverlay: {
    position: "fixed",
    inset: 0,
    background: "rgba(0,0,0,0.75)",
    display: "flex",
    justifyContent: "center",
    alignItems: "center",
    zIndex: 50,
  },

  window: {
    background: "#07130f",
    padding: 24,
    borderRadius: 20,
    width: "90%",
    maxWidth: 500,
  },

  closeBtn: {
    marginTop: 16,
    padding: "8px 16px",
    borderRadius: 999,
    border: "none",
  },
};

