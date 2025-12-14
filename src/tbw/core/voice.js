/* =========================================================
   TBW UNIFIED VOICE SYSTEM™
   Concierge · Navigation · Safety · Night · Child · Air/Marine
   ========================================================= */

let voicesReady = false;
let femaleVoice = null;
let maleVoice = null;

/* ------------------ UTIL ------------------ */
function loadVoices() {
  const v = window.speechSynthesis.getVoices() || [];
  if (!v.length) return null;
  return v;
}

function pickVoice(list, lang, regex) {
  return (
    list.find(v =>
      v.lang.startsWith(lang.slice(0, 2)) && regex.test(v.name)
    ) ||
    list.find(v => v.lang.startsWith(lang.slice(0, 2))) ||
    list[0]
  );
}

function ensureVoices(lang) {
  const v = loadVoices();
  if (!v) return;

  if (!femaleVoice) {
    femaleVoice = pickVoice(
      v,
      lang,
      /female|woman|zira|eva|helena|katja|ana|susan|sofia/i
    );
  }

  if (!maleVoice) {
    maleVoice = pickVoice(
      v,
      lang,
      /male|man|david|mark|ivan|tom|alex|daniel|george/i
    );
  }

  voicesReady = true;
}

/* ------------------ AUDIO DUCKING ------------------ */
function duckAudio(enable = true) {
  const audios = document.querySelectorAll("audio, video");
  audios.forEach(el => {
    if (!el.dataset.tbwDuck) {
      el.dataset.tbwDuck = el.volume;
    }
    el.volume = enable ? Math.max(0.1, el.volume * 0.25) : el.dataset.tbwDuck;
  });
}

/* ------------------ CORE SPEAK ------------------ */
function speakInternal(text, cfg) {
  if (!text) return;

  ensureVoices(cfg.lang);
  if (!voicesReady) return;

  const u = new SpeechSynthesisUtterance(text);
  u.lang = cfg.lang;
  u.voice = cfg.voice;
  u.rate = cfg.rate;
  u.pitch = cfg.pitch;
  u.volume = cfg.volume ?? 1;

  duckAudio(true);
  window.speechSynthesis.cancel();
  window.speechSynthesis.speak(u);

  u.onend = () => duckAudio(false);
}

/* =========================================================
   PUBLIC API
   ========================================================= */

/* 🟢 CONCIERGE / AI / BOOKING (ženski, topao) */
export function speak(text, options = {}) {
  const lang = options.lang || navigator.language || "hr-HR";

  speakInternal(text, {
    lang,
    voice: femaleVoice,
    rate: 0.92,
    pitch: 1.05,
    volume: 1,
  });
}

/* 🔴 NAVIGATION / SAFETY / EMERGENCY (muški, autoritet) */
export function speakNav(text, options = {}) {
  const lang = options.lang || navigator.language || "hr-HR";
  const critical = options.priority === "critical";

  speakInternal(text, {
    lang,
    voice: maleVoice,
    rate: critical ? 0.85 : 0.9,
    pitch: critical ? 0.9 : 0.95,
    volume: 1,
  });
}

/* 🌙 NIGHT MODE (tiši, sporiji, nenametljiv) */
export function speakNight(text, options = {}) {
  const lang = options.lang || navigator.language || "hr-HR";

  speakInternal(text, {
    lang,
    voice: femaleVoice,
    rate: 0.88,
    pitch: 1.0,
    volume: 0.65,
  });
}

/* 🧒 CHILD / PARENT MODE (smirujući, jasan) */
export function speakChild(text, options = {}) {
  const lang = options.lang || navigator.language || "hr-HR";

  speakInternal(text, {
    lang,
    voice: femaleVoice,
    rate: 0.9,
    pitch: 1.08,
    volume: 1,
  });
}

/* 🚁✈️🚢 AIR / HELICOPTER / MARINE MODE (neutralan, profesionalan) */
export function speakAir(text, options = {}) {
  const lang = options.lang || navigator.language || "en-US";

  speakInternal(text, {
    lang,
    voice: maleVoice,
    rate: 0.9,
    pitch: 0.95,
    volume: 1,
  });
}

/* preload voices */
if (typeof window !== "undefined") {
  window.speechSynthesis.onvoiceschanged = () => {
    femaleVoice = null;
    maleVoice = null;
    voicesReady = false;
  };
}
