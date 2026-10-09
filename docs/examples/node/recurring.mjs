// Recurring (PayWay Credentials on File, scheduled payments) with Express.
// POST /subscriptions/:id/subscribe -> signed Subscription form fields (first payment + CITR_FIX consent)
// POST /payway/callback             -> payment callback for any charge; confirms with Check transaction
// POST /payway/token-callback       -> token callback; takes the token from Get token details
// chargeDue(subscription, cycle)    -> call from your daily job for each due cycle (MITR_FIX)
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
// return_params comes back in the callback as the string we sent, e.g. '{"tran_id":"s1c1"}'.
const tranIdFrom = rp => { try { return String(JSON.parse(rp).tran_id) } catch { return undefined } }

// Replace with your database. Plan prices live on the server, never in the browser.
const PLANS = { gym: { amount: '20.00', currency: 'USD', frequency: '1M' } } // 1W, 1M or 2M
const subscriptions = new Map([['s1', { id: 's1', plan: 'gym', ctid: 'cust7f3a9e21' }]])
const charges = new Map() // our tran_id -> { tranId, subscriptionId, amount, paid }

async function post(path, body) {
  const res = await fetch(`${BASE_URL}${path}`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
  })
  return res.json()
}

// Hash field order from the Subscription API page; fields you don't send hash as ''.
const SUBSCRIPTION_HASH_FIELDS = ['req_time', 'merchant_id', 'tran_id', 'amount', 'items', 'shipping', 'firstname',
  'lastname', 'email', 'phone', 'type', 'payment_option', 'return_url', 'cancel_url', 'continue_success_url',
  'return_deeplink', 'currency', 'custom_fields', 'return_params', 'payout', 'lifetime', 'additional_params',
  'skip_success_page', 'token_flag', 'frequency']

export function subscribeFields(sub) {
  const plan = PLANS[sub.plan]
  const tranId = `${sub.id}c1x${randomBytes(4).toString('hex')}` // unique per sign-up attempt, max 20 chars
  charges.set(tranId, { tranId, subscriptionId: sub.id, amount: plan.amount })
  const f = {
    req_time: reqTime(),
    merchant_id: MERCHANT_ID,
    tran_id: tranId,
    amount: plan.amount,
    currency: plan.currency,
    payment_option: 'abapay',
    return_url: b64(`${PUBLIC_URL}/payway/callback`),
    return_params: JSON.stringify({ tran_id: tranId }), // echoed in the payment callback
    ctid: sub.ctid,
    token_flag: 'CITR_FIX',
    frequency: plan.frequency,
  }
  f.hash = paywayHash(SUBSCRIPTION_HASH_FIELDS.map(k => f[k]), API_KEY)
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

// Call from your daily job for each due cycle (2, 3, ...; your job decides the dates; cycle 1 is the sign-up).
// Each cycle has one tran_id, reserved before awaiting PayWay, so a re-run or a parallel run cannot charge it twice.
export async function chargeDue(sub, cycle) {
  const plan = PLANS[sub.plan]
  if (!sub.pwt) throw new Error(`subscription ${sub.id} has no active token`)
  const tranId = `${sub.id}c${cycle}`
  if (charges.has(tranId)) return charges.get(tranId)
  const charge = { tranId, subscriptionId: sub.id, amount: plan.amount }
  charges.set(tranId, charge)
  const b = {
    request_time: reqTime(),
    merchant_id: MERCHANT_ID,
    tran_id: tranId,
    ctid: sub.ctid,
    pwt: sub.pwt,
    amount: Number(plan.amount), // the fixed subscribed amount; JSON number, hashed as the same text
    currency: plan.currency,
    token_flag: 'MITR_FIX',
    callback_url: b64(`${PUBLIC_URL}/payway/callback`),
    return_params: JSON.stringify({ tran_id: tranId }),
  }
  b.hash = paywayHash(PAYMENT_HASH_FIELDS.map(k => b[k]), API_KEY)
  const r = await post('/api/payment-gateway/v3/purchase/payment-credential', b)
  if (r.status?.code !== '00') { // rejected: release the cycle so the next job run retries it
    charges.delete(tranId)
    throw new Error(`charge ${tranId} rejected: ${r.status?.message}`)
  }
  return charge // paid is set later by the callback (or call confirmCharge if no callback arrives)
}

export async function checkTransaction(tranId) {
  const b = { req_time: reqTime(), merchant_id: MERCHANT_ID, tran_id: tranId }
  b.hash = paywayHash([b.req_time, b.merchant_id, b.tran_id], API_KEY)
  return post('/api/payment-gateway/v1/payments/check-transaction-2', b)
}

// Confirms one charge with PayWay using our own tran_id and server-side amount; reserved before awaiting.
export async function confirmCharge(charge) {
  if (charge.paid || charge.checking) return charge.paid
  charge.checking = true
  try {
    const d = (await checkTransaction(charge.tranId)).data ?? {}
    charge.paid = d.payment_status === 'APPROVED' && Number(d.original_amount) === Number(charge.amount)
  } finally {
    charge.checking = false
  }
  return charge.paid
}

const app = express()
app.use(express.json())

app.post('/subscriptions/:id/subscribe', (req, res) => {
  const sub = subscriptions.get(req.params.id) // in a real app: the logged-in customer's subscription
  if (!sub) return res.status(404).json({ error: 'subscription not found' })
  if (sub.pwt) return res.status(409).json({ error: 'already subscribed' })
  res.json({ action: `${BASE_URL}/api/payment-gateway/v1/payments/purchase`, fields: subscribeFields(sub) })
})

app.post('/payway/callback', async (req, res) => {
  // Unsigned body: return_params / tran_id are only lookup keys into charges WE created;
  // the result comes from Check transaction for that charge, compared with its server-side amount.
  const charge = charges.get(tranIdFrom(req.body.return_params) ?? String(req.body.tran_id))
  if (!charge) return res.sendStatus(404)
  const paid = await confirmCharge(charge)
  // TODO: record the payment in your database when `paid` is true (make this idempotent).
  console.log('charge', charge.tranId, paid ? 'PAID' : 'not paid')
  res.sendStatus(200)
})

app.post('/payway/token-callback', async (req, res) => {
  // Not signed, and the Subscription request has no request_id of ours. So the token is taken only
  // from Get token details, and only if it matches one of our subscriptions: same ctid, CITR_FIX,
  // and the plan's frequency, amount and currency.
  const d = (await getTokenDetails(String(req.body.request_id))).data ?? {}
  const sub = [...subscriptions.values()].find(s => {
    const p = PLANS[s.plan]
    return s.ctid === d.ctid && d.token_flag === 'CITR_FIX' && d.frequency === p.frequency &&
      Number(d.subscribed_amount) === Number(p.amount) && d.currency === p.currency
  })
  if (!sub) return res.sendStatus(409)
  sub.pwt = d.status === 1 ? d.pwt : undefined // 0 removed, 2 frozen: stop charging
  res.sendStatus(200)
})

app.listen(process.env.PORT ?? 3000)
