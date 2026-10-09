---
id: example-python-tokenization
type: example
title: Tokenization in Python
summary: FastAPI server that links a customer's ABA account or card, stores the token from Get token details, and charges it with one click.
service: auto-payments/tokenization
language: python
status: draft
verified_by:
verified_on:
related: [tokenization, security]
---

# Tokenization in Python

## Prerequisites

- Environment variables `PAYWAY_MERCHANT_ID` and `PAYWAY_API_KEY` (sandbox values).
- Credentials on File and the `CITI_FLEX` token flag enabled on your PayWay profile.
- Optional: `PAYWAY_BASE_URL` (defaults to `https://checkout-sandbox.payway.com.kh`), `PUBLIC_URL` (your public site URL, used for the callback URLs).
- Python 3.8 or newer with `pip install fastapi uvicorn httpx`.
- [`payway_hash.py`](payway-hash.md) in the same folder.

## Code

<<< @/examples/python/tokenization.py

## How to run

1. `uvicorn tokenization:app --port 3000`, then `curl -X POST http://localhost:3000/customers/c1/link-account`.
2. The response contains `qr_string` and `deeplink`. Render `qr_string` as a QR code and scan it with ABA Mobile (or open `deeplink` on a phone) and link an account.
3. PayWay calls `/payway/token-callback`; the server saves the `pwt` returned by Get token details for that request.
4. `curl -X POST http://localhost:3000/orders/5001/pay` returns `{"accepted":true}`. When PayWay calls `/payway/payment-callback`, the server prints `order 5001 PAID` only if Check transaction returns `APPROVED` for `5001` with amount `3.00`. If no callback arrives within a few seconds, call `confirm_order()` yourself.
