import React from "react";

export default function OverlayMap({ event, onClose }) {
  if (!event) return null;

  return (
    <div style={s.wrap}>
      <div style={s.card}>
        <div style={s.header}>
          <div style={s.title}>TBW ALERT MAP</div>
          <button style={s.close} onClick={onClose}>✕</button>
        </div>

        <div style={s.map}>
          <div style={s.marker}>
            <div style={s.triangle} />
            <div style={s.pulse} />
          </div>
        </div>

        <div style={s.info}>
          <div style={s.text}>{event.text}</div>
          <div style={s.meta}>
            Lat: {event.lat} • Lon: {event.lon}
          </div>
        </div>
      </div>
    </div>
  );
}

const s = {
  wrap: {
    position: "fixed", inset: 0, background: "rgba(0,0,0,.75)",
    zIndex: 10000, display: "flex", alignItems: "center", justifyContent: "center"
  },
  card: {
    width: "min(92vw, 520px)", borderRadius: 20,
    background: "#0b0f14", color: "#e8eef6", overflow: "hidden",
    boxShadow: "0 30px 80px rgba(0,0,0,.7)"
  },
  header: {
    padding: 14, display: "flex", justifyContent: "space-between",
    borderBottom: "1px solid rgba(255,255,255,.08)"
  },
  title: { fontWeight: 900 },
  close: {
    background: "transparent", color: "#e8eef6", border: "none",
    fontSize: 18, cursor: "pointer"
  },
  map: {
    position: "relative", height: 260,
    background: "linear-gradient(180deg,#111,#1b2430)"
  },
  marker: {
    position: "absolute", left: "50%", top: "50%",
    transform: "translate(-50%,-50%)"
  },
  triangle: {
    width: 0, height: 0,
    borderLeft: "14px solid transparent",
    borderRight: "14px solid transparent",
    borderTop: "24px solid red",
    animation: "tbwBlink 1s infinite"
  },
  pulse: {
    position: "absolute", left: "-20px", top: "-20px",
    width: 60, height: 60, borderRadius: "50%",
    background: "rgba(255,0,0,.25)",
    animation: "tbwPulse 1.5s infinite"
  },
  info: { padding: 14 },
  text: { fontWeight: 900, marginBottom: 6 },
  meta: { fontSize: 12, opacity: 0.75 }
};
