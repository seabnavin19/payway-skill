---
id: example-node-dynamic-qr
type: example
title: Dynamic QR in Node.js
summary: Express server that generates a payment QR with the QR API and confirms payment with Check transaction.
service: accept-payments/dynamic-qr
language: node
status: draft
verified_by:
verified_on:
related: [dynamic-qr, security]
---

# Dynamic QR in Node.js

## Prerequisites

- Environment variables `PAYWAY_MERCHANT_ID` and `PAYWAY_API_KEY` (sandbox values).
- Optional: `PAYWAY_BASE_URL` (defaults to `https://checkout-sandbox.payway.com.kh`), `PUBLIC_URL` (your public site URL, used for `callback_url`), `PORT`.
- Node.js 18 or newer and Express (`npm install express`).
- [`payway-hash.mjs`](payway-hash.md) in the same folder.
- Your server's domain/IP and `callback_url` domain whitelisted by PayWay.

## Code

<<< @/examples/node/dynamic-qr.mjs

## How to run

1. `node dynamic-qr.mjs`, then open the [web example](../web/dynamic-qr.md) from the same origin and click **Show payment QR**.
2. `POST /qr` with `{"orderId":"2001"}` returns `qrImage`, `qrString`, `amount` and `currency`; the QR appears on screen.
3. After the customer pays, PayWay calls `/payway/callback`; the server logs `order 2001 PAID` once Check transaction returns `APPROVED` with the expected amount.
