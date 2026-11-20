import { test } from 'node:test';
import assert from 'node:assert/strict';
import { isActive, quote, unitsLeft, validateStay, todayISO } from '../src/availability.js';

const listing = { id: 'x', units: 2, pricePerNight: 100000 };
const now = Date.now();
const bk = (checkIn, checkOut, status = 'confirmed', holdExpiresAt = now + 60000) =>
  ({ listingId: 'x', checkIn, checkOut, status, holdExpiresAt });

test('overlapping bookings reduce availability', () => {
  const bookings = [bk('2030-01-10', '2030-01-12'), bk('2030-01-11', '2030-01-13')];
  assert.equal(unitsLeft(listing, bookings, '2030-01-11', '2030-01-12', now), 0);
  assert.equal(unitsLeft(listing, bookings, '2030-01-10', '2030-01-11', now), 1);
});

test('back-to-back stays do not conflict (checkout day is free)', () => {
  const bookings = [bk('2030-01-10', '2030-01-12'), bk('2030-01-10', '2030-01-12')];
  assert.equal(unitsLeft(listing, bookings, '2030-01-12', '2030-01-14', now), 2);
});

test('non-overlapping bookings within the range use the max per night, not the sum', () => {
  const bookings = [bk('2030-01-10', '2030-01-11'), bk('2030-01-12', '2030-01-13')];
  assert.equal(unitsLeft(listing, bookings, '2030-01-10', '2030-01-13', now), 1);
});

test('expired holds and failed bookings free the room', () => {
  const bookings = [bk('2030-01-10', '2030-01-12', 'pending', now - 1), bk('2030-01-10', '2030-01-12', 'failed')];
  assert.equal(unitsLeft(listing, bookings, '2030-01-10', '2030-01-12', now), 2);
  assert.equal(isActive(bk('a', 'b', 'pending', now + 1), now), true);
});

test('stay validation and pricing', () => {
  assert.match(validateStay('2000-01-01', '2000-01-02'), /past/);
  assert.match(validateStay('2099-01-02', '2099-01-02'), /after/);
  assert.match(validateStay('2099-01-01', '2099-03-01'), /30 nights/);
  assert.equal(validateStay(todayISO(), '2099-01-01'), 'Stays are limited to 30 nights');
  assert.equal(validateStay('2099-01-01', '2099-01-04'), null);
  assert.deepEqual(quote(listing, '2099-01-01', '2099-01-04'), { nights: 3, total: 300000, currency: 'TZS' });
});
