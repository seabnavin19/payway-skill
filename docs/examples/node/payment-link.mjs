// Payment link (PayWay Payment Link API) with Express.
// POST /orders/:id/payment-link -> creates a payment link for a server-side order, returns the URL to send
// POST /payway/callback         -> PayWay's return_url callback; confirms with Check transaction
// Env: PAYWAY_MERCHANT_ID, PAYWAY_API_KEY, PAYWAY_RSA_PUBLIC_KEY (PEM from PayWay),
//      PAYWAY_BASE_URL (default sandbox), PUBLIC_URL
import { constants, publicEncrypt } from 'node:crypto'
import express from 'express'
import { paywayHash } from './payway-hash.mjs'

const BASE_URL = process.env.PAYWAY_BASE_URL ?? 'https://checkout-sandbox.payway.com.kh'
const MERCHANT_ID = process.env.PAYWAY_MERCHANT_ID
const API_KEY = process.env.PAYWAY_API_KEY
const RSA_PUBLIC_KEY = process.env.PAYWAY_RSA_PUBLIC_KEY
const PUBLIC_URL = process.env.PUBLIC_URL ?? 'https://your-shop.example'

const reqTime = () => new Date().toISOString().replace(/\D/g, '').slice(0, 14) // UTC YYYYMMDDHHmmss
const b64 = s => Buffer.from(s, 'utf8').toString('base64')

// Replace with your database. Prices live on the server, never in the browser.
const orders = new Map([['3001', { id: '3001', currency: 'USD', title: 'Order 3001', lines: [{ price: 4, qty: 1 }] }]])

// Amount is computed from the server-side order, never from client input.
export function orderAmount(order) {
  const total = order.lines.reduce((sum, l) => sum + l.price * l.qty, 0)
  return order.currency === 'KHR' ? Math.round(total).toString() : total.toFixed(2) // KHR: no decimals
}

// merchant_auth: JSON encrypted with PayWay's RSA public key in 117-byte chunks, then Base64
// (port of the portal's PHP opensslEncryption; PKCS#1 v1.5 = PHP openssl_public_encrypt default).
export function encryptMerchantAuth(obj) {
  const src = Buffer.from(JSON.stringify(obj), 'utf8')
  const parts = []
  for (let i = 0; i < src.length; i += 117) {
    parts.push(publicEncrypt({ key: RSA_PUBLIC_KEY, padding: constants.RSA_PKCS1_PADDING }, src.subarray(i, i + 117)))
  }
  return Buffer.concat(parts).toString('base64')
}

export async function createPaymentLink(order) {
  const requestTime = reqTime()
  const merchantAuth = encryptMerchantAuth({
    mc_id: MERCHANT_ID,
    title: order.title,
    amount: orderAmount(order),
    currency: order.currency,
    payment_limit: '1',
    expired_date: String(Math.floor(Date.now() / 1000) + 7 * 24 * 3600), // Unix time, 7 days
    return_url: b64(`${PUBLIC_URL}/payway/callback`),
    merchant_ref_no: order.id,
  })
  const form = new FormData() // multipart/form-data
  form.append('request_time', requestTime)
  form.append('merchant_id', MERCHANT_ID)
  form.append('merchant_auth', merchantAuth)
  form.append('hash', paywayHash([requestTime, MERCHANT_ID, merchantAuth], API_KEY))
  const res = await fetch(`${BASE_URL}/api/merchant-portal/merchant-access/payment-link/create`, { method: 'POST', body: form })
  return res.json()
}

export async function getPaymentLinkDetails(linkId) {
  const body = { request_time: reqTime(), merchant_id: MERCHANT_ID, merchant_auth: encryptMerchantAuth({ mc_id: MERCHANT_ID, id: linkId }) }
  body.hash = paywayHash([body.request_time, body.merchant_id, body.merchant_auth], API_KEY)
  const res = await fetch(`${BASE_URL}/api/merchant-portal/merchant-access/payment-link/detail`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
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

// ponytail: in-memory, single process. With a DB: insert tran_id into a unique column first
// (that insert is the reservation), delete it if PayWay does not confirm.
const usedTranIds = new Set()

const app = express()
app.use(express.json())

app.post('/orders/:id/payment-link', async (req, res) => {
  const order = orders.get(req.params.id)
  if (!order) return res.status(404).json({ error: 'order not found' })
  const result = await createPaymentLink(order)
  if (result.status?.code !== '00') return res.status(502).json({ error: result.status?.message })
  order.linkId = result.data.id // store with the order: used to bind the callback to this order's link
  res.json({ paymentLink: result.data.payment_link }) // send this to the customer
})

app.post('/payway/callback', async (req, res) => {
  // Callback has tran_id (PayWay's), status and merchant_ref_no (our order ID) - all unauthenticated.
  // Check transaction does not return the link id or merchant_ref_no, so bind the payment to THIS
  // order by asking PayWay about the order's own link (payment_limit 1 => PAID after one payment),
  // Each tran_id marks at most one order paid, and each order accepts at most one tran_id.
  const order = orders.get(String(req.body.merchant_ref_no))
  const tranId = String(req.body.tran_id)
  if (!order?.linkId || order.paidTranId || order.checking || usedTranIds.has(tranId)) return res.sendStatus(409)
  order.checking = true // reserve order and tran_id before awaiting PayWay, so concurrent callbacks can't both pass
  usedTranIds.add(tranId)
  let paid = false
  let d = {}
  try {
    const link = (await getPaymentLinkDetails(order.linkId)).data ?? {}
    d = (await checkTransaction(tranId)).data ?? {}
    paid = link.status === 'PAID' && Number(link.amount) === Number(orderAmount(order)) &&
      d.payment_status === 'APPROVED' && Number(d.original_amount) === Number(orderAmount(order))
  } finally {
    if (paid) order.paidTranId = tranId // paid flag and tran_id set together
    else usedTranIds.delete(tranId) // release on non-confirmation
    order.checking = false
  }
  // TODO: mark the order paid in your database when `paid` is true (make this idempotent).
  console.log('order', order.id, paid ? 'PAID' : `not paid: ${d.payment_status}`)
  res.sendStatus(200)
})

app.listen(process.env.PORT ?? 3000)
