---
id: example-python-payment-link
type: example
title: Payment link in Python
summary: FastAPI server that creates a payment link for an order and confirms the payment before marking the order paid.
service: accept-payments/payment-link
language: python
status: draft
verified_by:
verified_on:
related: [payment-link, security]
---

# Payment link in Python

## Prerequisites

- Environment variables `PAYWAY_MERCHANT_ID` and `PAYWAY_API_KEY` (sandbox values).
- `PAYWAY_RSA_PUBLIC_KEY`: the RSA public key (PEM) PayWay provides for `merchant_auth`.
- Optional: `PAYWAY_BASE_URL` (defaults to `https://checkout-sandbox.payway.com.kh`), `PUBLIC_URL` (your public site URL, used for `return_url`).
- Python 3.8 or newer with `pip install fastapi uvicorn httpx cryptography` (the standard library has no RSA).
- [`payway_hash.py`](payway-hash.md) in the same folder.

## Code

<<< @/examples/python/payment_link.py

## How to run

1. `uvicorn payment_link:app --port 3000`, then `curl -X POST http://localhost:3000/orders/3001/payment-link`.
2. The response is `{"paymentLink":"https://..."}`; send that URL to the customer.
3. After payment, PayWay calls `/payway/callback`. The server prints `order 3001 PAID` only if the order's own link is `PAID` with the expected amount, Check transaction returns `APPROVED`, and the `tran_id` was not used before.
