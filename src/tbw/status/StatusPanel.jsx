import React from "react";

export default function StatusPanel() {
  return (
    <div style={styles.panel}>
      <div style={styles.row}>
        <span style={styles.dot} />
        <span>Sustav aktivan</span>
      </div>
      <div style={styles.text}>
        AI navigacija, sigurnosni slojevi i booking engine su spremni.
      </div>
    </div>
  );
}

const styles = {
  panel: {
    marginTop: 16,
    padding: 14,
    borderRadius: 14,
    background: "rgba(255,255,255,0.04)",
    border: "1px solid rgba(255,255,255,0.06)",
  },
  row: {
    display: "flex",
    alignItems: "center",
    gap: 8,
    marginBottom: 6,
  },
  dot: {
    width: 8,
    height: 8,
    borderRadius: "50%",
    background: "#22c55e",
  },
  text: {
    fontSize: 13,
    color: "#9ca3af",
  },
};
