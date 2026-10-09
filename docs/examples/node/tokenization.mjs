// Tokenization (PayWay Credentials on File, unscheduled payments) with Express.
// POST /customers/:id/link-account -> starts ABA account linking, returns qr_string / deeplink
// POST /customers/:id/link-card    -> signed Link Card form fields for the browser to post to PayWay
// POST /payway/token-callback      -> token callback; re-fetches the token with Get token details
// POST /orders/:id/pay             -> one-click payment with the saved token (CITU_FLEX)
// POST /payway/payment-callback    -> payment callback; confirms with Check transaction
// Env: PAYWAY_MERCHANT_ID, PAYWAY_API_KEY, PAYWAY_BASE_URL (default sandbox), PUBLIC_URL
import { randomBytes } from 'node:crypto'
import express from 'express'
import { paywayHash } from './payway-hash.mjs'

for (const k of ['PAYWAY_MERCHANT_ID', 'PAYWAY_API_KEY']) if (!process.env[k]) throw new Error(`${k} is not set`)
const BASE_URL = process.env.PAYWAY_BASE_URL ?? 'https://checkout-sandbox.payway.com.kh'
const MERCHANT_ID = process.env.PAYWAY_MERCHANT_ID
const API_KEY = process.env.PAYWAY_API_KEY
const PUBLIC_URL = process.env.PUBLIC_URL ?? 'https://your-shop.example'

const reqTime = () => new Date().toISOString().replace(/\D/g, '').slice(0, 14) // UTC YYYYMMDDHHmmss
const b64 = s => Buffer.from(s, 'utf8').toString('base64')
const newRequestId = () => randomBytes(10).toString('hex') // 20 letters/digits (request_id: 5-24)

// Replace with your database. In a real app the customer comes from your login session,
// and each order must belong to that customer. One saved method per customer, for brevity.
const customers = new Map([['c1', { id: 'c1', ctid: 'cust7f3a9e21', currency: 'USD' }]])
const orders = new Map([['5001', { id: '5001', customerId: 'c1', currency: 'USD', lines: [{ price: 3, qty: 1 }] }]])
const linkRequests = new Map() // our request_id -> customer id, stored before PayWay is called

// Amount is computed from the server-side order, never from client input.
export function orderAmount(order) {
  const total = order.lines.reduce((sum, l) => sum + l.price * l.qty, 0)
  return order.currency === 'KHR' ? Math.round(total).toString() : total.toFixed(2) // KHR: no decimals
}

async function post(path, body) {
  const res = await fetch(`${BASE_URL}${path}`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
  })
  return res.json()
}

function linkFields(customer) {
  const f = {
    request_id: newRequestId(),
    request_time: reqTime(),
    merchant_id: MERCHANT_ID,
    ctid: customer.ctid,
    token_flag: 'CITI_FLEX', // customer-initiated only; use CITO_FLEX to charge without the customer present
    currency: customer.currency,
    callback_url: b64(`${PUBLIC_URL}/payway/token-callback`),
  }
  linkRequests.set(f.request_id, customer.id)
  return f
}

export async function linkAccount(customer) {
  const b = linkFields(customer)
  b.hash = paywayHash([b.merchant_id, b.request_time, b.ctid, b.return_deeplink, b.callback_url, b.request_id,
    b.token_flag, b.currency], API_KEY)
  return post('/api/payment-credential/v3/aof/link-account', b)
}

export function linkCardFields(customer) {
  const f = linkFields(customer)
  // frequency and amount are in the portal's hash sample but are not Link Card fields: hashed as ''.
  f.hash = paywayHash([f.merchant_id, f.request_time, f.ctid, f.callback_url, f.request_id, f.token_flag,
    '', '', f.currency, f.continue_success_url], API_KEY)
  return f
}

export async function getTokenDetails(requestId) {
  const b = { request_time: reqTime(), request_id: requestId, merchant_id: MERCHANT_ID }
  b.hash = paywayHash([b.merchant_id, b.request_time, b.request_id], API_KEY)
  return post('/api/payment-credential/v3/token-management/get-token-details', b)
}

// Hash field order from the Payment API page; fields you don't send hash as ''.
const PAYMENT_HASH_FIELDS = ['request_time', 'merchant_id', 'tran_id', 'amount', 'currency', 'items', 'ctid', 'pwt',
  'first_name', 'last_name', 'email', 'phone', 'purchase_type', 'callback_url', 'custom_fields', 'return_params',
  'payout', 'token_flag', 'shipping_fee']

export async function payWithToken(order, customer) {
  const b = {
    request_time: reqTime(),
    merchant_id: MERCHANT_ID,
    tran_id: order.id, // max 20 chars, unique per payment
    ctid: customer.ctid,
    pwt: customer.pwt,
    amount: Number(orderAmount(order)), // JSON number; hashed as the same text JSON sends (e.g. "4.5")
    currency: order.currency,
    token_flag: 'CITU_FLEX',
    callback_url: b64(`${PUBLIC_URL}/payway/payment-callback`),
  }
  b.hash = paywayHash(PAYMENT_HASH_FIELDS.map(k => b[k]), API_KEY)
  return post('/api/payment-gateway/v3/purchase/payment-credential', b)
}

export async function checkTransaction(tranId) {
  const b = { req_time: reqTime(), merchant_id: MERCHANT_ID, tran_id: tranId }
  b.hash = paywayHash([b.req_time, b.merchant_id, b.tran_id], API_KEY)
  return post('/api/payment-gateway/v1/payments/check-transaction-2', b)
}

// Confirms one order with PayWay using our own tran_id (= order.id) and server-side amount.
// The order is reserved before awaiting, so concurrent callbacks cannot both mark it.
export async function confirmOrder(order) {
  if (order.paid || order.checking) return order.paid
  order.checking = true
  try {
    const d = (await checkTransaction(order.id)).data ?? {}
    order.paid = d.payment_status === 'APPROVED' && Number(d.original_amount) === Number(orderAmount(order))
  } finally {
    order.checking = false
  }
  return order.paid
}

const app = express()
app.use(express.json())

app.post('/customers/:id/link-account', async (req, res) => {
  const customer = customers.get(req.params.id)
  if (!customer) return res.status(404).json({ error: 'customer not found' })
  const r = await linkAccount(customer)
  if (r.status?.code !== '00') return res.status(502).json({ error: r.status?.message })
  res.json(r.data) // qr_string (web: render as QR) and deeplink (mobile), valid 10 minutes
})

app.post('/customers/:id/link-card', (req, res) => {
  const customer = customers.get(req.params.id)
  if (!customer) return res.status(404).json({ error: 'customer not found' })
  res.json({ action: `${BASE_URL}/api/payment-credential/v3/cof/link-card`, fields: linkCardFields(customer) })
})

app.post('/payway/token-callback', async (req, res) => {
  // The token callback is not signed. Use only its request_id, and only if we issued it;
  // the token itself comes from Get token details, never from the callback body.
  const requestId = String(req.body.request_id)
  const customer = customers.get(linkRequests.get(requestId))
  if (!customer) return res.sendStatus(404)
  const d = (await getTokenDetails(requestId)).data ?? {}
  if (d.ctid !== customer.ctid) return res.sendStatus(409)
  customer.pwt = d.status === 1 ? d.pwt : undefined // 0 removed, 2 frozen: don't charge
  res.sendStatus(200)
})

app.post('/orders/:id/pay', async (req, res) => {
  const order = orders.get(req.params.id)
  const customer = customers.get(order?.customerId)
  if (!order || !customer?.pwt) return res.status(404).json({ error: 'order or saved method not found' })
  if (order.paid || order.submitted) return res.status(409).json({ error: 'already submitted' })
  order.submitted = true // one Payment request per order: reserved before awaiting PayWay
  const r = await payWithToken(order, customer)
  if (r.status?.code !== '00') {
    order.submitted = false
    return res.status(502).json({ error: r.status?.message })
  }
  res.json({ accepted: true }) // the result comes from the callback + Check transaction
})

app.post('/payway/payment-callback', async (req, res) => {
  // Unsigned body: tran_id is only a lookup key (it is our order id); the result comes from
  // Check transaction for that order, compared with the server-side amount.
  const order = orders.get(String(req.body.tran_id))
  if (!order?.submitted) return res.sendStatus(404)
  const paid = await confirmOrder(order)
  // TODO: mark the order paid in your database when `paid` is true (make this idempotent).
  console.log('order', order.id, paid ? 'PAID' : 'not paid')
  res.sendStatus(200)
})

app.listen(process.env.PORT ?? 3000)
