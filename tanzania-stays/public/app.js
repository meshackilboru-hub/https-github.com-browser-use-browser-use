const $ = (s, el = document) => el.querySelector(s);
const esc = (s) => String(s ?? '').replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[c]);
const tzs = (n) => 'TZS ' + Math.round(n).toLocaleString('en-US');
const fmtDate = (iso) => new Date(iso + 'T00:00:00').toLocaleDateString('en-GB', { day: 'numeric', month: 'short' });

const state = { type: 'all', listings: [], config: {}, booking: null, timer: null, prevLeft: new Map() };
const modal = $('#modal');
const body = $('#modalBody');

// ---------- Illustrated scenes (no stock photos needed) ----------
const SCENES = {
  coast: `<defs><linearGradient id="g-coast" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="#fdba74"/><stop offset=".55" stop-color="#fde68a"/><stop offset=".56" stop-color="#22d3ee"/><stop offset="1" stop-color="#0e7490"/></linearGradient></defs>
    <rect width="320" height="200" fill="url(#g-coast)"/><circle class="sun" cx="230" cy="78" r="26" fill="#fff7ed"/>
    <path class="wave" d="M-20 128q20-8 40 0t40 0 40 0 40 0 40 0 40 0 40 0 40 0 40 0v80h-360z" fill="#0891b2" opacity=".55"/>
    <path d="M70 120l28-58 4 58z" fill="#fff"/><path d="M58 120h56l-8 10H66z" fill="#7c2d12"/>
    <path d="M0 170q80-22 160 0t160 0v30H0z" fill="#fde68a"/>`,
  mountain: `<defs><linearGradient id="g-mtn" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="#7dd3fc"/><stop offset="1" stop-color="#fef3c7"/></linearGradient></defs>
    <rect width="320" height="200" fill="url(#g-mtn)"/><circle class="sun" cx="60" cy="50" r="18" fill="#fff"/>
    <path d="M40 160l120-110 130 110z" fill="#475569"/><path d="M128 80l32-30 34 30-14 6-12-8-12 9-10-8z" fill="#fff"/>
    <path d="M-10 170q70-40 140-10t200-10v50H-10z" fill="#65a30d"/><path d="M0 182q90-24 180 0t140-6v24H0z" fill="#3f6212"/>`,
  savanna: `<defs><linearGradient id="g-sav" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="#f97316"/><stop offset=".7" stop-color="#fcd34d"/></linearGradient></defs>
    <rect width="320" height="200" fill="url(#g-sav)"/><circle class="sun" cx="170" cy="120" r="38" fill="#fff7ed" opacity=".9"/>
    <path d="M0 150h320v50H0z" fill="#78350f"/><path d="M0 146q160-12 320 0v8H0z" fill="#92400e"/>
    <path d="M232 148v-46" stroke="#1c1917" stroke-width="5"/><path d="M192 100q40-18 82 0q-40 10-82 0z" fill="#1c1917"/>
    <path d="M60 148v-22" stroke="#1c1917" stroke-width="3"/><path d="M40 126q20-10 42 0q-20 6-42 0z" fill="#1c1917"/>`,
  city: `<defs><linearGradient id="g-city" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="#0e7490"/><stop offset="1" stop-color="#f0abfc"/></linearGradient></defs>
    <rect width="320" height="200" fill="url(#g-city)"/><circle class="sun" cx="250" cy="60" r="20" fill="#fef9c3"/>
    <g fill="#12313b"><rect x="20" y="90" width="34" height="80"/><rect x="60" y="60" width="28" height="110"/><rect x="94" y="100" width="40" height="70"/><rect x="140" y="40" width="30" height="130"/><rect x="176" y="80" width="38" height="90"/><rect x="220" y="110" width="30" height="60"/><rect x="256" y="70" width="44" height="100"/></g>
    <g fill="#fde68a" opacity=".8"><rect x="66" y="70" width="5" height="5"/><rect x="76" y="86" width="5" height="5"/><rect x="146" y="56" width="5" height="5"/><rect x="156" y="80" width="5" height="5"/><rect x="264" y="84" width="5" height="5"/><rect x="282" y="100" width="5" height="5"/></g>
    <path class="wave" d="M-20 172q20-6 40 0t40 0 40 0 40 0 40 0 40 0 40 0 40 0 40 0v40h-360z" fill="#0891b2"/>`,
  lake: `<defs><linearGradient id="g-lake" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="#bae6fd"/><stop offset=".55" stop-color="#e0f2fe"/><stop offset=".56" stop-color="#38bdf8"/><stop offset="1" stop-color="#1e40af"/></linearGradient></defs>
    <rect width="320" height="200" fill="url(#g-lake)"/><circle class="sun" cx="80" cy="60" r="20" fill="#fff"/>
    <path d="M150 112q30-34 60-10q20-24 50 0q20-10 60 10z" fill="#64748b"/><ellipse cx="190" cy="104" rx="16" ry="10" fill="#475569"/>
    <path class="wave" d="M-20 140q20-6 40 0t40 0 40 0 40 0 40 0 40 0 40 0 40 0 40 0v80h-360z" fill="#0284c7" opacity=".5"/>
    <path d="M70 150h50l-8 8H78z" fill="#7c2d12"/><path d="M94 150v-26l14 26z" fill="#fff"/>`,
};
const scene = (k) => `<svg viewBox="0 0 320 200" preserveAspectRatio="xMidYMid slice" aria-hidden="true">${SCENES[k] || SCENES.city}</svg>`;
const PIN = '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M12 21s-7-6.2-7-11.5A7 7 0 0 1 19 9.5C19 14.8 12 21 12 21z"/><circle cx="12" cy="9.5" r="2.5"/></svg>';

// ---------- Search ----------
function isoPlus(days) {
  const d = new Date(); d.setDate(d.getDate() + days);
  return d.toLocaleDateString('en-CA');
}
const ci = $('#checkIn'), co = $('#checkOut');
ci.min = isoPlus(0); ci.value = isoPlus(1); co.value = isoPlus(3); co.min = isoPlus(1);
ci.addEventListener('change', () => {
  const next = new Date(ci.value); next.setDate(next.getDate() + 1);
  co.min = next.toLocaleDateString('en-CA');
  if (co.value <= ci.value) co.value = co.min;
});

function query() {
  return new URLSearchParams({
    type: state.type, region: $('#region').value, checkIn: ci.value, checkOut: co.value, guests: $('#guests').value,
  });
}

async function load({ quiet = false } = {}) {
  if (!quiet) $('#grid').innerHTML = Array.from({ length: 6 }, () => '<div class="skeleton"></div>').join('');
  const res = await fetch('/api/listings?' + query());
  const data = await res.json();
  if (!res.ok) { $('#grid').innerHTML = `<p class="empty">${esc(data.error)}</p>`; $('#count').textContent = ''; return; }
  const sel = $('#region');
  if (sel.options.length === 1) for (const r of data.regions) sel.add(new Option(r, r));
  state.listings = data.listings;
  render(quiet);
}

function leftLabel(n) {
  if (n === 0) return ['Sold out', 'none'];
  if (n <= 2) return [`Only ${n} left`, 'low'];
  return [`${n} available`, ''];
}

function render(quiet) {
  const grid = $('#grid');
  const list = state.listings;
  const open = list.filter((l) => l.unitsLeft > 0).length;
  $('#count').textContent = `${open} of ${list.length} stays available for your dates`;
  if (!list.length) { grid.innerHTML = '<p class="empty">No stays match these filters. Try another region or fewer guests.</p>'; return; }

  if (quiet && grid.children.length === list.length) {
    // Live update in place: only touch the availability badges and buttons.
    for (const l of list) {
      const card = grid.querySelector(`[data-id="${CSS.escape(l.id)}"]`);
      if (!card) return render(false);
      const [txt, cls] = leftLabel(l.unitsLeft);
      const badge = $('.left', card);
      if (badge.textContent !== txt) {
        badge.textContent = txt; badge.className = 'left ' + cls;
        void badge.offsetWidth; badge.classList.add('flash');
      }
      $('.book', card).disabled = l.unitsLeft === 0;
    }
    return;
  }

  grid.innerHTML = list.map((l, i) => {
    const [txt, cls] = leftLabel(l.unitsLeft);
    return `<article class="card" style="--i:${i}" data-id="${esc(l.id)}">
      <div class="scene">${scene(l.scene)}<span class="badge">${esc(l.type)}</span><span class="left ${cls}">${txt}</span></div>
      <div class="card-body">
        <h3>${esc(l.name)}</h3>
        <p class="loc">${PIN}${esc(l.town)}, ${esc(l.region)} · up to ${l.maxGuests} guests</p>
        <p class="desc">${esc(l.description)}</p>
        <ul class="amen">${l.amenities.map((a) => `<li>${esc(a)}</li>`).join('')}</ul>
        <div class="card-foot">
          <div class="price"><strong>${tzs(l.pricePerNight)}</strong><small>per night · ${tzs(l.quote.total)} for ${l.quote.nights} night${l.quote.nights > 1 ? 's' : ''}</small></div>
          <button class="btn primary book" type="button" data-id="${esc(l.id)}" ${l.unitsLeft === 0 ? 'disabled' : ''}>Book</button>
        </div>
      </div>
    </article>`;
  }).join('');
}

$('#search').addEventListener('submit', (e) => { e.preventDefault(); load(); $('#results').scrollIntoView(); });
$('#chips').addEventListener('click', (e) => {
  const chip = e.target.closest('.chip'); if (!chip) return;
  for (const c of $('#chips').children) { c.classList.toggle('active', c === chip); c.setAttribute('aria-checked', c === chip); }
  state.type = chip.dataset.type; load();
});
$('#grid').addEventListener('click', (e) => {
  const btn = e.target.closest('.book'); if (btn) openBooking(state.listings.find((l) => l.id === btn.dataset.id));
});

// ---------- Booking flow ----------
function head(title) {
  return `<div class="modal-head"><h2 id="modalTitle">${title}</h2><button class="x" type="button" data-close aria-label="Close">×</button></div>`;
}
body.addEventListener('click', (e) => { if (e.target.closest('[data-close]')) closeModal(); });
modal.addEventListener('click', (e) => { if (e.target === modal) closeModal(); });
modal.addEventListener('close', () => { clearInterval(state.timer); state.booking = null; });
function closeModal() { modal.close(); history.replaceState(null, '', '/'); }

function openBooking(l) {
  const q = l.quote;
  const sandbox = state.config.paymentProvider === 'mock';
  body.innerHTML = `${head(esc(l.name))}
    <div class="summary">
      <div><span>${fmtDate(ci.value)} → ${fmtDate(co.value)}</span><span>${q.nights} night${q.nights > 1 ? 's' : ''}</span></div>
      <div><span>${$('#guests').value} guest(s)</span><span>${tzs(l.pricePerNight)} / night</span></div>
      <div class="total"><span>Total</span><span>${tzs(q.total)}</span></div>
    </div>
    <form class="form" id="bookForm">
      <label>Full name<input name="name" required autocomplete="name" minlength="2"></label>
      <label>Email<input name="email" type="email" required autocomplete="email"></label>
      <label>Mobile number (for payment)<input name="phone" type="tel" required autocomplete="tel" placeholder="0712 345 678"></label>
      <div class="methods" aria-label="Accepted payment methods"><span>M-Pesa</span><span>Mixx by Yas</span><span>Airtel Money</span><span>HaloPesa</span><span>Card</span></div>
      <p class="hint">We hold your room for ${state.config.holdMinutes} minutes while you pay. ${sandbox ? '<span class="sandbox">Sandbox mode, no real charge</span>' : ''}</p>
      <p class="error" id="formError" role="alert"></p>
      <button class="btn primary" type="submit">Pay ${tzs(q.total)}</button>
    </form>`;
  modal.showModal();

  $('#bookForm').addEventListener('submit', async (e) => {
    e.preventDefault();
    const btn = e.submitter; btn.disabled = true; btn.textContent = 'Reserving…';
    const fd = Object.fromEntries(new FormData(e.target));
    const res = await fetch('/api/bookings', {
      method: 'POST', headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ ...fd, listingId: l.id, checkIn: ci.value, checkOut: co.value, guests: Number($('#guests').value) }),
    });
    const data = await res.json();
    if (!res.ok) {
      $('#formError').textContent = data.error; btn.disabled = false; btn.textContent = `Pay ${tzs(q.total)}`;
      if (res.status === 409) load({ quiet: true });
      return;
    }
    state.booking = data.booking;
    if (data.payment.mode === 'redirect') { showProcessing('Opening secure checkout…'); location.href = data.payment.url; return; }
    showAwaiting(data.payment.message);
  });
}

function showProcessing(msg) {
  body.innerHTML = `<div class="state"><div class="spinner" aria-hidden="true"></div><p>${esc(msg)}</p></div>`;
}

function showAwaiting(message) {
  const b = state.booking;
  body.innerHTML = `${head('Approve on your phone')}
    <div class="state">
      <div class="phone" aria-hidden="true"></div>
      <p>${esc(message)}<br>Enter your PIN on the prompt to confirm.</p>
      <p>Room held for <span class="timer" id="timer"></span></p>
      ${state.config.paymentProvider === 'mock' ? `<p class="sandbox">Sandbox: simulate the customer’s response</p>
      <div class="row"><button class="btn primary" data-mock="approve">Approve payment</button><button class="btn ghost" data-mock="decline">Decline</button></div>` : ''}
    </div>`;
  body.querySelectorAll('[data-mock]').forEach((btn) => btn.addEventListener('click', async () => {
    btn.disabled = true;
    const r = await fetch(`/api/payments/mock/${b.id}/${btn.dataset.mock}`, { method: 'POST' });
    if (r.ok) showResult(await r.json());
  }));
  tick();
  clearInterval(state.timer);
  state.timer = setInterval(tick, 1000);
}

function tick() {
  const el = $('#timer'); if (!el || !state.booking) return;
  const ms = Math.max(0, state.booking.holdExpiresAt - Date.now());
  el.textContent = `${Math.floor(ms / 60000)}:${String(Math.floor(ms / 1000) % 60).padStart(2, '0')}`;
}

function showResult(b) {
  state.booking = b;
  clearInterval(state.timer);
  if (!modal.open) modal.showModal();
  if (b.status === 'pending') return showAwaiting('Waiting for your payment.');
  const ok = b.status === 'confirmed';
  const messages = {
    failed: ['Payment not completed', 'The payment was declined or cancelled, so your room was released. You can try again.'],
    expired: ['Hold expired', 'We didn’t receive payment in time, so the room was released for other guests.'],
    refund_required: ['Payment received, room unavailable', 'Your payment arrived after the hold expired and the room was taken. Our team will refund you in full.'],
    review: ['Payment under review', 'We received a payment that needs a quick manual check. We’ll email you shortly.'],
  };
  const [title, text] = ok ? ['Booking confirmed', `See you in ${esc(b.town)}! A confirmation for ${fmtDate(b.checkIn)} → ${fmtDate(b.checkOut)} is on its way.`] : messages[b.status] || ['Booking update', b.status];
  body.innerHTML = `${head('')}
    <div class="state">
      <svg class="check ${ok ? '' : 'bad'}" viewBox="0 0 100 100" aria-hidden="true"><circle cx="50" cy="50" r="45"/>${ok ? '<path d="M30 52l13 13 27-29"/>' : '<path d="M35 35l30 30M65 35L35 65"/>'}</svg>
      <h2>${title}</h2>
      <p>${text}</p>
      ${ok ? `<div><p class="hint">Booking reference</p><div class="ref">${esc(b.id)}</div></div>
      <div class="summary" style="width:100%;text-align:left"><div><span>${esc(b.listingName)}</span><span>${b.nights} night${b.nights > 1 ? 's' : ''}</span></div><div class="total"><span>Paid</span><span>${tzs(b.total)}</span></div></div>` : ''}
      <button class="btn ${ok ? 'ghost' : 'primary'}" data-close>${ok ? 'Done' : 'Back to stays'}</button>
    </div>`;
  if (ok) history.replaceState(null, '', `/?booking=${encodeURIComponent(b.id)}`);
}

// ---------- Real-time ----------
function toast(text) {
  const t = document.createElement('div'); t.className = 'toast'; t.textContent = text;
  $('#toasts').append(t);
  setTimeout(() => { t.classList.add('out'); t.addEventListener('animationend', () => t.remove()); }, 4500);
}

let refetch;
function connect() {
  const es = new EventSource('/api/stream');
  const live = $('#live');
  es.onopen = () => { live.classList.add('on'); $('#liveText').textContent = 'Live availability'; };
  es.onerror = () => { live.classList.remove('on'); $('#liveText').textContent = 'Reconnecting…'; };
  es.addEventListener('availability', () => { clearTimeout(refetch); refetch = setTimeout(() => load({ quiet: true }), 150); });
  es.addEventListener('booking', (e) => {
    const b = JSON.parse(e.data);
    if (state.booking && b.id === state.booking.id && b.status !== state.booking.status) showResult(b);
  });
  es.addEventListener('activity', (e) => {
    const a = JSON.parse(e.data);
    if (!state.booking || state.booking.status !== 'confirmed') toast(a.text);
  });
}

// Fallback poll for the current booking in case the stream drops mid-payment.
setInterval(async () => {
  if (!state.booking || state.booking.status !== 'pending') return;
  const r = await fetch('/api/bookings/' + state.booking.id);
  if (r.ok) { const b = await r.json(); if (b.status !== 'pending') showResult(b); }
}, 6000);

// ---------- Boot ----------
(async function init() {
  state.config = await (await fetch('/api/config')).json();
  connect();
  await load();
  const ref = new URLSearchParams(location.search).get('booking');
  if (ref) {
    const r = await fetch('/api/bookings/' + encodeURIComponent(ref));
    if (r.ok) showResult(await r.json());
  }
})();
