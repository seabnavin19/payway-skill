// Beneficiary payout (PayWay Payout) with Express.
// POST /payouts/:id/send     -> sends one payout batch from your settlement account, at most once (staff only)
// POST /sellers/:id/disable  -> disables a seller's beneficiary with Update a beneficiary status (staff only)
// Whitelist each account first with Add a beneficiary to whitelist (see the split-payment example).
// Env: PAYWAY_MERCHANT_ID, PAYWAY_API_KEY, PAYWAY_RSA_PUBLIC_KEY (PEM from ABA Bank), PAYWAY_BASE_URL (default sandbox)
import { constants, createHmac, publicEncrypt } from 'node:crypto'
import express from 'express'
import { paywayHash } from './payway-hash.mjs'

for (const k of ['PAYWAY_MERCHANT_ID', 'PAYWAY_API_KEY', 'PAYWAY_RSA_PUBLIC_KEY']) {
  if (!process.env[k]) throw new Error(`${k} is not set`)
}
const BASE_URL = process.env.PAYWAY_BASE_URL ?? 'https://checkout-sandbox.payway.com.kh'
const MERCHANT_ID = process.env.PAYWAY_MERCHANT_ID
const API_KEY = process.env.PAYWAY_API_KEY
const RSA_PUBLIC_KEY = process.env.PAYWAY_RSA_PUBLIC_KEY

const reqTime = () => new Date().toISOString().replace(/\D/g, '').slice(0, 14) // UTC YYYYMMDDHHmmss

// Replace with your database. Accounts and amounts come only from your own records:
// a payout batch is created by your accounting (e.g. weekly seller earnings), never from a request body.
const sellers = new Map([
  ['s1', { id: 's1', account: '000133879', active: true }],
  ['s2', { id: 's2', account: '000133880', active: true }],
])
const payouts = new Map([['P20261009001', { id: 'P20261009001', currency: 'USD',
  lines: [{ sellerId: 's1', amount: 12.5 }, { sellerId: 's2', amount: 7.25 }] }]])

// Work in minor units (cents; riel for KHR) so the total is the exact sum of the lines.
const unit = c => (c === 'KHR' ? 1 : 100)
const fmt = (minor, c) => (c === 'KHR' ? String(minor) : (minor / 100).toFixed(2)) // KHR: no decimals

export function beneficiariesFor(batch) {
  const shares = new Map() // account -> minor units, one entry per account
  for (const l of batch.lines) {
    const seller = sellers.get(l.sellerId)
    if (!seller?.active) throw new Error(`seller ${l.sellerId} is not an active beneficiary`)
    shares.set(seller.account, (shares.get(seller.account) ?? 0) + Math.round(l.amount * unit(batch.currency)))
  }
  if (shares.size > 10) throw new Error('PayWay allows at most 10 beneficiaries per request') // code 25
  const total = [...shares.values()].reduce((a, b) => a + b, 0)
  return {
    amount: Number(fmt(total, batch.currency)), // code 92: must equal the sum of the beneficiary amounts
    list: [...shares].map(([account, minor]) => ({ account, amount: Number(fmt(minor, batch.currency)) })),
  }
}

// JSON encrypted with the RSA public key in 117-byte chunks, then Base64
// (port of the portal's PHP sample; PKCS#1 v1.5 = PHP openssl_public_encrypt default).
export function rsaEncrypt(obj) {
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

export async function sendPayout(batch, { amount, list }) {
  const b = { merchant_id: MERCHANT_ID, tran_id: batch.id, beneficiaries: rsaEncrypt(list), amount, currency: batch.currency }
  // Payout hash: merchant_id, tran_id, beneficiaries, amount, custom_fields ('' when not sent), currency.
  // The portal's PHP sample outputs a hex digest here (no base64_encode), so paywayHash() is not used.
  const message = [b.merchant_id, b.tran_id, b.beneficiaries, String(b.amount), '', b.currency].join('')
  b.hash = createHmac('sha512', API_KEY).update(message, 'utf8').digest('hex')
  return { amount, response: await post('/api/payment-gateway/v2/direct-payment/merchant/payout', b) }
}

export async function updateBeneficiaryStatus(payee, status) {
  const requestTime = reqTime()
  const merchantAuth = rsaEncrypt({ mc_id: MERCHANT_ID, payee, status })
  return post('/api/merchant-portal/merchant-access/whitelist-account/update-whitelist-status', {
    request_time: requestTime,
    merchant_id: MERCHANT_ID,
    merchant_auth: merchantAuth,
    hash: paywayHash([requestTime, merchantAuth], API_KEY), // request_time, merchant_auth (Base64)
  })
}

const app = express()
app.use(express.json())

// TODO: protect both routes with your staff authentication. Only record IDs come from the request.
app.post('/payouts/:id/send', async (req, res) => {
  const batch = payouts.get(req.params.id)
  if (!batch) return res.status(404).json({ error: 'payout not found' })
  if (batch.state) return res.status(409).json({ error: `payout is ${batch.state}` })
  let plan
  try {
    plan = beneficiariesFor(batch)
  } catch (e) {
    return res.status(409).json({ error: e.message }) // nothing sent
  }
  batch.state = 'SENDING' // reserve before awaiting PayWay: a double-click or retry cannot send twice
  let r
  try {
    r = await sendPayout(batch, plan)
  } catch (e) {
    // Unknown outcome (network error, timeout): money may have moved. Never auto-retry; reconcile first.
    batch.state = 'NEEDS_REVIEW'
    return res.status(502).json({ state: batch.state, error: e.message })
  }
  const s = r.response.status ?? {}
  const ok = s.code === '0' && Number(r.response.transaction_amount) === r.amount
  // Anything but a clean success stays out of the send path until someone reconciles it
  // (codes 4/83 mean this tran_id was already used; 91 means the beneficiary credit failed).
  batch.state = ok ? 'PAID' : 'NEEDS_REVIEW'
  batch.result = r.response // keep external_reference, payout_id and trace_id for reconciliation
  res.status(ok ? 200 : 502).json({ state: batch.state, status: s })
})

app.post('/sellers/:id/disable', async (req, res) => {
  const seller = sellers.get(req.params.id)
  if (!seller) return res.status(404).json({ error: 'seller not found' })
  seller.active = false // stop using the account locally before awaiting PayWay
  const r = await updateBeneficiaryStatus(seller.account, 0)
  const ok = r.status?.code === '00' && r.data?.status === 0
  res.status(ok ? 200 : 502).json({ disabled: ok, status: r.status })
})

app.listen(process.env.PORT ?? 3000)
