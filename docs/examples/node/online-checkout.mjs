// Online checkout (PayWay Ecommerce Checkout) with Express.
// POST /checkout          -> signed Purchase form fields for the browser to post to PayWay
// POST /payway/callback   -> PayWay's return_url callback; confirms with Check transaction
// Env: PAYWAY_MERCHANT_ID, PAYWAY_API_KEY, PAYWAY_BASE_URL (default sandbox), PUBLIC_URL
import express from 'express'
import { paywayHash } from './payway-hash.mjs'

const BASE_URL = process.env.PAYWAY_BASE_URL ?? 'https://checkout-sandbox.payway.com.kh'
const MERCHANT_ID = process.env.PAYWAY_MERCHANT_ID
const API_KEY = process.env.PAYWAY_API_KEY
const PUBLIC_URL = process.env.PUBLIC_URL ?? 'https://your-shop.example'

const reqTime = () => new Date().toISOString().replace(/\D/g, '').slice(0, 14) // UTC YYYYMMDDHHmmss
const b64 = s => Buffer.from(s, 'utf8').toString('base64')
// return_params comes back in the callback as the string we sent, e.g. '{"order_id":"1001"}'.
const orderIdFrom = rp => { try { return String(JSON.parse(rp).order_id) } catch { return undefined } }

// Replace with your database. Prices live on the server, never in the browser.
const orders = new Map([['1001', { id: '1001', currency: 'USD', lines: [{ price: 2.5, qty: 2 }, { price: 1, qty: 1 }] }]])

// Amount is computed from the server-side order, never from client input.
export function orderAmount(order) {
  const total = order.lines.reduce((sum, l) => sum + l.price * l.qty, 0)
  return order.currency === 'KHR' ? Math.round(total).toString() : total.toFixed(2) // KHR: no decimals
}

// Hash field order from the Purchase API page; fields you don't send hash as ''.
const HASH_FIELDS = ['req_time', 'merchant_id', 'tran_id', 'amount', 'items', 'shipping', 'firstname', 'lastname',
  'email', 'phone', 'type', 'payment_option', 'return_url', 'cancel_url', 'continue_success_url',
  'return_deeplink', 'currency', 'custom_fields', 'return_params', 'payout', 'lifetime',
  'additional_params', 'google_pay_token', 'skip_success_page']

export function purchaseFields(order) {
  const f = {
    req_time: reqTime(),
    merchant_id: MERCHANT_ID,
    tran_id: order.id, // max 20 chars, unique per attempt
    amount: orderAmount(order),
    currency: order.currency,
    return_url: b64(`${PUBLIC_URL}/payway/callback`),
    return_params: JSON.stringify({ order_id: order.id }), // echoed in the callback
  }
  f.hash = paywayHash(HASH_FIELDS.map(k => f[k]), API_KEY)
  return f
}

export async function checkTransaction(tranId) {
  const body = { req_time: reqTime(), merchant_id: MERCHANT_ID, tran_id: tranId }
  body.hash = paywayHash([body.req_time, body.merchant_id, body.tran_id], API_KEY)
  const res = await fetch(`${BASE_URL}/api/payment-gateway/v1/payments/check-transaction-2`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
  })
  return res.json()
}

const app = express()
app.use(express.json())

app.post('/checkout', (req, res) => {
  const order = orders.get(String(req.body.orderId)) // only the order ID comes from the browser
  if (!order) return res.status(404).json({ error: 'order not found' })
  res.json({ action: `${BASE_URL}/api/payment-gateway/v1/payments/purchase`, fields: purchaseFields(order) })
})

app.post('/payway/callback', async (req, res) => {
  // Don't trust the callback body: re-check the status with PayWay and compare the amount.
  // The portal describes the callback tran_id as gateway-generated, so find the order from the
  // return_params we sent (documented as included in the callback), then check our own tran_id.
  const order = orders.get(orderIdFrom(req.body.return_params))
  if (!order) return res.sendStatus(404)
  const d = (await checkTransaction(order.id)).data ?? {}
  const paid = d.payment_status === 'APPROVED' && Number(d.original_amount) === Number(orderAmount(order))
  // TODO: mark the order paid in your database when `paid` is true (make this idempotent).
  console.log('order', order.id, paid ? 'PAID' : `not paid: ${d.payment_status}`)
  res.sendStatus(200)
})

app.listen(process.env.PORT ?? 3000)
