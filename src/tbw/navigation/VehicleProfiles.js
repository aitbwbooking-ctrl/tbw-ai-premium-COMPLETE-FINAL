/**
 * TBW Vehicle Profiles™
 * – automatski ili ručno
 * – utječu na rute, upozorenja i zabrane
 */

export const VEHICLE_PROFILES = {
  CAR: {
    label: "Car",
    maxSpeedLogic: true,
    heightLimit: null,
  },
  TRUCK: {
    label: "Truck",
    heightLimit: 4.0,
    weightLimit: true,
    cityRestrictions: true,
  },
  TRUCK_TRAILER: {
    label: "Truck + Trailer",
    heightLimit: 4.2,
    turnRadiusWarning: true,
  },
  ADR: {
    label: "ADR (Hazardous)",
    tunnelRestrictions: true,
    urbanBan: true,
    emergencyPriority: true,
  },
  AGRI: {
    label: "Agricultural",
    slowVehicle: true,
    daylightPreference: true,
  },
  MARINE: {
    label: "Boat / Yacht",
    windLimitCheck: true,
    marinaData: true,
  },
  AIR: {
    label: "Flight / Passenger",
    airportLogic: true,
    turbulenceAdvisory: true,
  },
};
