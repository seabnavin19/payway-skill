---
id: example-python-pre-auth-capture
type: example
title: Pre-auth & capture in Python
summary: FastAPI server that holds a deposit with a pre-auth Purchase, confirms the hold, then completes it for the final bill or cancels it.
service: hold-payments/pre-auth-capture
language: python
status: draft
verified_by:
verified_on:
related: [pre-auth-capture, security]
---

# Pre-auth & capture in Python

## Prerequisites

- Environment variables `PAYWAY_MERCHANT_ID` and `PAYWAY_API_KEY` (sandbox values).
- `PAYWAY_RSA_PUBLIC_KEY`: the RSA public key (PEM) ABA Bank provides for `merchant_auth`.
- Optional: `PAYWAY_BASE_URL` (defaults to `https://checkout-sandbox.payway.com.kh`), `PUBLIC_URL` (your public site URL, used for `return_url`).
- Python 3.8 or newer with `pip install fastapi uvicorn httpx cryptography` (the standard library has no RSA).
- [`payway_hash.py`](payway-hash.md) in the same folder.

## Code

<<< @/examples/python/pre_auth_capture.py

## How to run

1. `uvicorn pre_auth_capture:app --port 3000`, then `curl -X POST http://localhost:3000/bookings/7001/hold`.
2. Post the returned `fields` as a form to `action` from your page (as in the [online checkout web example](../web/online-checkout.md)) and authorize the `100.00 USD` hold.
3. PayWay calls `/payway/callback`; the server prints `booking 7001 HELD` only if Check transaction returns `PRE-AUTH` for `7001` with amount `100.00`.
4. `curl -X POST http://localhost:3000/bookings/7001/capture` completes `80.00` and returns `{"state":"COMPLETED",...}` — or `curl -X POST http://localhost:3000/bookings/7001/cancel` returns `{"state":"CANCELLED",...}`. A second capture or cancel returns `409`.
