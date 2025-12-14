/**
 * TBW MultiDevice Audio™
 * – koristi OS audio focus
 * – radi preko Bluetooth / hands-free ako postoji
 * – fallback na device speaker
 */

export function speakCritical(text) {
  try {
    const u = new SpeechSynthesisUtterance(text);
    u.volume = 1;
    u.rate = 0.95;
    u.pitch = 1;
    speechSynthesis.cancel();
    speechSynthesis.speak(u);
  } catch {}
}

export function beep(times = 3) {
  try {
    const ctx = new (window.AudioContext || window.webkitAudioContext)();
    for (let i = 0; i < times; i++) {
      const osc = ctx.createOscillator();
      osc.type = "square";
      osc.frequency.value = 880;
      osc.connect(ctx.destination);
      osc.start(ctx.currentTime + i * 0.25);
      osc.stop(ctx.currentTime + i * 0.25 + 0.1);
    }
  } catch {}
}
