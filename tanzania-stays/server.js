import http from 'node:http';
import fs from 'node:fs';
import path from 'node:path';
import crypto from 'node:crypto';
import { fileURLToPath } from 'node:url';
import { openStore } from './src/store.js';
import { createPaymentProvider } from './src/payments.js';
import { HOLD_MINUTES, isActive, quote, unitsLeft, validateStay } from './src/availability.js';

const ROOT = path.dirname(fileURLToPath(import.meta.url));
const PUBLIC = path.join(ROOT, 'public');
const PORT = Number(process.env.PORT || 3000);
const TYPES = ['hotel', 'apartment', 'motel', 'lodge'];

const store = openStore(process.env.DATA_FILE || path.join(ROOT, 'data', 'db.json'));
const payments = createPaymentProvider();

// ---------- Real-time (Server-Sent Events) ----------
const clients = new Set();
function broadcast(event, data) {
  const msg = `event: ${event}\ndata: ${JSON.stringify(data)}\n\n`;
  for (const res of clients) res.write(msg);
}
setInterval(() => { for (const res of clients) res.write(': ping\n\n'); }, 25000).unref();

// Release expired holds so the rooms reappear for everyone.
setInterval(() => {
  const now = Date.now();
  for (const b of store.bookings) {
    if (b.status === 'pending' && b.holdExpiresAt <= now) {
      store.update(b, { status: 'expired' });
      broadcast('booking', publicBooking(b));
      broadcast('availability', { listingId: b.listingId });
    }
  }
}, 5000).unref();

// ---------- Helpers ----------
function publicBooking(b) {
  const l = store.listing(b.listingId);
  return {
    id: b.id, status: b.status, listingId: b.listingId, listingName: l?.name, town: l?.town,
    checkIn: b.checkIn, checkOut: b.checkOut, guests: b.guests, nights: b.nights,
    total: b.total, currency: b.currency, name: b.name, holdExpiresAt: b.holdExpiresAt,
  };
}

function newBookingId() {
  const alphabet = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';
  const bytes = crypto.randomBytes(8);
  return 'TZ-' + Array.from(bytes, (x) => alphabet[x % alphabet.length]).join('');
}

function send(res, status, body, headers = {}) {
  res.writeHead(status, { 'Content-Type': 'application/json; charset=utf-8', ...headers });
  res.end(JSON.stringify(body));
}

async function readJson(req, limit = 32 * 1024) {
  let size = 0;
  const chunks = [];
  for await (const c of req) {
    size += c.length;
    if (size > limit) throw Object.assign(new Error('Body too large'), { status: 413 });
    chunks.push(c);
  }
  try { return JSON.parse(Buffer.concat(chunks).toString('utf8') || '{}'); }
  catch { throw Object.assign(new Error('Invalid JSON'), { status: 400 }); }
}

function baseUrl(req) {
  if (process.env.PUBLIC_URL) return process.env.PUBLIC_URL.replace(/\/$/, '');
  const proto = req.headers['x-forwarded-proto'] || 'http';
  return `${proto}://${req.headers.host}`;
}

/** Applies a verified payment to its booking. Idempotent. */
function applyPayment(booking, result) {
  if (booking.status === 'confirmed') return;
  if (!result.ok) {
    if (result.failed && booking.status === 'pending') {
      store.update(booking, { status: 'failed' });
      broadcast('booking', publicBooking(booking));
      broadcast('availability', { listingId: booking.listingId });
    }
    return;
  }
  if (result.txRef !== booking.id || result.currency !== 'TZS' || result.amount < booking.total) {
    store.update(booking, { status: 'review', note: 'Payment details did not match booking' });
    broadcast('booking', publicBooking(booking));
    return;
  }
  // If the hold lapsed while the guest was paying, confirm only if a unit is still free.
  if (!isActive(booking)) {
    const listing = store.listing(booking.listingId);
    const others = store.bookings.filter((b) => b !== booking);
    if (unitsLeft(listing, others, booking.checkIn, booking.checkOut) < 1) {
      store.update(booking, { status: 'refund_required', transactionId: result.transactionId });
      broadcast('booking', publicBooking(booking));
      return;
    }
  }
  store.update(booking, { status: 'confirmed', paidAt: Date.now(), transactionId: result.transactionId });
  broadcast('booking', publicBooking(booking));
  broadcast('availability', { listingId: booking.listingId });
  const l = store.listing(booking.listingId);
  broadcast('activity', { text: `${l.name} in ${l.town} was just booked`, at: Date.now() });
}

// ---------- Routes ----------
async function api(req, res, url) {
  const { pathname } = url;

  if (req.method === 'GET' && pathname === '/api/config') {
    return send(res, 200, { paymentProvider: payments.name, holdMinutes: HOLD_MINUTES, types: TYPES });
  }

  if (req.method === 'GET' && pathname === '/api/stream') {
    res.writeHead(200, {
      'Content-Type': 'text/event-stream', 'Cache-Control': 'no-cache', Connection: 'keep-alive',
      'X-Accel-Buffering': 'no',
    });
    res.write('retry: 3000\n\n');
    clients.add(res);
    req.on('close', () => clients.delete(res));
    return;
  }

  if (req.method === 'GET' && pathname === '/api/listings') {
    const q = Object.fromEntries(url.searchParams);
    const guests = Number(q.guests || 1);
    const haveDates = q.checkIn && q.checkOut;
    if (haveDates) {
      const err = validateStay(q.checkIn, q.checkOut);
      if (err) return send(res, 400, { error: err });
    }
    const results = store.listings
      .filter((l) => !q.type || q.type === 'all' || l.type === q.type)
      .filter((l) => !q.region || q.region === 'all' || l.region === q.region)
      .filter((l) => l.maxGuests >= guests)
      .map((l) => ({
        ...l,
        unitsLeft: haveDates ? unitsLeft(l, store.bookings, q.checkIn, q.checkOut) : null,
        quote: haveDates ? quote(l, q.checkIn, q.checkOut) : null,
      }));
    const regions = [...new Set(store.listings.map((l) => l.region))].sort();
    return send(res, 200, { listings: results, regions });
  }

  if (req.method === 'POST' && pathname === '/api/listings') {
    if (!process.env.ADMIN_TOKEN || req.headers.authorization !== `Bearer ${process.env.ADMIN_TOKEN}`) {
      return send(res, 401, { error: 'Unauthorized' });
    }
    const b = await readJson(req);
    const required = ['name', 'type', 'region', 'town', 'pricePerNight', 'units', 'maxGuests'];
    for (const k of required) if (b[k] === undefined || b[k] === '') return send(res, 400, { error: `${k} is required` });
    if (!TYPES.includes(b.type)) return send(res, 400, { error: `type must be one of ${TYPES.join(', ')}` });
    const id = String(b.name).toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '') + '-' + crypto.randomBytes(2).toString('hex');
    const listing = store.addListing({
      id, name: String(b.name), type: b.type, region: String(b.region), town: String(b.town),
      scene: ['coast', 'mountain', 'savanna', 'city', 'lake'].includes(b.scene) ? b.scene : 'city',
      pricePerNight: Math.round(Number(b.pricePerNight)), units: Math.max(1, Math.round(Number(b.units))),
      maxGuests: Math.max(1, Math.round(Number(b.maxGuests))),
      amenities: Array.isArray(b.amenities) ? b.amenities.map(String).slice(0, 8) : [],
      description: String(b.description || ''),
    });
    broadcast('availability', { listingId: listing.id });
    return send(res, 201, listing);
  }

  if (req.method === 'POST' && pathname === '/api/bookings') {
    const b = await readJson(req);
    const listing = store.listing(b.listingId);
    if (!listing) return send(res, 404, { error: 'Property not found' });
    const err = validateStay(b.checkIn, b.checkOut);
    if (err) return send(res, 400, { error: err });
    const guests = Number(b.guests);
    if (!Number.isInteger(guests) || guests < 1 || guests > listing.maxGuests) {
      return send(res, 400, { error: `This property allows 1–${listing.maxGuests} guests` });
    }
    const name = String(b.name || '').trim();
    const email = String(b.email || '').trim();
    const phone = String(b.phone || '').replace(/[\s-]/g, '');
    if (name.length < 2) return send(res, 400, { error: 'Please enter your full name' });
    if (!/^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(email)) return send(res, 400, { error: 'Please enter a valid email' });
    if (!/^(\+?255|0)[67]\d{8}$/.test(phone)) return send(res, 400, { error: 'Enter a Tanzanian mobile number, e.g. 0712 345 678' });

    // Synchronous check-and-hold: no other request can interleave here.
    if (unitsLeft(listing, store.bookings, b.checkIn, b.checkOut) < 1) {
      return send(res, 409, { error: 'Sorry, that property just sold out for these dates' });
    }
    const q = quote(listing, b.checkIn, b.checkOut);
    const booking = store.addBooking({
      id: newBookingId(), listingId: listing.id, checkIn: b.checkIn, checkOut: b.checkOut, guests,
      name, email, phone: phone.replace(/^0/, '255').replace(/^\+/, ''), nights: q.nights, total: q.total,
      currency: q.currency, status: 'pending', createdAt: Date.now(),
      holdExpiresAt: Date.now() + HOLD_MINUTES * 60000, provider: payments.name,
    });
    broadcast('availability', { listingId: listing.id });

    try {
      const payment = await payments.initiate(booking, { baseUrl: baseUrl(req) });
      return send(res, 201, { booking: publicBooking(booking), payment });
    } catch (e) {
      store.update(booking, { status: 'failed', note: e.message });
      broadcast('availability', { listingId: listing.id });
      return send(res, 502, { error: 'Could not start payment. Please try again.' });
    }
  }

  const bookingMatch = pathname.match(/^\/api\/bookings\/([A-Z0-9-]+)$/);
  if (req.method === 'GET' && bookingMatch) {
    const b = store.booking(bookingMatch[1]);
    return b ? send(res, 200, publicBooking(b)) : send(res, 404, { error: 'Booking not found' });
  }

  // Sandbox only: simulate the guest approving/declining the mobile-money prompt.
  const mockMatch = pathname.match(/^\/api\/payments\/mock\/([A-Z0-9-]+)\/(approve|decline)$/);
  if (req.method === 'POST' && mockMatch) {
    if (payments.name !== 'mock') return send(res, 404, { error: 'Not found' });
    const b = store.booking(mockMatch[1]);
    if (!b) return send(res, 404, { error: 'Booking not found' });
    const approve = mockMatch[2] === 'approve';
    applyPayment(b, {
      ok: approve, failed: !approve, txRef: b.id, amount: b.total, currency: 'TZS',
      transactionId: 'MOCK-' + crypto.randomBytes(4).toString('hex'),
    });
    return send(res, 200, publicBooking(b));
  }

  if (req.method === 'POST' && pathname === '/api/payments/webhook') {
    if (payments.name !== 'flutterwave' || !payments.checkWebhookSignature(req.headers['verif-hash'])) {
      return send(res, 401, { error: 'Invalid signature' });
    }
    const evt = await readJson(req, 256 * 1024);
    const data = evt.data || {};
    const b = store.booking(data.tx_ref);
    if (b && data.id) applyPayment(b, await payments.verify(data.id));
    return send(res, 200, { received: true });
  }

  return send(res, 404, { error: 'Not found' });
}

async function paymentReturn(req, res, url) {
  const txRef = url.searchParams.get('tx_ref');
  const txId = url.searchParams.get('transaction_id');
  const b = txRef && store.booking(txRef);
  if (b && payments.name === 'flutterwave') {
    if (txId) applyPayment(b, await payments.verify(txId));
    else if (url.searchParams.get('status') === 'cancelled' && b.status === 'pending') {
      store.update(b, { status: 'failed', note: 'Cancelled by guest' });
      broadcast('availability', { listingId: b.listingId });
    }
  }
  res.writeHead(302, { Location: b ? `/?booking=${encodeURIComponent(b.id)}` : '/' });
  res.end();
}

const MIME = {
  '.html': 'text/html; charset=utf-8', '.css': 'text/css; charset=utf-8', '.js': 'text/javascript; charset=utf-8',
  '.svg': 'image/svg+xml', '.png': 'image/png', '.ico': 'image/x-icon', '.json': 'application/json',
};

function serveStatic(req, res, url) {
  const rel = url.pathname === '/' ? 'index.html' : decodeURIComponent(url.pathname).slice(1);
  const file = path.resolve(PUBLIC, rel);
  if (!file.startsWith(PUBLIC + path.sep)) return send(res, 403, { error: 'Forbidden' });
  fs.readFile(file, (err, data) => {
    if (err) return send(res, 404, { error: 'Not found' });
    res.writeHead(200, { 'Content-Type': MIME[path.extname(file)] || 'application/octet-stream' });
    res.end(data);
  });
}

const server = http.createServer(async (req, res) => {
  const url = new URL(req.url, 'http://localhost');
  try {
    if (url.pathname.startsWith('/api/')) return await api(req, res, url);
    if (url.pathname === '/payment/return') return await paymentReturn(req, res, url);
    return serveStatic(req, res, url);
  } catch (e) {
    console.error(e);
    if (!res.headersSent) send(res, e.status || 500, { error: e.status ? e.message : 'Server error' });
  }
});

server.listen(PORT, () => {
  console.log(`Tanzania Stays running on http://localhost:${PORT} (payments: ${payments.name})`);
});
