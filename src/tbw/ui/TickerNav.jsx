import React from "react";
import { t } from "../core/i18n";

export default function TickerNav({ critical }) {
  const text = critical?.text || t("TBW_EMERGENCY_PULT");
  const isCritical = !!critical?.active;

  return (
    <div style={{ ...styles.wrap, ...(isCritical ? styles.critical : styles.idle) }}>
      <div style={styles.inner}>
        <span style={styles.icon}>{isCritical ? "🔺" : "•"}</span>
        <div style={styles.marquee}>
          <div style={styles.track}>{text} • {text} • {text}</div>
        </div>
      </div>
    </div>
  );
}

const styles = {
  wrap: {
    height: 34, display: "flex", alignItems: "center",
    borderBottom: "1px solid rgba(255,255,255,.08)"
  },
  idle: { background: "rgba(255,255,255,.03)", color: "rgba(232,238,246,.85)" },
  critical: {
    background: "rgba(255,0,0,.10)",
    color: "#ffd6d6",
    animation: "tbwBlink 1s infinite"
  },
  inner: { width: "100%", display: "flex", gap: 10, alignItems: "center", padding: "0 12px" },
  icon: { fontSize: 14 },
  marquee: { overflow: "hidden", width: "100%" },
  track: {
    display: "inline-block",
    whiteSpace: "nowrap",
    animation: "tbwMarquee 14s linear infinite"
  }
};

// add these CSS keyframes once in App.css:
// @keyframes tbwMarquee { from { transform: translateX(0); } to { transform: translateX(-50%); } }
// @keyframes tbwBlink { 0%,100%{opacity:1} 50%{opacity:.55} }
