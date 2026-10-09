---
id: example-node-pre-auth-capture
type: example
title: Pre-auth & capture in Node.js
summary: Express server that holds a deposit with a pre-auth Purchase, confirms the hold, then completes it for the final bill or cancels it.
service: hold-payments/pre-auth-capture
language: node
status: draft
verified_by:
verified_on:
related: [pre-auth-capture, security]
---

# Pre-auth & capture in Node.js

## Prerequisites

- Environment variables `PAYWAY_MERCHANT_ID` and `PAYWAY_API_KEY` (sandbox values). The server exits at start-up if any required variable is missing.
- `PAYWAY_RSA_PUBLIC_KEY`: the RSA public key (PEM) ABA Bank provides for `merchant_auth`.
- Optional: `PAYWAY_BASE_URL` (defaults to `https://checkout-sandbox.payway.com.kh`), `PUBLIC_URL` (your public site URL, used for `return_url`), `PORT`.
- Node.js 18 or newer and Express (`npm install express`).
- [`payway-hash.mjs`](payway-hash.md) in the same folder.

## Code

<<< @/examples/node/pre-auth-capture.mjs

## How to run

1. `node pre-auth-capture.mjs`, then `curl -X POST http://localhost:3000/bookings/7001/hold`.
2. Post the returned `fields` as a form to `action` from your page (as in the [online checkout web example](../web/online-checkout.md)) and authorize the `100.00 USD` hold.
3. PayWay calls `/payway/callback`; the server logs `booking 7001 HELD` only if Check transaction returns `PRE-AUTH` for `7001` with amount `100.00`.
4. `curl -X POST http://localhost:3000/bookings/7001/capture` completes `80.00` and returns `{"state":"COMPLETED",...}` — or `curl -X POST http://localhost:3000/bookings/7001/cancel` returns `{"state":"CANCELLED",...}`. A second capture or cancel returns `409`.
