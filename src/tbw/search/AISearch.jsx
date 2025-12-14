import React, { useState } from "react";

export default function AISearch({ onQuery }) {
  const [text, setText] = useState("");

  return (
    <div style={styles.box}>
      <input
        style={styles.input}
        placeholder="Pitaju me slobodno..."
        value={text}
        onChange={(e) => setText(e.target.value)}
      />
      <button
        style={styles.btn}
        onClick={() => {
          if (text.trim()) {
            onQuery?.(text);
            setText("");
          }
        }}
      >
        SEND
      </button>
    </div>
  );
}

const styles = {
  box: {
    display: "flex",
    gap: 8,
    marginTop: 12,
  },
  input: {
    flex: 1,
    padding: 10,
    borderRadius: 10,
    border: "1px solid rgba(255,255,255,0.15)",
    background: "#020617",
    color: "#fff",
  },
  btn: {
    padding: "0 14px",
    borderRadius: 10,
    border: "none",
    background: "#22c55e",
    color: "#022c22",
    fontWeight: 600,
    cursor: "pointer",
  },
};
