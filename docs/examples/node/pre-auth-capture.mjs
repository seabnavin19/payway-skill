// Pre-auth & capture (PayWay Pre-auth) with Express.
// POST /bookings/:id/hold    -> signed Purchase form fields with type=pre-auth (hold the deposit)
// POST /payway/callback      -> PayWay's return_url callback; confirms the hold with Check transaction
// POST /bookings/:id/capture -> completes the pre-auth for the final bill (staff only)
// POST /bookings/:id/cancel  -> cancels the pre-auth, releasing the hold (staff only)
// Env: PAYWAY_MERCHANT_ID, PAYWAY_API_KEY, PAYWAY_RSA_PUBLIC_KEY (PEM from ABA Bank),
//      PAYWAY_BASE_URL (default sandbox), PUBLIC_URL
import { constants, publicEncrypt } from 'node:crypto'
import express from 'express'
import { paywayHash } from './payway-hash.mjs'

for (const k of ['PAYWAY_MERCHANT_ID', 'PAYWAY_API_KEY', 'PAYWAY_RSA_PUBLIC_KEY']) {
  if (!process.env[k]) throw new Error(`${k} is not set`)
}
const BASE_URL = process.env.PAYWAY_BASE_URL ?? 'https://checkout-sandbox.payway.com.kh'
const MERCHANT_ID = process.env.PAYWAY_MERCHANT_ID
const API_KEY = process.env.PAYWAY_API_KEY
const RSA_PUBLIC_KEY = process.env.PAYWAY_RSA_PUBLIC_KEY
const PUBLIC_URL = process.env.PUBLIC_URL ?? 'https://your-shop.example'

const reqTime = () => new Date().toISOString().replace(/\D/g, '').slice(0, 14) // UTC YYYYMMDDHHmmss
const b64 = s => Buffer.from(s, 'utf8').toString('base64')
// return_params comes back in the callback as the string we sent, e.g. '{"booking_id":"7001"}'.
const bookingIdFrom = rp => { try { return String(JSON.parse(rp).booking_id) } catch { return undefined } }

// Replace with your database. Amounts live on the server, never in the browser.
// deposit = amount to hold; lines = final bill, filled in when the service ends.
const bookings = new Map([['7001', { id: '7001', currency: 'USD', deposit: 100, lines: [{ price: 80, qty: 1 }] }]])

const money = (n, currency) => currency === 'KHR' ? Math.round(n).toString() : n.toFixed(2) // KHR: no decimals
export const holdAmount = b => money(b.deposit, b.currency)
export const finalAmount = b => money(b.lines.reduce((sum, l) => sum + l.price * l.qty, 0), b.currency)

// Hash field order from the Purchase API page; fields you don't send hash as ''.
const HASH_FIELDS = ['req_time', 'merchant_id', 'tran_id', 'amount', 'items', 'shipping', 'firstname', 'lastname',
  'email', 'phone', 'type', 'payment_option', 'return_url', 'cancel_url', 'continue_success_url',
  'return_deeplink', 'currency', 'custom_fields', 'return_params', 'payout', 'lifetime',
  'additional_params', 'google_pay_token', 'skip_success_page']

export function holdFields(booking) {
  const f = {
    req_time: reqTime(),
    merchant_id: MERCHANT_ID,
    tran_id: booking.id, // max 20 chars; this tran_id is what we complete or cancel later
    amount: holdAmount(booking),
    type: 'pre-auth',
    currency: booking.currency,
    return_url: b64(`${PUBLIC_URL}/payway/callback`),
    return_params: JSON.stringify({ booking_id: booking.id }), // echoed in the callback
  }
  f.hash = paywayHash(HASH_FIELDS.map(k => f[k]), API_KEY)
  return f
}

// merchant_auth: JSON encrypted with the RSA public key in 117-byte chunks, then Base64
// (port of the portal's PHP sample; PKCS#1 v1.5 = PHP openssl_public_encrypt default).
export function encryptMerchantAuth(obj) {
  const src = Buffer.from(JSON.stringify(obj), 'utf8')
  const parts = []
  for (let i = 0; i < src.length; i += 117) {
    parts.push(publicEncrypt({ key: RSA_PUBLIC_KEY, padding: constants.RSA_PKCS1_PADDING }, src.subarray(i, i + 117)))
  }
  return Buffer.concat(parts).toString('base64')
}

async function post(path, body) {
  const res = await fetch(`${BASE_URL}${path}`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
  })
  return res.json()
}

export async function completePreAuth(booking, amount) {
  const requestTime = reqTime()
  const merchantAuth = encryptMerchantAuth({ mc_id: MERCHANT_ID, tran_id: booking.id, complete_amount: Number(amount) })
  return post('/api/merchant-portal/merchant-access/online-transaction/pre-auth-completion', {
    request_time: requestTime,
    merchant_id: MERCHANT_ID,
    merchant_auth: merchantAuth,
    hash: paywayHash([merchantAuth, requestTime, MERCHANT_ID], API_KEY), // Complete: auth, time, id
  })
}

export async function cancelPreAuth(booking) {
  const requestTime = reqTime()
  const merchantAuth = encryptMerchantAuth({ mc_id: MERCHANT_ID, tran_id: booking.id })
  return post('/api/merchant-portal/merchant-access/online-transaction/pre-auth-cancellation', {
    request_time: requestTime,
    merchant_id: MERCHANT_ID,
    merchant_auth: merchantAuth,
    hash: paywayHash([MERCHANT_ID, merchantAuth, requestTime], API_KEY), // Cancel: id, auth, time
  })
}

export async function checkTransaction(tranId) {
  const b = { req_time: reqTime(), merchant_id: MERCHANT_ID, tran_id: tranId }
  b.hash = paywayHash([b.req_time, b.merchant_id, b.tran_id], API_KEY)
  return post('/api/payment-gateway/v1/payments/check-transaction-2', b)
}

// Complete and cancel are one-shot and mutually exclusive: the booking leaves HELD before we await
// PayWay, so only one of them can be sent; it returns to HELD only if PayWay did not confirm.
async function settle(booking, call, doneStatus) {
  if (booking.state !== 'HELD') return { error: `booking is ${booking.state ?? 'not held'}` }
  booking.state = 'SETTLING'
  let r = {}
  try {
    r = await call()
  } finally {
    booking.state = r.status?.code === '00' && r.transaction_status === doneStatus ? doneStatus : 'HELD'
  }
  return r
}

const app = express()
app.use(express.json())

app.post('/bookings/:id/hold', (req, res) => {
  const booking = bookings.get(req.params.id)
  if (!booking) return res.status(404).json({ error: 'booking not found' })
  res.json({ action: `${BASE_URL}/api/payment-gateway/v1/payments/purchase`, fields: holdFields(booking) })
})

app.post('/payway/callback', async (req, res) => {
  // Don't trust the callback body: find the booking from the return_params we sent, then confirm the
  // hold with Check transaction for our own tran_id and the server-side hold amount.
  const booking = bookings.get(bookingIdFrom(req.body.return_params))
  if (!booking) return res.sendStatus(404)
  if (booking.state || booking.checking) return res.sendStatus(200) // already confirmed or being confirmed
  booking.checking = true // reserve before awaiting PayWay
  try {
    const d = (await checkTransaction(booking.id)).data ?? {}
    if (d.payment_status === 'PRE-AUTH' && Number(d.original_amount) === Number(holdAmount(booking))) booking.state = 'HELD'
  } finally {
    booking.checking = false
  }
  console.log('booking', booking.id, booking.state ?? 'not held')
  res.sendStatus(200)
})

// TODO: protect the two routes below with your staff authentication.
app.post('/bookings/:id/capture', async (req, res) => {
  const booking = bookings.get(req.params.id)
  if (!booking) return res.status(404).json({ error: 'booking not found' })
  const amount = finalAmount(booking) // from the server-side bill, never from the request
  // Cards may complete up to +10% over the hold; this example stays within the held amount.
  if (Number(amount) > Number(holdAmount(booking))) return res.status(400).json({ error: 'final amount exceeds hold' })
  const r = await settle(booking, () => completePreAuth(booking, amount), 'COMPLETED')
  if (r.error) return res.status(409).json(r)
  res.status(booking.state === 'COMPLETED' ? 200 : 502).json({ state: booking.state, status: r.status })
})

app.post('/bookings/:id/cancel', async (req, res) => {
  const booking = bookings.get(req.params.id)
  if (!booking) return res.status(404).json({ error: 'booking not found' })
  const r = await settle(booking, () => cancelPreAuth(booking), 'CANCELLED')
  if (r.error) return res.status(409).json(r)
  res.status(booking.state === 'CANCELLED' ? 200 : 502).json({ state: booking.state, status: r.status })
})

app.listen(process.env.PORT ?? 3000)
