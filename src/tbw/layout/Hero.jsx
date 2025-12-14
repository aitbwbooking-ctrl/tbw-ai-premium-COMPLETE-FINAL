// src/tbw/layout/Hero.jsx

import React from "react";

export default function Hero() {
  return (
    <section style={styles.hero}>
      <h1 style={styles.title}>AI Safety Navigation</h1>
      <p style={styles.subtitle}>
        Navigation is active. Booking, safety and concierge assist automatically
        when needed.
      </p>

      <div style={styles.status}>
        <span style={styles.dot} />
        <span>Navigation running</span>
      </div>
    </section>
  );
}

const styles = {
  hero: {
    paddingTop: 80, // zbog fixed headera
    paddingBottom: 24,
    paddingLeft: 16,
    paddingRight: 16,
    background:
      "linear-gradient(180deg, rgba(15,23,42,0.9), rgba(2,6,23,1))",
    borderBottom: "1px solid rgba(255,255,255,0.06)",
  },
  title: {
    color: "#f9fafb",
    fontSize: 22,
    marginBottom: 8,
  },
  subtitle: {
    color: "#9ca3af",
    fontSize: 14,
    lineHeight: 1.4,
    marginBottom: 16,
  },
  status: {
    display: "flex",
    alignItems: "center",
    gap: 8,
    color: "#d1fae5",
    fontSize: 13,
  },
  dot: {
    width: 8,
    height: 8,
    borderRadius: "50%",
    background: "#22c55e",
  },
};
