// Tiny JSON-file store. Node is single-threaded, so check-then-write inside
// one synchronous block is atomic and prevents double-booking.
import fs from 'node:fs';
import path from 'node:path';
import { SEED_LISTINGS } from './seed.js';

export function openStore(file) {
  let db = { listings: SEED_LISTINGS, bookings: [] };
  if (file && fs.existsSync(file)) {
    db = JSON.parse(fs.readFileSync(file, 'utf8'));
  }
  let timer = null;

  function save() {
    if (!file) return;
    clearTimeout(timer);
    timer = setTimeout(() => {
      fs.mkdirSync(path.dirname(file), { recursive: true });
      const tmp = file + '.tmp';
      fs.writeFileSync(tmp, JSON.stringify(db, null, 2));
      fs.renameSync(tmp, file);
    }, 50);
  }

  return {
    get listings() { return db.listings; },
    get bookings() { return db.bookings; },
    listing: (id) => db.listings.find((l) => l.id === id),
    booking: (id) => db.bookings.find((b) => b.id === id),
    addBooking(b) { db.bookings.push(b); save(); return b; },
    addListing(l) { db.listings.push(l); save(); return l; },
    update(b, patch) { Object.assign(b, patch, { updatedAt: Date.now() }); save(); return b; },
    save,
  };
}
