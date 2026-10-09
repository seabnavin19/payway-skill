// Dynamic QR (PayWay ABA QR API) with Express.
// POST /qr                -> calls QR API, returns the QR for the screen to display
// POST /payway/callback   -> PayWay's callback_url notification; confirms with Check transaction
// Env: PAYWAY_MERCHANT_ID, PAYWAY_API_KEY, PAYWAY_BASE_URL (default sandbox), PUBLIC_URL
import express from 'express'
import { paywayHash } from './payway-hash.mjs'

const BASE_URL = process.env.PAYWAY_BASE_URL ?? 'https://checkout-sandbox.payway.com.kh'
const MERCHANT_ID = process.env.PAYWAY_MERCHANT_ID
const API_KEY = process.env.PAYWAY_API_KEY
const PUBLIC_URL = process.env.PUBLIC_URL ?? 'https://your-shop.example'

const reqTime = () => new Date().toISOString().replace(/\D/g, '').slice(0, 14) // UTC YYYYMMDDHHmmss
const b64 = s => Buffer.from(s, 'utf8').toString('base64')

// Replace with your database. Prices live on the server, never in the browser.
const orders = new Map([['2001', { id: '2001', currency: 'USD', lines: [{ price: 1.25, qty: 2 }] }]])

// Amount is computed from the server-side order, never from client input.
export function orderAmount(order) {
  const total = order.lines.reduce((sum, l) => sum + l.price * l.qty, 0)
  return order.currency === 'KHR' ? Math.round(total).toString() : total.toFixed(2) // KHR: no decimals
}

// Hash field order from the QR API page; fields you don't send hash as ''.
const HASH_FIELDS = ['req_time', 'merchant_id', 'tran_id', 'amount', 'items', 'first_name', 'last_name', 'email',
  'phone', 'purchase_type', 'payment_option', 'callback_url', 'return_deeplink', 'currency', 'custom_fields',
  'return_params', 'payout', 'lifetime', 'qr_image_template']

export async function generateQr(order) {
  const f = {
    req_time: reqTime(),
    merchant_id: MERCHANT_ID,
    tran_id: order.id, // max 20 chars, unique per attempt
    amount: Number(orderAmount(order)), // JSON number; String(n) === JSON text, so hash and body match
    currency: order.currency,
    payment_option: 'abapay_khqr',
    callback_url: b64(`${PUBLIC_URL}/payway/callback`),
    lifetime: 10, // minutes, min 3
    qr_image_template: 'template3_color',
  }
  f.hash = paywayHash(HASH_FIELDS.map(k => f[k]), API_KEY)
  const res = await fetch(`${BASE_URL}/api/payment-gateway/v1/payments/generate-qr`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(f),
  })
  return res.json()
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

app.post('/qr', async (req, res) => {
  const order = orders.get(String(req.body.orderId)) // only the order ID comes from the screen
  if (!order) return res.status(404).json({ error: 'order not found' })
  const qr = await generateQr(order)
  if (String(qr.status?.code) !== '0') return res.status(502).json({ error: qr.status?.message })
  res.json({ qrImage: qr.qrImage, qrString: qr.qrString, amount: qr.amount, currency: qr.currency })
})

app.post('/payway/callback', async (req, res) => {
  // Don't trust the callback body: re-check the status with PayWay and compare the amount.
  const order = orders.get(String(req.body.tran_id))
  if (!order) return res.sendStatus(404)
  const d = (await checkTransaction(order.id)).data ?? {}
  const paid = d.payment_status === 'APPROVED' && Number(d.original_amount) === Number(orderAmount(order))
  // TODO: mark the order paid in your database when `paid` is true (make this idempotent).
  console.log('order', order.id, paid ? 'PAID' : `not paid: ${d.payment_status}`)
  res.sendStatus(200)
})

app.listen(process.env.PORT ?? 3000)
