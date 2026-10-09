---
id: example-web-dynamic-qr
type: example
title: Dynamic QR in HTML/JS
summary: Screen page that asks your server for a payment QR and displays it.
service: accept-payments/dynamic-qr
language: web
status: draft
verified_by:
verified_on:
related: [dynamic-qr, security]
---

# Dynamic QR in HTML/JS

## Prerequisites

- A server running the [Node.js](../node/dynamic-qr.md) or [Python](../python/dynamic-qr.md) example, which holds `PAYWAY_MERCHANT_ID` and `PAYWAY_API_KEY`. The browser never sees them.

## Code

<<< @/examples/web/dynamic-qr.html

## How to run

1. Serve this page from the same origin as your server's `POST /qr` route (e.g. on the customer-facing display).
2. Click **Show payment QR**: the page posts only the order ID and shows the returned `qrImage` with the amount.
