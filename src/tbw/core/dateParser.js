// src/tbw/core/dateParser.js

export function parseHumanDates(text = "") {
  const t = text.toLowerCase();

  // Nova godina
  if (t.includes("nova godina") || t.includes("novu godinu")) {
    return {
      from: "2025-12-31",
      to: "2026-01-02",
      label: "Nova godina",
    };
  }

  // Vikend
  if (t.includes("vikend")) {
    const now = new Date();
    const day = now.getDay();
    const diffToFriday = (5 - day + 7) % 7;
    const friday = new Date(now);
    friday.setDate(now.getDate() + diffToFriday);
    const sunday = new Date(friday);
    sunday.setDate(friday.getDate() + 2);

    return {
      from: friday.toISOString().slice(0, 10),
      to: sunday.toISOString().slice(0, 10),
      label: "Vikend",
    };
  }

  // Ako ne prepozna ništa
  return null;
}
