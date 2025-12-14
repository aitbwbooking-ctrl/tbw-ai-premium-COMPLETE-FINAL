// src/tbw/layout/Header.jsx

import React from "react";

export default function Header({ onOpenBooking }) {
  return (
    <header style={styles.header}>
      <div style={styles.left}>
        <strong>TBW AI PREMIUM</strong>
      </div>

      <div style={styles.right}>
        <button style={styles.btn} onClick={onOpenBooking}>
          BOOKING
        </button>
      </div>
    </header>
  );
}

const styles = {
  header: {
    position: "fixed",
    top: 0,
    left: 0,
    right: 0,
    height: 56,
    background: "linear-gradient(180deg,#0b0f14,#05070a)",
    display: "flex",
    alignItems: "center",
    justifyContent: "space-between",
    padding: "0 16px",
    zIndex: 1000,
    borderBottom: "1px solid rgba(255,255,255,0.06)",
  },
  left: {
    color: "#e5e7eb",
    fontSize: 15,
    letterSpacing: 0.5,
  },
  right: {},
  btn: {
    background: "#1f2937",
    color: "#fff",
    border: "1px solid rgba(255,255,255,0.15)",
    borderRadius: 16,
    padding: "6px 14px",
    fontSize: 13,
    cursor: "pointer",
  },
};
