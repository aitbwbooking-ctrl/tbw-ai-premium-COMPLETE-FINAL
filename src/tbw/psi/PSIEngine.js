/**
 * TBW PSI™ (Predictive Safety Intelligence)
 * – predviđa pogoršanje situacije
 * – NE plaši korisnika
 * – aktivira tihi safety boost ili blago upozorenje
 */

export function predictRisk({
  weatherTrend,   // "WORSENING" | "STABLE"
  trafficTrend,   // "BUILDING" | "CLEAR"
  fatigueScore,   // 0–1
  timeToSunsetMin,
}) {
  let score = 0;

  if (weatherTrend === "WORSENING") score += 0.35;
  if (trafficTrend === "BUILDING") score += 0.25;
  if (fatigueScore > 0.6) score += 0.25;
  if (timeToSunsetMin < 30) score += 0.15;

  if (score >= 0.6) {
    return {
      risk: true,
      windowMin: 15,
      message: "Moguće pogoršanje uvjeta unaprijed. Vozite opreznije.",
    };
  }

  return { risk: false };
}
