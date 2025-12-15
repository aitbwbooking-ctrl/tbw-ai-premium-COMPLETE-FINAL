/* TBWRuntime.js – FINAL / NO LOOP / USER CLICK SAFE */

(function () {
  if (window.__TBW_RUNTIME__) return;
  window.__TBW_RUNTIME__ = true;

  const log = (...a) => console.log("[TBW RUNTIME]", ...a);

  let recognition = null;
  let active = false;

  function createRecognition() {
    const SR =
      window.SpeechRecognition ||
      window.webkitSpeechRecognition;

    if (!SR) {
      log("SpeechRecognition NOT supported");
      return null;
    }

    const r = new SR();
    r.lang = "hr-HR";
    r.continuous = false;
    r.interimResults = false;

    r.onstart = () => log("VOICE ACTIVE");
    r.onend = () => {
      active = false;
      log("VOICE END");
    };

    r.onerror = (e) => {
      active = false;
      log("SR error:", e.error);
    };

    r.onresult = (e) => {
      const text = e.results[0][0].transcript;
      log("VOICE RESULT:", text);
      window.dispatchEvent(
        new CustomEvent("tbw-voice-result", { detail: text })
      );
    };

    return r;
  }

  window.TBW_START_VOICE = function () {
    if (active) return;

    if (!recognition) recognition = createRecognition();
    if (!recognition) return;

    try {
      active = true;
      recognition.start();
    } catch (e) {
      active = false;
      log("start failed");
    }
  };

  log("Runtime ready – waiting for USER click");
})();

