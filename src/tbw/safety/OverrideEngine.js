/**
 * TBW OverrideEngine™
 * – korisnik kaže: "Idemo dalje"
 * – TBW NE SPORI
 * – ali pojačava sigurnosni nadzor (silent boost)
 */

export function isOverrideCommand(text = "") {
  const t = text.toLowerCase();
  return (
    t.includes("idemo dalje") ||
    t.includes("nastavi") ||
    t.includes("svejedno") ||
    t.includes("bez obzira")
  );
}

export function applySilentSafetyBoost() {
  // Placeholder za: češće provjere, jače pragove
  // NEMA UI poruke, NEMA zvuka
  return true;
}
