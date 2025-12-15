/*  TBWRuntime.js — SINGLE OWNER MIC + CONSENT + NO LOOP
    - Ne dira App.jsx
    - Ne dira tvoje komponente
    - Sprječava višestruko traženje mikrofona (klik-klik, 2x prompt)
*/

(function TBW_RUNTIME() {
  if (window.__TBW_RUNTIME_LOADED__) return;
  window.__TBW_RUNTIME_LOADED__ = true;

  const CONSENT_KEY = "tbwConsent_v1";
  const MIC_KEY = "__TBW_MIC_PROMISE__";
  const GEO_KEY = "__TBW_GEO_PROMISE__";

  const log = (...a) => console.log("[TBW RUNTIME]", ...a);

  // ---------- 1) HARD LOCK: getUserMedia memoization (prevents double prompt + click loop)
  try {
    const original = navigator.mediaDevices?.getUserMedia?.bind(navigator.mediaDevices);
    if (original) {
      navigator.mediaDevices.getUserMedia = (constraints) => {
        if (window[MIC_KEY]) return window[MIC_KEY];
        window[MIC_KEY] = original(constraints);
        return window[MIC_KEY];
      };
      log("Mic lock installed");
    } else {
      log("No mediaDevices.getUserMedia available");
    }
  } catch (e) {
    console.warn("[TBW RUNTIME] Mic lock failed:", e);
  }

  // ---------- 2) GEO memoization (not critical, but keeps system stable)
  function getGeoOnce() {
    if (window[GEO_KEY]) return window[GEO_KEY];
    window[GEO_KEY] = new Promise((resolve, reject) => {
      if (!navigator.geolocation) return reject(new Error("No geolocation"));
      navigator.geolocation.getCurrentPosition(
        (pos) => resolve(pos),
        (err) => reject(err),
        { enableHighAccuracy: true, timeout: 12000 }
      );
    });
    return window[GEO_KEY];
  }

  // ---------- 3) UI consent overlay (legal gate, user gesture)
  function showConsentOverlay() {
    const existing = document.getElementById("tbwConsentOverlay");
    if (existing) return;

    const overlay = document.createElement("div");
    overlay.id = "tbwConsentOverlay";
    overlay.style.position = "fixed";
    overlay.style.inset = "0";
    overlay.style.zIndex = "999999";
    overlay.style.background = "rgba(0,0,0,0.86)";
    overlay.style.display = "flex";
    overlay.style.alignItems = "center";
    overlay.style.justifyContent = "center";
    overlay.style.padding = "16px";

    const box = document.createElement("div");
    box.style.maxWidth = "420px";
    box.style.width = "100%";
    box.style.background = "#0b1220";
    box.style.border = "1px solid rgba(255,255,255,0.10)";
    box.style.borderRadius = "16px";
    box.style.padding = "18px";
    box.style.color = "#e5e7eb";
    box.style.fontFamily = "system-ui, -apple-system, Segoe UI, Roboto, Arial";

    box.innerHTML = `
      <div style="font-weight:900;font-size:18px;margin-bottom:10px;">TBW Safety Consent</div>
      <div style="opacity:.9;font-size:13px;line-height:1.4;margin-bottom:10px;">
        TBW AI PREMIUM zahtijeva privolu za:
        <br>• mikrofon (glasovna asistencija)
        <br>• lokaciju (sigurnost, navigacija, alarmi)
      </div>
      <div style="opacity:.65;font-size:12px;line-height:1.35;margin-bottom:12px;">
        Ako ne želite, možete odbiti — tada nećete primati TBW sigurnosne obavijesti.
        Privolu možete povući u bilo kojem trenutku u postavkama uređaja / preglednika.
      </div>
      <div id="tbwConsentErr" style="display:none;color:#ff6b6b;font-size:12px;margin-bottom:10px;"></div>
      <button id="tbwConsentBtn" style="
        width:100%;padding:12px 14px;border:0;border-radius:12px;
        font-weight:900;cursor:pointer;
        background:linear-gradient(135deg,#00ffb3,#00c18c);
        color:#02110b;
      ">OMOGUĆI I NASTAVI</button>
      <button id="tbwDeclineBtn" style="
        margin-top:10px;width:100%;padding:11px 14px;border-radius:12px;
        background:rgba(255,255,255,0.06);
        border:1px solid rgba(255,255,255,0.12);
        color:#e5e7eb;font-weight:800;cursor:pointer;
      ">ODBIJ</button>
    `;

    overlay.appendChild(box);
    document.body.appendChild(overlay);

    const err = box.querySelector("#tbwConsentErr");
    const okBtn = box.querySelector("#tbwConsentBtn");
    const noBtn = box.querySelector("#tbwDeclineBtn");

    noBtn.onclick = () => {
      // user declined: remove overlay, do nothing (legal clean)
      localStorage.setItem(CONSENT_KEY, "declined");
      overlay.remove();
      log("Consent declined");
    };

    okBtn.onclick = async () => {
      try {
        // NOTE: ovo je jedini user-gesture start; nakon toga sve ide stabilno.
        err.style.display = "none";

        // mic permission (memoized, so no double prompts)
        await navigator.mediaDevices.getUserMedia({ audio: true });

        // location permission
        await getGeoOnce();

        localStorage.setItem(CONSENT_KEY, "granted");
        overlay.remove();
        log("Consent granted");
        startSpeechRecognitionOnce();
      } catch (e) {
        console.error("[TBW RUNTIME] Consent error:", e);
        err.textContent =
          "Ne mogu aktivirati TBW bez dozvola. Provjerite dopuštenja za mikrofon i lokaciju.";
        err.style.display = "block";
      }
    };
  }

  // ---------- 4) SpeechRecognition (start ONCE, no loops)
  function startSpeechRecognitionOnce() {
    if (window.__TBW_SR_STARTED__) {
      log("SR already started");
      return;
    }
    const SR = window.SpeechRecognition || window.webkitSpeechRecognition;
    if (!SR) {
      log("SpeechRecognition not supported on this browser");
      return;
    }

    try {
      const rec = new SR();
      rec.lang = navigator.language || "hr-HR";
      rec.continuous = true;
      rec.interimResults = false;

      rec.onresult = (e) => {
        const text = e.results[e.results.length - 1][0].transcript?.trim();
        if (!text) return;
        log("HEARD:", text);
        // emit event for app modules later (no code changes needed now)
        window.dispatchEvent(new CustomEvent("tbw:voice", { detail: { text } }));
      };

      rec.onerror = (e) => {
        console.warn("[TBW RUNTIME] SR error:", e);
      };

      rec.onend = () => {
        // Keep alive (stable) WITHOUT loops/prompt spam:
        // restart only if consent granted.
        if (localStorage.getItem(CONSENT_KEY) === "granted") {
          try {
            rec.start();
          } catch {}
        }
      };

      rec.start();
      window.__TBW_SR_STARTED__ = true;
      log("VOICE ACTIVE");
    } catch (e) {
      console.error("[TBW RUNTIME] SR start failed:", e);
    }
  }

  // ---------- Boot
  const consent = localStorage.getItem(CONSENT_KEY);

  if (consent === "granted") {
    log("Consent already granted -> start voice");
    startSpeechRecognitionOnce();
  } else if (consent === "declined") {
    log("Consent previously declined -> no voice");
    // do nothing (legal)
  } else {
    // show overlay once DOM is ready
    if (document.readyState === "loading") {
      document.addEventListener("DOMContentLoaded", showConsentOverlay, { once: true });
    } else {
      showConsentOverlay();
    }
  }
})();
