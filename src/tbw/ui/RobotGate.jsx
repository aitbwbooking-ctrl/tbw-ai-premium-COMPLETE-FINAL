import React, { useMemo, useState } from "react";
import ModalShell from "./ModalShell";
import { readStore, writeStore } from "../core/storage";

const KEY = { ok: "tbw_robot_ok_v1" };

export function robotOk() {
  const s = readStore();
  return !!s[KEY.ok];
}

export default function RobotGate({ open, onOk }) {
  const [checked, setChecked] = useState(false);
  const challenge = useMemo(() => {
    const a = Math.floor(2 + Math.random() * 7);
    const b = Math.floor(2 + Math.random() * 7);
    return { a, b, ans: String(a + b) };
  }, []);
  const [val, setVal] = useState("");

  const submit = () => {
    if (checked && val.trim() === challenge.ans) {
      writeStore({ [KEY.ok]: true, tbw_robot_ts: Date.now() });
      onOk?.();
    }
  };

  return (
    <ModalShell open={open && !robotOk()} title="Robot verification" lockClose={true}>
      <div style={{ fontSize: 13, opacity: 0.9, lineHeight: 1.35 }}>
        Confirm you’re not a robot to unlock TBW.
      </div>

      <div style={{ marginTop: 12, padding: 12, borderRadius: 14, background: "rgba(255,255,255,.04)" }}>
        <label style={{ display: "flex", gap: 10, alignItems: "center", cursor: "pointer" }}>
          <input type="checkbox" checked={checked} onChange={(e) => setChecked(e.target.checked)} />
          <span style={{ fontWeight: 800 }}>I’m not a robot</span>
        </label>

        <div style={{ marginTop: 10, fontSize: 13, opacity: 0.9 }}>
          Quick check: {challenge.a} + {challenge.b} =
        </div>
        <input
          value={val}
          onChange={(e) => setVal(e.target.value)}
          inputMode="numeric"
          style={inp}
          placeholder="Answer"
        />
      </div>

      <div style={{ display: "flex", gap: 10, marginTop: 14 }}>
        <button style={btn} onClick={submit}>Continue</button>
      </div>
    </ModalShell>
  );
}

const inp = {
  width: "100%", marginTop: 8, padding: "10px 12px", borderRadius: 12,
  border: "1px solid rgba(255,255,255,.12)", background: "rgba(0,0,0,.25)",
  color: "#e8eef6", fontWeight: 800
};

const btn = {
  flex: 1, padding: "12px 14px", borderRadius: 14,
  border: "1px solid rgba(255,255,255,.12)",
  background: "rgba(0,255,120,.10)", color: "#e8eef6",
  fontWeight: 900, cursor: "pointer"
};
