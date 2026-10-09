---
id: example-python-split-payment
type: example
title: Split payment in Python
summary: FastAPI server that whitelists seller accounts, signs a Purchase with a server-computed payout split, and confirms payment once with Check transaction.
service: payouts/split-payment
language: python
status: draft
verified_by:
verified_on:
related: [split-payment, security]
---

# Split payment in Python

## Prerequisites

- Environment variables `PAYWAY_MERCHANT_ID` and `PAYWAY_API_KEY` (sandbox values).
- `PAYWAY_RSA_PUBLIC_KEY`: the RSA public key (PEM) ABA Bank provides for `merchant_auth` (used by Add a beneficiary to whitelist).
- Optional: `PAYWAY_BASE_URL` (defaults to `https://checkout-sandbox.payway.com.kh`), `PUBLIC_URL` (your public site URL, used for `return_url`).
- Python 3.8 or newer with `pip install fastapi uvicorn httpx cryptography` (the standard library has no RSA).
- [`payway_hash.py`](payway-hash.md) in the same folder.
- Replace the sample accounts in `SELLERS` with real sandbox ABA accounts in your merchant currency; `platform` is your own account.

## Code

<<< @/examples/python/split_payment.py

## How to run

1. `uvicorn split_payment:app --port 3000`, then whitelist every account once: `curl -X POST http://localhost:3000/sellers/s1/whitelist` (repeat for `s2` and `platform`). Each returns `{"whitelisted":true,...}` when PayWay reports the beneficiary Active.
2. `POST /checkout` with `{"orderId":"2001"}` returns `{ action, fields }`. Order 2001 is `6.00 USD`; `payout` decodes to `[{"acc":"000133879","amt":4.5},{"acc":"000133880","amt":0.9},{"acc":"000133881","amt":0.6}]` — 10% fee to `platform`, total `6.00`. Before whitelisting, `/checkout` returns `409`.
3. Post the fields as a form to `action` (as in the [online checkout web example](../web/online-checkout.md)) and pay. PayWay calls `/payway/callback`; the server prints `order 2001 PAID` once Check transaction returns `APPROVED` with amount `6.00`.
