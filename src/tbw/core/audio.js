let currentDuck = null;

export async function duckAudioStart() {
  // Best-effort: lower other audio where possible. In web, we can't control other apps.
  // We instead use short TTS and respect user device audio focus behaviour.
  currentDuck = Date.now();
}

export async function duckAudioEnd() {
  currentDuck = null;
}

export function isDucking() {
  return !!currentDuck;
}
