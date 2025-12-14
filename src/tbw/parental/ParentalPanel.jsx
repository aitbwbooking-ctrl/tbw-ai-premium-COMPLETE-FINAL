import React, { useMemo, useState } from "react";
import ModalShell from "../ui/ModalShell";
import { saveParentalProfile, pauseEscalation } from "./parentalEngine";

export default function ParentalPanel({ open, onDone }) {
  const [name, setName] = useState("");
  const [role, setRole] = useState("parent");
  const [country, setCountry] = useState("HR");
  const [lang, setLang] = useState("hr");

  const [email, setEmail] = useState("");
  const [phone, setPhone] = useState("");

  const [chEmail, setChEmail] = useState(true);
  const [chPhone, setChPhone] = useState(false);
  const [chSms, setChSms] = useState(false);

  const [c1, setC1] = useState(false);
  const [c2, setC2] = useState(false);
  const [c3, setC3] = useState(false);
  const [c4, setC4] = useState(false);

  const canSave = useMemo(() => {
    const channelOk =
      (chEmail && email.trim().length > 3) ||
      ((chPhone || chSms) && phone.trim().length > 5);

    const consentsOk = c1 && c2 && c3 && c4;
    const baseOk = name.trim().length >= 3;
    return baseOk && channelOk && consentsOk;
  }, [name, chEmail, chPhone, chSms, email, phone, c1, c2, c3, c4]);

  const save = () => {
    if (!canSave) return;
    saveParentalProfile({
      name, role, country, lang,
      notify: {
        email: chEmail ? email.trim() : "",
        phone: (chPhone || chSms) ? phone.trim() : "",
        sms: !!chSms,
        call: !!chPhone,
      },
      consents: { c1, c2, c3, c4 },
    });
    onDone?.();
  };

  return (
    <ModalShell open={open} title="TBW Parental & Guardian Panel" lockClose={true}>
      <div style={h}>Guardian details</div>
      <div style={grid}>
        <input style={inp} placeholder="Full name" value={name} onChange={(e) => setName(e.target.value)} />
        <select style={inp} value={role} onChange={(e) => setRole(e.target.value)}>
          <option value="parent">Parent</option>
          <option value="guardian">Guardian</option>
        </select>
        <input style={inp} placeholder="Country (e.g. HR)" value={country} onChange={(e) => setCountry(e.target.value)} />
        <input style={inp} placeholder="Language (hr/en/de…)" value={lang} onChange={(e) => setLang(e.target.value)} />
      </div>

      <div style={h}>Notification channels (choose at least one)</div>
      <div style={box}>
        <label style={row}><input type="checkbox" checked={chEmail} onChange={(e) => setChEmail(e.target.checked)} />Email</label>
        <input style={inp} placeholder="Email" value={email} onChange={(e) => setEmail(e.target.value)} />
        <div style={sep} />
        <label style={row}><input type="checkbox" checked={chPhone} onChange={(e) => setChPhone(e.target.checked)} />Call</label>
        <label style={row}><input type="checkbox" checked={chSms} onChange={(e) => setChSms(e.target.checked)} />SMS</label>
        <input style={inp} placeholder="Phone (with country code)" value={phone} onChange={(e) => setPhone(e.target.value)} />
      </div>

      <div style={h}>Mandatory consents (required)</div>
      <div style={box}>
        <label style={row}><input type="checkbox" checked={c1} onChange={(e) => setC1(e.target.checked)} />Child safety vital-interest consent</label>
        <label style={row}><input type="checkbox" checked={c2} onChange={(e) => setC2(e.target.checked)} />Emergency sensor/camera activation in critical events</label>
        <label style={row}><input type="checkbox" checked={c3} onChange={(e) => setC3(e.target.checked)} />Automatic SOS escalation when TBW detects danger</label>
        <label style={row}><input type="checkbox" checked={c4} onChange={(e) => setC4(e.target.checked)} />Notify guardian via selected channels</label>
      </div>

      <div style={{ display: "flex", gap: 10, marginTop: 14 }}>
        <button style={{ ...btn, opacity: canSave ? 1 : 0.45 }} onClick={save}>Save & Activate</button>
        <button
          style={btn2}
          onClick={() => pauseEscalation(4)}
          title="Used when child is confirmed safe via another phone (pause further escalation)"
        >
          Cancel / Pause escalation (4h)
        </button>
      </div>

      <div style={{ marginTop: 10, fontSize: 12, opacity: 0.75 }}>
        Cancel/Pause stops further escalation for signal-loss cases, but does not block life-critical events.
      </div>
    </ModalShell>
  );
}

const h = { marginTop: 10, fontSize: 13, fontWeight: 900, opacity: 0.9 };
const box = { marginTop: 8, padding: 12, borderRadius: 16, background: "rgba(255,255,255,.04)" };
const row = { display: "flex", gap: 10, alignItems: "center", marginBottom: 8, fontSize: 13, opacity: 0.9 };
const grid = { display: "grid", gridTemplateColumns: "1fr 1fr", gap: 10, marginTop: 8 };
const inp = {
  width: "100%", padding: "10px 12px", borderRadius: 12,
  border: "1px solid rgba(255,255,255,.12)",
  background: "rgba(0,0,0,.25)", color: "#e8eef6", fontWeight: 800
};
const sep = { height: 1, background: "rgba(255,255,255,.10)", margin: "10px 0" };
const btn = {
  flex: 1, padding: "12px 14px", borderRadius: 14, cursor: "pointer",
  border: "1px solid rgba(255,255,255,.12)", background: "rgba(0,255,120,.10)", color: "#e8eef6", fontWeight: 900
};
const btn2 = {
  flex: 1, padding: "12px 14px", borderRadius: 14, cursor: "pointer",
  border: "1px solid rgba(255,255,255,.12)", background: "rgba(255,255,255,.06)", color: "#e8eef6", fontWeight: 900
};
