/**
 * TBW ChildSOS™
 * – dijete može aktivirati SOS SAMO ako su odrasli onemogućeni
 * – auto zaključan / vrućina / nema odgovora
 * – kamera + zvuk + temp heuristika
 */

export function childCriticalCheck({
  temperatureC,
  lockedCar,
  voiceResponse,
  ageMonths,
}) {
  if (lockedCar && temperatureC >= 30) return "HEAT_LOCKED";
  if (!voiceResponse && ageMonths < 18) return "INFANT_NO_RESPONSE";
  if (!voiceResponse && temperatureC >= 28) return "NO_RESPONSE_HEAT";
  return null;
}

export function escalateChildSOS(reason) {
  return {
    reason,
    autoCall: true,
    priority: "CRITICAL",
  };
}
