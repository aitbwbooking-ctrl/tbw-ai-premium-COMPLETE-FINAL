/**
 * TBW Parking & Blind-Spot Assist™
 * – pomaže pri parkiranju, prestrojavanju, kružnim tokovima
 * – naglasak na mlade i starije vozače
 */

export function parkingAssist({ speedKmh, proximity }) {
  if (speedKmh <= 10 && proximity < 0.5) {
    return {
      warn: true,
      message: "Polako. Objekt je vrlo blizu. Provjerite mrtvi kut.",
    };
  }
  return { warn: false };
}

export function blindSpotAssist({ turnSignal, proximitySide }) {
  if (turnSignal && proximitySide < 0.7) {
    return {
      warn: true,
      message: "Vozilo u mrtvom kutu. Pričekajte.",
    };
  }
  return { warn: false };
}

export function roundaboutAssist({ entrySpeed }) {
  if (entrySpeed > 30) {
    return {
      warn: true,
      message: "Usporite prije ulaska u kružni tok.",
    };
  }
  return { warn: false };
}
