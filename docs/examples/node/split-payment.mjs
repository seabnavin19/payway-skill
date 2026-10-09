// Split payment (PayWay Split & Payout on an Ecommerce Checkout purchase) with Express.
// POST /checkout                -> signed Purchase form fields with a payout split computed on the server
// POST /payway/callback         -> PayWay's return_url callback; confirms with Check transaction, once per order
// POST /sellers/:id/whitelist   -> adds a seller's stored payout account to the PayWay whitelist (staff only)
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
// return_params comes back in the callback as the string we sent, e.g. '{"order_id":"2001"}'.
const orderIdFrom = rp => { try { return String(JSON.parse(rp).order_id) } catch { return undefined } }

// Replace with your database. Payout accounts and prices live on the server, never in the browser.
// 'platform' is your own ABA account: it receives your fee so the payouts add up to the full amount.
const sellers = new Map([
  ['s1', { id: 's1', account: '000133879', whitelisted: false }],
  ['s2', { id: 's2', account: '000133880', whitelisted: false }],
  ['platform', { id: 'platform', account: '000133881', whitelisted: false }],
])
const orders = new Map([['2001', { id: '2001', currency: 'USD',
  lines: [{ sellerId: 's1', price: 2.5, qty: 2 }, { sellerId: 's2', price: 1, qty: 1 }] }]])
const FEE_PERCENT = 10 // your commission on each line

// Work in minor units (cents; riel for KHR) so the shares add up exactly.
const unit = c => (c === 'KHR' ? 1 : 100)
const fmt = (minor, c) => (c === 'KHR' ? String(minor) : (minor / 100).toFixed(2)) // KHR: no decimals
const lineMinor = (l, c) => Math.round(l.price * unit(c)) * l.qty
export const orderAmount = o => fmt(o.lines.reduce((sum, l) => sum + lineMinor(l, o.currency), 0), o.currency)

// Amount and split come only from the server-side order and seller records.
export function splitOrder(order) {
  const shares = new Map() // account -> minor units; one entry per account (code 39: duplicated account)
  const add = (seller, minor) => {
    if (!seller?.whitelisted) throw new Error(`payout account for ${seller?.id ?? 'unknown seller'} is not whitelisted`)
    shares.set(seller.account, (shares.get(seller.account) ?? 0) + minor)
  }
  let total = 0
  for (const l of order.lines) {
    const line = lineMinor(l, order.currency)
    total += line
    add(sellers.get(l.sellerId), Math.floor((line * (100 - FEE_PERCENT)) / 100))
  }
  const fee = total - [...shares.values()].reduce((a, b) => a + b, 0)
  if (fee > 0) add(sellers.get('platform'), fee)
  if (shares.size > 10) throw new Error('PayWay allows at most 10 payouts per request') // code 25
  return {
    amount: fmt(total, order.currency), // equals orderAmount(order); payouts add up to it exactly
    payout: [...shares].map(([acc, minor]) => ({ acc, amt: Number(fmt(minor, order.currency)) })),
  }
}

// Hash field order from the Purchase API page; fields you don't send hash as ''.
const HASH_FIELDS = ['req_time', 'merchant_id', 'tran_id', 'amount', 'items', 'shipping', 'firstname', 'lastname',
  'email', 'phone', 'type', 'payment_option', 'return_url', 'cancel_url', 'continue_success_url',
  'return_deeplink', 'currency', 'custom_fields', 'return_params', 'payout', 'lifetime',
  'additional_params', 'google_pay_token', 'skip_success_page']

export function purchaseFields(order) {
  const { amount, payout } = splitOrder(order)
  const f = {
    req_time: reqTime(),
    merchant_id: MERCHANT_ID,
    tran_id: order.id, // max 20 chars, unique per attempt
    amount,
    currency: order.currency,
    return_url: b64(`${PUBLIC_URL}/payway/callback`),
    return_params: JSON.stringify({ order_id: order.id }), // echoed in the callback
    payout: b64(JSON.stringify(payout)), // Base64 JSON, e.g. [{"acc":"000133879","amt":4.5}]
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

export async function addBeneficiary(payee) {
  const requestTime = reqTime()
  const merchantAuth = encryptMerchantAuth({ mc_id: MERCHANT_ID, payee })
  return post('/api/merchant-portal/merchant-access/whitelist-account/add-whitelist-payout', {
    request_time: requestTime,
    merchant_id: MERCHANT_ID,
    merchant_auth: merchantAuth,
    hash: paywayHash([requestTime, merchantAuth], API_KEY), // request_time, merchant_auth
  })
}

export async function checkTransaction(tranId) {
  const b = { req_time: reqTime(), merchant_id: MERCHANT_ID, tran_id: tranId }
  b.hash = paywayHash([b.req_time, b.merchant_id, b.tran_id], API_KEY)
  return post('/api/payment-gateway/v1/payments/check-transaction-2', b)
}

const app = express()
app.use(express.json())

app.post('/checkout', (req, res) => {
  const order = orders.get(String(req.body.orderId)) // only the order ID comes from the browser
  if (!order) return res.status(404).json({ error: 'order not found' })
  if (order.paid) return res.status(409).json({ error: 'order already paid' })
  let fields
  try {
    fields = purchaseFields(order)
  } catch (e) {
    return res.status(409).json({ error: e.message }) // e.g. a seller not whitelisted yet
  }
  res.json({ action: `${BASE_URL}/api/payment-gateway/v1/payments/purchase`, fields })
})

app.post('/payway/callback', async (req, res) => {
  // Don't trust the callback body: find the order from the return_params we sent, then confirm with
  // Check transaction for our own tran_id and the server-side amount. PayWay splits the money itself.
  const order = orders.get(orderIdFrom(req.body.return_params))
  if (!order) return res.sendStatus(404)
  if (order.paid || order.checking) return res.sendStatus(200) // already confirmed or being confirmed
  order.checking = true // reserve before awaiting PayWay
  try {
    const d = (await checkTransaction(order.id)).data ?? {}
    if (d.payment_status === 'APPROVED' && Number(d.original_amount) === Number(orderAmount(order))) order.paid = true
  } finally {
    order.checking = false
  }
  console.log('order', order.id, order.paid ? 'PAID' : 'not paid')
  res.sendStatus(200)
})

// TODO: protect this route with your staff authentication. Only the seller ID comes from the request;
// the account is your stored record for that seller.
app.post('/sellers/:id/whitelist', async (req, res) => {
  const seller = sellers.get(req.params.id)
  if (!seller) return res.status(404).json({ error: 'seller not found' })
  if (seller.whitelisted) return res.json({ whitelisted: true })
  const r = await addBeneficiary(seller.account)
  // The portal lists no success code for this API; accept only an Active (status 1) beneficiary.
  if (r.data?.status === 1) seller.whitelisted = true
  res.status(seller.whitelisted ? 200 : 502).json({ whitelisted: seller.whitelisted, status: r.status })
})

app.listen(process.env.PORT ?? 3000)
