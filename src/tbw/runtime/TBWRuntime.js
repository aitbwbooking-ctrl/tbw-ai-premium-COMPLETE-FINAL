/* 
 TBWRuntime.js — SINGLE OWNER MIC + CONSENT + NO LOOP
 - Ne dira App.jsx
 - Ne dira tvoje React komponente
 - Jedan mikrofon, jedna instanca
 - Nema duplih permission promptova
 - Glas → automatski u input + SEND
*/

(function TBW_RUNTIME() {
  if (window.__TBW_RUNTIME_LOADED__) return;
  window.__TBW_RUNTIME_LOADED__ = true;

  const CONSENT_KEY = "tbwConsent_v1";
  const MIC_KEY = "__TBW_MIC_PROMISE__";
  const GEO_KEY = "__TBW_GEO_PROMISE__";

  const log = (...a) => console.log("[TBW RUNTIME]", ...a);

  /* --------------------------------------------------
     1) HARD MIC LOCK (sprječava loop i dvostruki prompt)
  -------------------------------------------------- */
  try {
    const original = navigator.mediaDevices.getUserMedia.bind(
      navigator.mediaDevices
    );

    navigator.mediaDevices.getUserMedia = (constraints) => {
      if (window[MIC_KEY]) return window[MIC_KEY];
      window[MIC_KEY] = original(constraints);
      return window[MIC_KEY];
    };

    log("Mic lock installed");
  } catch (e) {
    console.warn("[TBW RUNTIME] Mic lock failed", e);
  }

  /* --------------------------------------------------
     2) CONSENT CHECK
  -------------------------------------------------- */
  const consentGranted = localStorage.getItem(CONSENT_KEY) === "true";

  if (!consentGranted) {
    log("Waiting for consent");
    return;
  }

  log("Consent granted");

  /* --------------------------------------------------
     3) GEO LOCATION (1x)
  -------------------------------------------------- */
  if (navigator.geolocation && !window[GEO_KEY]) {
    window[GEO_KEY] = new Promise((resolve) => {
      navigator.geolocation.getCurrentPosition(
        (pos) => {
          log("Geo OK");
          resolve(pos);
        },
        () => resolve(null),
        { enableHighAccuracy: true, timeout: 8000 }
      );
    });
  }

  /* --------------------------------------------------
     4) SPEECH RECOGNITION INIT
  -------------------------------------------------- */
  const SR =
    window.SpeechRecognition || window.webkitSpeechRecognition || null;

  if (!SR) {
    console.warn("[TBW RUNTIME] SpeechRecognition not supported");
    return;
  }

  const recognition = new SR();
  recognition.lang = "hr-HR";
  recognition.continuous = true;
  recognition.interimResults = false;
  recognition.maxAlternatives = 1;

  let active = false;

  recognition.onstart = () => {
    active = true;
    log("VOICE ACTIVE");
  };

  recognition.onend = () => {
    active = false;
    // auto restart (bez loopanja permissiona)
    setTimeout(() => {
      try {
        recognition.start();
      } catch (_) {}
    }, 600);
  };

  recognition.onerror = (e) => {
    log("SR error:", e.error);
  };

  /* --------------------------------------------------
     5) RESULT → APP BRIDGE (NE DIRAMO APP.JSX)
  -------------------------------------------------- */
  recognition.onresult = (event) => {
    const text = event.results?.[0]?.[0]?.transcript;
    if (!text) return;

    log("VOICE:", text);

    // 1) ubaci tekst u input
    const input =
      document.querySelector("input[type='text']") ||
      document.querySelector("textarea");

    if (input) {
      input.value = text;
      input.dispatchEvent(new Event("input", { bubbles: true }));
    }

    // 2) klikni SEND
    const sendBtn = [...document.querySelectorAll("button")].find((b) =>
      /send/i.test(b.innerText)
    );

    if (sendBtn) sendBtn.click();
  };

  /* --------------------------------------------------
     6) START (1x)
  -------------------------------------------------- */
  setTimeout(() => {
    if (!active) {
      try {
        recognition.start();
      } catch (_) {}
    }
  }, 500);
})();

