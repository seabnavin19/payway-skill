---
id: security
type: guide
title: Security essentials
summary: Non-negotiable rules for API keys, request signing, callbacks and amounts.
status: draft
related: [go-live-checklist, never-trust-client-amounts]
---

# Security essentials

Every PayWay integration must follow these rules.

## Keep secrets on the server

- Read `PAYWAY_MERCHANT_ID` and `PAYWAY_API_KEY` from environment variables or a secret manager.
- Never commit them, log them, or send them to the browser or mobile app.
- Use separate sandbox and production keys; never use production keys in development.

## Sign requests on the server

- Compute the hash with HMAC-SHA512 (base64) on the server only:
  [Node.js](../examples/node/payway-hash.md) · [Python](../examples/python/payway-hash.md).
- Concatenate fields in the exact order listed in the API page's **Authentication & hash** section.
- Hash the exact strings you send — `"10.00"` and `"10"` produce different hashes.
- Browser/HTML code receives an already-computed hash from your server; it never computes one.

## Treat callbacks as a hint, then confirm

- Your callback URL must be HTTPS.
- Verify the callback as described on the relevant API page.
- Before fulfilling an order, confirm the transaction status from your server with PayWay's
  transaction status API, and check the amount and currency match your order.
- Make callback handling idempotent: the same callback may arrive more than once.

## Amounts

- Compute amounts on the server from your own order data. See
  [Never trust client amounts](../best-practices/never-trust-client-amounts.md).

## Transaction IDs

- Generate a unique `tran_id` per payment attempt and store it with the order before calling PayWay.
