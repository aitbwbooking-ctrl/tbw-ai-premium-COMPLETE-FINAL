/**
 * TBW Adaptive Assistance™
 */

export function adjustVoiceForUser({ hearingImpaired }) {
  if (hearingImpaired) {
    speechSynthesis.getVoices();
    // real gain handled by OS; TBW speaks slower & clearer
    return { rate: 0.85, volume: 1 };
  }
  return { rate: 0.95, volume: 1 };
}

export function youngDriverExtraWarnings() {
  return {
    blindSpot: true,
    pedestrianPrediction: true,
    roundaboutAssist: true,
    fatigueMonitoring: true,
  };
}
