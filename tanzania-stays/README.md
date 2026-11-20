# Tanzania Stays

An animated booking site for hotels, lodges, apartments and motels across Tanzania, with
**real-time availability** and **real-time payment** (M-Pesa, Mixx by Yas, Airtel Money, HaloPesa, cards, all in TZS).

No npm dependencies: it needs only Node.js 20.6 or newer.

```bash
cd tanzania-stays
cp .env.example .env     # optional; defaults work
npm start                # http://localhost:3000
npm test
```

## How it works

| Part | What it does |
|---|---|
| **Live availability** | Every browser keeps a Server-Sent Events connection (`/api/stream`). When anyone books, pays, cancels, or lets a hold expire, all open pages update their "N available" badges right away, and a "just booked" toast appears. |
| **No double-booking** | When a guest clicks **Pay**, the room is held for `HOLD_MINUTES` (default 10). The availability check and the hold happen in one step, so two guests can't grab the last room. Holds that go unpaid expire and the room is released. |
| **Payments** | `PAYMENT_PROVIDER=mock` (default) is a sandbox: the guest sees an "approve on your phone" screen and you click **Approve** or **Decline**. No money moves. `PAYMENT_PROVIDER=flutterwave` sends guests to Flutterwave's hosted checkout for Tanzanian mobile money and cards. |
| **Payment safety** | Bookings are confirmed only after the server checks the transaction with Flutterwave's API (amount, currency, reference). Signed webhooks confirm it even if the guest closes the tab. If a payment arrives after the hold expired and the room was taken, the booking is marked `refund_required`. |

## Going live with real payments

1. Create a [Flutterwave](https://flutterwave.com) account with Tanzania (TZS) collections enabled.
2. In `.env` set:
   ```
   PAYMENT_PROVIDER=flutterwave
   FLW_SECRET_KEY=FLWSECK_TEST-...   # test key first, then live key
   FLW_SECRET_HASH=<long random string>
   PUBLIC_URL=https://your-domain.co.tz
   ```
3. In the Flutterwave dashboard under **Settings → Webhooks**, set the URL to `https://your-domain.co.tz/api/payments/webhook` and the secret hash to the same `FLW_SECRET_HASH`.
4. Deploy behind HTTPS (Render, Railway, Fly.io, a VPS with Nginx, etc.).

## Properties

The 12 listings in `src/seed.js` are **fictional samples** in real Tanzanian towns, so the site works out of the box.
Replace them with real partner properties. You can edit `data/db.json` (created on first booking) or add listings through the API:

```bash
curl -X POST http://localhost:3000/api/listings \
  -H "Authorization: Bearer $ADMIN_TOKEN" -H "Content-Type: application/json" \
  -d '{"name":"Example Lodge","type":"lodge","region":"Arusha","town":"Karatu","scene":"savanna",
       "pricePerNight":180000,"units":6,"maxGuests":3,"amenities":["Pool","Breakfast"],"description":"..."}'
```

`type` is one of `hotel`, `lodge`, `apartment`, `motel`. `scene` is one of `coast`, `mountain`, `savanna`, `city`, `lake` (the card illustration).

## Before production

This is a solid starting point, not a finished marketplace. Before taking real guests, you will want:

- **A real database** (PostgreSQL) instead of the JSON file, if you run more than one server instance.
- **Confirmation emails/SMS** (e.g. via Beem Africa or Africa's Talking) when a booking is confirmed.
- **An owner dashboard** so properties can manage rooms, prices and blocked dates.
- **Rate limiting** on `POST /api/bookings`, so nobody can hold every room with fake bookings.
- **Refund handling** for `refund_required` bookings.

## API

| Method | Path | Purpose |
|---|---|---|
| GET | `/api/listings?type=&region=&checkIn=&checkOut=&guests=` | Search with live units left and price quote |
| POST | `/api/bookings` | Hold a room and start payment |
| GET | `/api/bookings/:id` | Booking status |
| GET | `/api/stream` | Real-time events: `availability`, `booking`, `activity` |
| POST | `/api/payments/webhook` | Flutterwave webhook |
| GET | `/payment/return` | Flutterwave redirect back to the site |
| POST | `/api/payments/mock/:id/approve` or `/decline` | Sandbox only |
