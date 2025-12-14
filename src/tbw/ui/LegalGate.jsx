import React from "react";
import ModalShell from "./ModalShell";
import { readStore, writeStore } from "../core/storage";

const KEY = { accepted: "tbw_legal_accepted_v1" };

export function legalAccepted() {
  const s = readStore();
  return !!s[KEY.accepted];
}

export default function LegalGate({ open, onAccepted }) {
  const accept = () => {
    writeStore({ [KEY.accepted]: true, tbw_legal_ts: Date.now() });
    onAccepted?.();
  };

  return (
    <ModalShell open={open && !legalAccepted()} title="TBW Legal Pack" lockClose={true}>
      <div style={{ fontSize: 13, opacity: 0.9, lineHeight: 1.35 }}>
        <b>Important:</b> TBW is an informational safety-support tool. You remain responsible for driving and decisions.
        TBW may use location, microphone, camera and background safety logic for vital safety situations (as accepted).
        TBW may provide warnings, reroutes, and emergency escalation. No guarantees of outcomes.
      </div>

      <div style={{ marginTop: 12, padding: 12, borderRadius: 14, background: "rgba(255,255,255,.04)" }}>
        <label style={{ display: "flex", gap: 10, alignItems: "flex-start", cursor: "pointer" }}>
          <input type="checkbox" id="tbwLegalChk" />
          <span style={{ fontSize: 13, opacity: 0.9 }}>
            I have read and accept the TBW terms, safety disclaimers and consent framework.
          </span>
        </label>
      </div>

      <div style={{ display: "flex", gap: 10, marginTop: 14 }}>
        <button
          style={btn}
          onClick={() => {
            const ok = document.getElementById("tbwLegalChk")?.checked;
            if (ok) accept();
          }}
        >
          Accept
        </button>
      </div>
    </ModalShell>
  );
}

const btn = {
  flex: 1, padding: "12px 14px", borderRadius: 14,
  border: "1px solid rgba(255,255,255,.12)",
  background: "rgba(0,255,120,.10)", color: "#e8eef6",
  fontWeight: 900, cursor: "pointer"
};
