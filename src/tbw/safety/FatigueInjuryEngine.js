/**
 * TBW Fatigue & Injury Engine™
 * – prepoznaje umor, šok, ozljede
 * – NE optužuje, NE plaši
 */

export function analyzeVoice({ speechRate, pausesMs, tremor }) {
  let fatigue = 0;
  if (speechRate < 0.8) fatigue += 0.3;
  if (pausesMs > 1200) fatigue += 0.3;
  if (tremor > 0.6) fatigue += 0.2;
  return fatigue; // 0–1
}

export function analyzeInjury({ accel, soundPeak, painWords }) {
  if (accel > 3.5 || soundPeak > 0.85) return "LIKELY_INJURY";
  if (painWords) return "POSSIBLE_INJURY";
  return "NONE";
}

export function fatigueAdvisory(score) {
  if (score >= 0.6) {
    return {
      warn: true,
      message: "Preporučujem kratku pauzu. Umor može utjecati na reakcije.",
    };
  }
  return { warn: false };
}
