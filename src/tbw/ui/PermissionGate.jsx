import React, { useEffect, useState } from "react";
import ModalShell from "./ModalShell";
import { ensurePermissions } from "../core/permissions";
import { t } from "../core/i18n";

export default function PermissionGate({ open, onOk }) {
  const [state, setState] = useState({ checking: false, ok: false });

  useEffect(() => {
    if (!open) return;
    (async () => {
      setState({ checking: true, ok: false });
      const res = await ensurePermissions();
      setState({ checking: false, ok: !!res.ok });
      if (res.ok) onOk?.();
    })();
  }, [open, onOk]);

  return (
    <ModalShell
      open={open && !state.ok}
      title={t("PERM_REQUIRED_TITLE")}
      lockClose={true}
    >
      <div style={{ opacity: 0.9, lineHeight: 1.35 }}>{t("PERM_REQUIRED_BODY")}</div>

      <div style={{ marginTop: 14, padding: 12, borderRadius: 14, background: "rgba(255,255,255,.04)" }}>
        <div style={{ fontWeight: 800, marginBottom: 8 }}>{t("PERM_LOCATION_BLOCK")}</div>
        <div style={{ fontSize: 13, opacity: 0.85 }}>
          {state.checking ? "…" : "⚠️"}
        </div>
      </div>

      <div style={{ display: "flex", gap: 10, marginTop: 16 }}>
        <button
          onClick={() => ensurePermissions().then((r) => r.ok && onOk?.())}
          style={btn.primary}
        >
          {t("PERM_ENABLE")}
        </button>
      </div>
    </ModalShell>
  );
}

const btn = {
  primary: {
    flex: 1, padding: "12px 14px", borderRadius: 14,
    border: "1px solid rgba(255,255,255,.12)",
    background: "rgba(0,255,120,.10)",
    color: "#e8eef6", fontWeight: 800, cursor: "pointer"
  }
};
