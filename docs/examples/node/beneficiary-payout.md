---
id: example-node-beneficiary-payout
type: example
title: Beneficiary payout in Node.js
summary: Express server that sends a server-side payout batch to whitelisted beneficiaries exactly once, and disables a beneficiary.
service: payouts/beneficiary-payout
language: node
status: draft
verified_by:
verified_on:
related: [beneficiary-payout, security]
---

# Beneficiary payout in Node.js

## Prerequisites

- Environment variables `PAYWAY_MERCHANT_ID` and `PAYWAY_API_KEY` (sandbox values). The server exits at start-up if any required variable is missing.
- `PAYWAY_RSA_PUBLIC_KEY`: the RSA public key (PEM) ABA Bank provides, used to encrypt `beneficiaries` and `merchant_auth`.
- Optional: `PAYWAY_BASE_URL` (defaults to `https://checkout-sandbox.payway.com.kh`), `PORT`.
- Node.js 18 or newer and Express (`npm install express`).
- [`payway-hash.mjs`](payway-hash.md) in the same folder.
- The sample accounts in `sellers` replaced with real sandbox ABA accounts in your merchant currency, each already whitelisted (the [split payment example](split-payment.md) has a `/sellers/:id/whitelist` route), and a funded settlement account.

## Code

<<< @/examples/node/beneficiary-payout.mjs

## How to run

1. `node beneficiary-payout.mjs`.
2. `curl -X POST http://localhost:3000/payouts/P20261009001/send` sends `19.75 USD` (`12.50` + `7.25`) with `tran_id` `P20261009001` and returns `{"state":"PAID",...}` when PayWay answers `status.code` `"0"` with `transaction_amount` `19.75`. Any other answer returns `502` with state `NEEDS_REVIEW`.
3. Sending the same payout again returns `409`: a payout is sent at most once.
4. `curl -X POST http://localhost:3000/sellers/s2/disable` returns `{"disabled":true,...}`; a later payout that includes `s2` returns `409` without calling PayWay.
