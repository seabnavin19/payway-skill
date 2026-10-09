---
id: example-web-online-checkout
type: example
title: Online checkout in HTML/JS
summary: Browser page that gets signed fields from your server and opens the PayWay checkout popup.
service: accept-payments/online-checkout
language: web
status: draft
verified_by:
verified_on:
related: [online-checkout, security]
---

# Online checkout in HTML/JS

## Prerequisites

- A server running the [Node.js](../node/online-checkout.md) or [Python](../python/online-checkout.md) example, which holds your PayWay merchant ID and key in environment variables. The browser never sees them.
- The page served from a domain whitelisted by PayWay.

## Code

<<< @/examples/web/online-checkout.html

## How to run

1. Serve this page from the same origin as your server's `POST /checkout` route.
2. Click **Pay**: the page posts only the order ID, receives signed fields, and `AbaPayway.checkout()` opens the PayWay popup (desktop) or bottom sheet (mobile).
