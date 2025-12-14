/**
 * TBW NavRiskEngine™
 * – radi bez API ključeva (DEMO/TRIAL)
 * – kasnije se proširuje live API-jima (PREMIUM)
 * – emitira: navRisk (bool) + criticalEvent (object|null)
 */

export function createNavRiskEngine({ onRisk, onClear }) {
  let timer = null;
  let active = false;

  // DEMO heuristika (bez API-ja)
  const DEMO_EVENTS = [
    {
      type: "WEATHER_SNOW",
      text: "POJAČAN SNIJEG NA RUTI — SMANJITE BRZINU",
      severity: "CRITICAL",
      lat: 45.815,
      lon: 15.9819,
    },
    {
      type: "ACCIDENT",
      text: "NESREĆA 23 km ISPRED — KOLONA ~5 km",
      severity: "CRITICAL",
      lat: 45.90,
      lon: 16.05,
    },
  ];

  function start() {
    if (timer) return;
    timer = setInterval(() => {
      if (active) return;
      // simulacija: povremeno podigni rizik
      const ev = DEMO_EVENTS[Math.floor(Math.random() * DEMO_EVENTS.length)];
      active = true;
      onRisk?.(true);
      onClear?.(null); // reset old
      onClear?.(ev);   // push new critical
    }, 30000); // svakih 30s u DEMO
  }

  function stop() {
    if (timer) clearInterval(timer);
    timer = null;
  }

  function clear() {
    active = false;
    onRisk?.(false);
    onClear?.(null);
  }

  return { start, stop, clear };
}
