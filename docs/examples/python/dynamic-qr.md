---
id: example-python-dynamic-qr
type: example
title: Dynamic QR in Python
summary: FastAPI server that generates a payment QR with the QR API and confirms payment with Check transaction.
service: accept-payments/dynamic-qr
language: python
status: draft
verified_by:
verified_on:
related: [dynamic-qr, security]
---

# Dynamic QR in Python

## Prerequisites

- Environment variables `PAYWAY_MERCHANT_ID` and `PAYWAY_API_KEY` (sandbox values).
- Optional: `PAYWAY_BASE_URL` (defaults to `https://checkout-sandbox.payway.com.kh`), `PUBLIC_URL` (your public site URL, used for `callback_url`).
- Python 3.8 or newer with `pip install fastapi uvicorn httpx`.
- [`payway_hash.py`](payway-hash.md) in the same folder.
- Your server's domain/IP and `callback_url` domain whitelisted by PayWay.

## Code

<<< @/examples/python/dynamic_qr.py

## How to run

1. `uvicorn dynamic_qr:app --port 3000`, then open the [web example](../web/dynamic-qr.md) from the same origin and click **Show payment QR**.
2. `POST /qr` with `{"orderId":"2001"}` returns `qrImage`, `qrString`, `amount` and `currency`; the QR appears on screen.
3. After the customer pays, PayWay calls `/payway/callback`; the server prints `order 2001 PAID` once Check transaction returns `APPROVED` with the expected amount.
