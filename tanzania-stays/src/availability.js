// Pure booking/availability logic. No I/O so it can be unit-tested.

export const HOLD_MINUTES = Number(process.env.HOLD_MINUTES || 10);
export const MAX_NIGHTS = 30;

const DATE_RE = /^\d{4}-\d{2}-\d{2}$/;

export function todayISO(now = new Date()) {
  // Tanzania is UTC+3 with no DST.
  const eat = new Date(now.getTime() + 3 * 3600 * 1000);
  return eat.toISOString().slice(0, 10);
}

function addDays(iso, n) {
  const d = new Date(iso + 'T00:00:00Z');
  d.setUTCDate(d.getUTCDate() + n);
  return d.toISOString().slice(0, 10);
}

export function nightsBetween(checkIn, checkOut) {
  const ms = Date.parse(checkOut + 'T00:00:00Z') - Date.parse(checkIn + 'T00:00:00Z');
  return Math.round(ms / 86400000);
}

/** Returns an error message, or null if the stay dates are valid. */
export function validateStay(checkIn, checkOut, now = new Date()) {
  if (!DATE_RE.test(checkIn || '') || !DATE_RE.test(checkOut || '')) return 'Dates must be YYYY-MM-DD';
  if (Number.isNaN(Date.parse(checkIn)) || Number.isNaN(Date.parse(checkOut))) return 'Invalid date';
  if (checkIn < todayISO(now)) return 'Check-in cannot be in the past';
  const n = nightsBetween(checkIn, checkOut);
  if (n < 1) return 'Check-out must be after check-in';
  if (n > MAX_NIGHTS) return `Stays are limited to ${MAX_NIGHTS} nights`;
  return null;
}

/** A booking holds inventory while confirmed, or while pending and its hold has not expired. */
export function isActive(booking, nowMs = Date.now()) {
  if (booking.status === 'confirmed') return true;
  return booking.status === 'pending' && booking.holdExpiresAt > nowMs;
}

/** Units still free for every night of [checkIn, checkOut). */
export function unitsLeft(listing, bookings, checkIn, checkOut, nowMs = Date.now()) {
  const active = bookings.filter(
    (b) => b.listingId === listing.id && isActive(b, nowMs) && b.checkIn < checkOut && checkIn < b.checkOut,
  );
  let maxUsed = 0;
  for (let night = checkIn; night < checkOut; night = addDays(night, 1)) {
    const used = active.filter((b) => b.checkIn <= night && night < b.checkOut).length;
    if (used > maxUsed) maxUsed = used;
  }
  return Math.max(0, listing.units - maxUsed);
}

export function quote(listing, checkIn, checkOut) {
  const nights = nightsBetween(checkIn, checkOut);
  return { nights, total: nights * listing.pricePerNight, currency: 'TZS' };
}
