// CACB™: trigger only when BOTH speech signal + real navigation data indicate risk.
export function detectContextTrigger(transcript) {
  const t = (transcript || "").toLowerCase();

  const phrases = [
    "ne stignemo", "nećemo stići", "kasnimo", "snijeg", "oluja",
    "zatvorena cesta", "kolona", "što ako", "kako ćemo", "ne znam", "problem"
  ];

  return phrases.some((p) => t.includes(p));
}

export function shouldBridgeToBooking({ contextHit, navRisk }) {
  return !!contextHit && !!navRisk; // locked
}
