/* TBWRuntime.js — SINGLE SR OWNER, NO LOOP */

(function () {
  if (window.__TBW_RUNTIME_LOADED__) return;
  window.__TBW_RUNTIME_LOADED__ = true;

  const log = (...a) => console.log("[TBW RUNTIME]", ...a);

  const CONSENT_KEY = "tbwConsent_v1";

  if (localStorage.getItem(CONSENT_KEY) !== "true") {
    log("Waiting for consent");
    return;
  }

  // ---- SPEECH RECOGNITION SETUP ----
  const SR =
    window.SpeechRecognition || window.webkitSpeechRecognition;

  if (!SR) {
    log("SpeechRecognition not supported");
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
    };

    recognition.onresult = (e) => {
      const text = e.results[0][0].transcript;
      log("VOICE INPUT:", text);

      // ⬇️ OVDJE kasnije ide booking / AI / navigation
      window.dispatchEvent(
        new CustomEvent("tbw:voice", { detail: text })
      );
    };

    recognition.onerror = (e) => {
      log("SR error:", e.error);
    };

    recognition.onend = () => {
      listening = false;
      log("SR stopped");
    };
  }

  initSR();

  // ---- EXPOSE SINGLE START ----
  window.TBW_START_VOICE = () => {
    if (!recognition || listening) return;
    try {
      recognition.start();
    } catch (_) {}
  };

  log("Runtime ready");

})();

