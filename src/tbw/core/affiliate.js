export function buildAffiliateUrl({ city, dates, persons }) {
  const base = "https://www.booking.com/searchresults.html";
  const p = new URLSearchParams();

  if (city) p.set("ss", city);
  if (dates?.from) p.set("checkin", dates.from);
  if (dates?.to) p.set("checkout", dates.to);
  if (persons) p.set("group_adults", persons);

  if (import.meta.env.VITE_BOOKING_AFFILIATE_ID) {
    p.set("aid", import.meta.env.VITE_BOOKING_AFFILIATE_ID);
  }

  return `${base}?${p.toString()}`;
}
