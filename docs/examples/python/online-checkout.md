---
id: example-python-online-checkout
type: example
title: Online checkout in Python
summary: FastAPI server that signs Purchase form fields and confirms payment with Check transaction.
service: accept-payments/online-checkout
language: python
status: draft
verified_by:
verified_on:
related: [online-checkout, security]
---

# Online checkout in Python

## Prerequisites

- Environment variables `PAYWAY_MERCHANT_ID` and `PAYWAY_API_KEY` (sandbox values).
- Optional: `PAYWAY_BASE_URL` (defaults to `https://checkout-sandbox.payway.com.kh`), `PUBLIC_URL` (your public site URL, used for `return_url`).
- Python 3.8 or newer with `pip install fastapi uvicorn httpx`.
- [`payway_hash.py`](payway-hash.md) in the same folder.
- Your domain/IP and `return_url` domain whitelisted by PayWay.

## Code

<<< @/examples/python/online_checkout.py

## How to run

1. `uvicorn online_checkout:app --port 3000`, then serve the [web example](../web/online-checkout.md) from the same origin and click **Pay**.
2. `POST /checkout` with `{"orderId":"1001"}` returns `{ action, fields }` including `hash`; the PayWay checkout opens in the browser.
3. After payment, PayWay calls `/payway/callback`; the server prints `order 1001 PAID` once Check transaction returns `APPROVED` with the expected amount.
