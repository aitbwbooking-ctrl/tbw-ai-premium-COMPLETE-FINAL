/**
 * TBW AirMode™
 * – radi bez navigacije
 * – prati kašnjenja, presjedanja, sigurnost
 */

export function activateAirMode() {
  return {
    active: true,
    listenOnly: true,
    bookingAssist: true,
    emergencyAssist: true,
  };
}
