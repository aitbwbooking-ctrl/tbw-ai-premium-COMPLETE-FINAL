/* TBWRuntime.js — FLOATING MIC + SINGLE SR OWNER + NO LOOP + CONSENT WATCH */

(function () {
  if (window.__TBW_RUNTIME_LOADED__) return;
  window.__TBW_RUNTIME_LOADED__ = true;

  const log = (...a) => console.log("[TBW RUNTIME]", ...a);

  const CONSENT_KEY = "tbwConsent_v1"; // mora se poklapati s ConsentGate

  // ---------- UI: floating mic ----------
  function mountMicButton() {
    if (document.getElementById("tbwMicBtn")) return;

    const btn = document.createElement("button");
    btn.id = "tbwMicBtn";
    btn.type = "button";
    btn.title = "TBW Voice";
    btn.innerText = "🎤";
    Object.assign(btn.style, {
      position: "fixed",
      right: "16px",
      bottom: "16px",
      zIndex: 999999,
      width: "56px",
      height: "56px",
      borderRadius: "999px",
      border: "1px solid rgba(255,255,255,0.15)",
      background: "rgba(0,0,0,0.65)",
      color: "#fff",
      fontSize: "22px",
      cursor: "pointer",
      boxShadow: "0 10px 30px rgba(0,0,0,0.35)",
      backdropFilter: "blur(10px)",
    });

    const badge = document.createElement("div");
    badge.id = "tbwMicBadge";
    Object.assign(badge.style, {
      position: "fixed",
      right: "16px",
      bottom: "78px",
      zIndex: 999999,
      padding: "8px 10px",
      borderRadius: "12px",
      border: "1px solid rgba(255,255,255,0.12)",
      background: "rgba(0,0,0,0.70)",
      color: "#fff",
      fontSize: "12px",
      maxWidth: "260px",
      display: "none",
      lineHeight: "1.2",
      boxShadow: "0 10px 30px rgba(0,0,0,0.35)",
      backdropFilter: "blur(10px)",
    });

    function showBadge(text, ms = 2200) {
      badge.textContent = text;
      badge.style.display = "block";
      clearTimeout(showBadge._t);
      showBadge._t = setTimeout(() => (badge.style.display = "none"), ms);
    }

    btn.addEventListener("click", async () => {
      if (localStorage.getItem(CONSENT_KEY) !== "true") {
        showBadge("Consent nije potvrđen. Klikni 'OMOGUĆI I NASTAVI'.");
        log("No consent yet");
        return;
      }
      window.TBW_START_VOICE?.();
    });

    document.body.appendChild(btn);
    document.body.appendChild(badge);

    log("Mic button mounted");
  }

  // mount when DOM ready
  if (document.readyState === "loading") {
    document.addEventListener("DOMContentLoaded", mountMicButton);
  } else {
    mountMicButton();
  }

  // ---------- SpeechRecognition (single owner) ----------
  const SR = window.SpeechRecognition || window.webkitSpeechRecognition;
  if (!SR) {
    log("SpeechRecognition NOT supported in this browser");
    return;
  }

  let recognition = null;
  let listening = false;

  function initSR() {
    recognition = new SR();
    recognition.lang = navigator.language || "hr-HR";
    recognition.continuous = false;
    recognition.interimResults = false;
    recognition.maxAlternatives = 1;

    recognition.onstart = () => {
      listening = true;
      log("VOICE ACTIVE");
      const btn = document.getElementById("tbwMicBtn");
      if (btn) btn.innerText = "🔴";
    };

    recognition.onresult = (e) => {
      const text = e?.results?.[0]?.[0]?.transcript || "";
      log("VOICE INPUT:", text);

      // dispatch event to app
      window.dispatchEvent(new CustomEvent("tbw:voice", { detail: text }));

      // best-effort: fill first text input/textarea
      const input =
        document.querySelector('input[type="text"]') ||
        document.querySelector("textarea") ||
        document.querySelector("input");

      if (input && typeof input.value === "string") {
        input.value = text;
        input.dispatchEvent(new Event("input", { bubbles: true }));
        input.dispatchEvent(new Event("change", { bubbles: true }));
      }
    };

    recognition.onerror = (e) => {
      // abort/no-speech je normalno ako user ne priča
      log("SR error:", e?.error || e);
    };

    recognition.onend = () => {
      listening = false;
      log("SR stopped");
      const btn = document.getElementById("tbwMicBtn");
      if (btn) btn.innerText = "🎤";
    };
  }

  initSR();

  window.TBW_START_VOICE = () => {
    if (!recognition) initSR();
    if (listening) return;
    try {
      recognition.start();
    } catch (err) {
      log("start() blocked:", err?.message || err);
    }
  };

  // ---------- Consent watcher (ako ConsentGate upiše kasnije) ----------
  function checkConsent() {
    const ok = localStorage.getItem(CONSENT_KEY) === "true";
    log("Consent:", ok ? "granted" : "missing");
    return ok;
  }

  checkConsent();

  window.addEventListener("storage", (e) => {
    if (e.key === CONSENT_KEY) checkConsent();
  });

  window.addEventListener("tbw:consent", () => checkConsent());

  log("Runtime ready");
})();

