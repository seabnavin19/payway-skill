---
id: example-node-recurring
type: example
title: Recurring in Node.js
summary: Express server that signs up a customer to a fixed plan (CITR_FIX), stores the token from Get token details, and charges each cycle with MITR_FIX.
service: auto-payments/recurring
language: node
status: draft
verified_by:
verified_on:
related: [recurring, security]
---

# Recurring in Node.js

## Prerequisites

- Environment variables `PAYWAY_MERCHANT_ID` and `PAYWAY_API_KEY` (sandbox values). The server exits at start-up if either is missing.
- Credentials on File with `CITR_FIX` / `MITR_FIX` enabled on your PayWay profile, and the Credential on File callback URL set to `<PUBLIC_URL>/payway/token-callback`.
- Optional: `PAYWAY_BASE_URL` (defaults to `https://checkout-sandbox.payway.com.kh`), `PUBLIC_URL` (your public site URL, used for the callback URLs), `PORT`.
- Node.js 18 or newer and Express (`npm install express`).
- [`payway-hash.mjs`](payway-hash.md) in the same folder.

## Code

<<< @/examples/node/recurring.mjs

## How to run

1. `node recurring.mjs`, then `curl -X POST http://localhost:3000/subscriptions/s1/subscribe`.
2. The response is `{"action": "...", "fields": {...}}`. Post those fields as a form to `action` from your page (as in the [online checkout web example](../web/online-checkout.md)) and pay the first `20.00 USD`.
3. PayWay calls `/payway/callback` (the server logs `charge s1c1x... PAID` after Check transaction confirms it) and `/payway/token-callback` (the server stores the `pwt` from Get token details).
4. Call `chargeDue(subscription, cycle)` from your daily job (in this single-file example, from a timer or an internal route you protect). Each cycle (`2` → `s1c2`, `3` → `s1c3`, ...) is charged at most once with `MITR_FIX`; the callback then confirms it the same way.
