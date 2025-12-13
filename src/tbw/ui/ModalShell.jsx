import React from "react";

export default function ModalShell({ open, title, children, onClose, lockClose = false }) {
  if (!open) return null;
  return (
    <div style={styles.backdrop}>
      <div style={styles.card}>
        <div style={styles.header}>
          <div style={styles.title}>{title}</div>
          {!lockClose && (
            <button onClick={onClose} style={styles.x} aria-label="Close">✕</button>
          )}
        </div>
        <div style={styles.body}>{children}</div>
      </div>
    </div>
  );
}

const styles = {
  backdrop: {
    position: "fixed", inset: 0, background: "rgba(0,0,0,.7)",
    display: "flex", alignItems: "center", justifyContent: "center", zIndex: 9999
  },
  card: {
    width: "min(92vw, 560px)", borderRadius: 18, background: "#0b0f14",
    color: "#e8eef6", boxShadow: "0 20px 60px rgba(0,0,0,.6)", overflow: "hidden"
  },
  header: {
    display: "flex", alignItems: "center", justifyContent: "space-between",
    padding: "14px 16px", borderBottom: "1px solid rgba(255,255,255,.08)"
  },
  title: { fontSize: 16, fontWeight: 700 },
  x: {
    background: "transparent", border: "1px solid rgba(255,255,255,.15)",
    color: "#e8eef6", borderRadius: 10, padding: "6px 10px", cursor: "pointer"
  },
  body: { padding: 16 }
};
