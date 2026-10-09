---
id: example-node-online-checkout
type: example
title: Online checkout in Node.js
summary: Express server that signs Purchase form fields and confirms payment with Check transaction.
service: accept-payments/online-checkout
language: node
status: draft
verified_by:
verified_on:
related: [online-checkout, security]
---

# Online checkout in Node.js

## Prerequisites

- Environment variables `PAYWAY_MERCHANT_ID` and `PAYWAY_API_KEY` (sandbox values).
- Optional: `PAYWAY_BASE_URL` (defaults to `https://checkout-sandbox.payway.com.kh`), `PUBLIC_URL` (your public site URL, used for `return_url`), `PORT`.
- Node.js 18 or newer and Express (`npm install express`).
- [`payway-hash.mjs`](payway-hash.md) in the same folder.
- Your domain/IP and `return_url` domain whitelisted by PayWay.

## Code

<<< @/examples/node/online-checkout.mjs

## How to run

1. `node online-checkout.mjs`, then serve the [web example](../web/online-checkout.md) from the same origin and click **Pay**.
2. `POST /checkout` with `{"orderId":"1001"}` returns `{ action, fields }` including `hash`; the PayWay checkout opens in the browser.
3. After payment, PayWay calls `/payway/callback`; the server logs `order 1001 PAID` once Check transaction returns `APPROVED` with the expected amount.
