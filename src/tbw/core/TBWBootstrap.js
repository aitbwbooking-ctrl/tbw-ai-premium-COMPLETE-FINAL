// TBW CENTRAL BOOTSTRAP ENGINE
// Ne dira App.jsx
// Ne dira UI
// Sam se pokreće

(function () {
  if (window.__TBW_BOOTED__) return;
  window.__TBW_BOOTED__ = true;

  console.log("🚀 TBW BOOTSTRAP START");

  async function requestPermissions() {
    try {
      // MICROPHONE
      await navigator.mediaDevices.getUserMedia({ audio: true });
      console.log("🎤 Microphone granted");

      // LOCATION
      await new Promise((resolve, reject) => {
        navigator.geolocation.getCurrentPosition(
          () => {
            console.log("📍 Location granted");
            resolve();
          },
          reject
        );
      });

      localStorage.setItem("TBW_BOOT_OK", "true");
      console.log("✅ TBW SYSTEM READY");

      startVoice();
    } catch (e) {
      console.error("❌ Permission error", e);
    }
  }

  function startVoice() {
    const SR =
      window.SpeechRecognition || window.webkitSpeechRecognition;

    if (!SR) {
      console.error("SpeechRecognition not supported");
      return;
    }

    const rec = new SR();
    rec.lang = "hr-HR";
    rec.continuous = true;

    rec.onresult = (e) => {
      const text = e.results[e.results.length - 1][0].transcript;
      console.log("🗣 USER:", text);
    };

    rec.onerror = (e) => console.error("VOICE ERROR", e);

    rec.start();
    console.log("🎧 TBW LISTENING");
  }

  if (localStorage.getItem("TBW_BOOT_OK") === "true") {
    startVoice();
  } else {
    requestPermissions();
  }
})();
