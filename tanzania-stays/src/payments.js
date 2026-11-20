// Payment providers.
//  - "mock": sandbox that simulates a mobile-money push prompt. No money moves.
//  - "flutterwave": real hosted checkout supporting Tanzanian mobile money
//    (M-Pesa, Mixx by Yas/Tigo Pesa, Airtel Money, HaloPesa) and cards in TZS.
import crypto from 'node:crypto';

const FLW_API = 'https://api.flutterwave.com/v3';

export function createPaymentProvider(env = process.env) {
  const name = (env.PAYMENT_PROVIDER || 'mock').toLowerCase();
  if (name === 'flutterwave') {
    if (!env.FLW_SECRET_KEY || !env.FLW_SECRET_HASH) {
      throw new Error('PAYMENT_PROVIDER=flutterwave requires FLW_SECRET_KEY and FLW_SECRET_HASH');
    }
    return flutterwave(env.FLW_SECRET_KEY, env.FLW_SECRET_HASH);
  }
  return mock();
}

function mock() {
  return {
    name: 'mock',
    async initiate(booking) {
      return {
        mode: 'mock',
        message: `A payment request of TZS ${booking.total.toLocaleString('en-US')} was sent to ${booking.phone}.`,
      };
    },
  };
}

function flutterwave(secretKey, secretHash) {
  const headers = { Authorization: `Bearer ${secretKey}`, 'Content-Type': 'application/json' };

  return {
    name: 'flutterwave',

    async initiate(booking, { baseUrl }) {
      const res = await fetch(`${FLW_API}/payments`, {
        method: 'POST',
        headers,
        body: JSON.stringify({
          tx_ref: booking.id,
          amount: booking.total,
          currency: 'TZS',
          redirect_url: `${baseUrl}/payment/return`,
          payment_options: 'mobilemoneytanzania,card',
          customer: { email: booking.email, phonenumber: booking.phone, name: booking.name },
          customizations: { title: 'Tanzania Stays', description: `Booking ${booking.id}` },
          meta: { booking_id: booking.id },
        }),
      });
      const body = await res.json().catch(() => ({}));
      if (!res.ok || body.status !== 'success' || !body.data?.link) {
        throw new Error(body.message || `Flutterwave error ${res.status}`);
      }
      return { mode: 'redirect', url: body.data.link };
    },

    /** Always confirm with Flutterwave's API; never trust redirect query params alone. */
    async verify(transactionId) {
      const res = await fetch(`${FLW_API}/transactions/${encodeURIComponent(transactionId)}/verify`, { headers });
      const body = await res.json().catch(() => ({}));
      if (!res.ok || body.status !== 'success') return { ok: false };
      const d = body.data;
      return {
        ok: d.status === 'successful',
        failed: d.status === 'failed',
        txRef: d.tx_ref,
        amount: Number(d.amount),
        currency: d.currency,
        transactionId: String(d.id),
      };
    },

    checkWebhookSignature(headerValue) {
      const a = Buffer.from(String(headerValue || ''));
      const b = Buffer.from(secretHash);
      return a.length === b.length && crypto.timingSafeEqual(a, b);
    },
  };
}
