---
id: never-trust-client-amounts
type: best-practice
title: Never trust client amounts
summary: Compute and verify payment amounts on the server, never from browser input.
status: draft
related: [security]
---

# Never trust client amounts

Anyone can edit a request in the browser. If your server signs whatever amount the browser
sends, a customer can pay 0.01 for a 100.00 order.

**Do:** look up the order on the server, compute the amount from your own prices, sign that.

**Do:** when confirming a payment, compare PayWay's amount and currency with the stored order.

**Don't:** accept `amount` from a form field, query string or mobile app request.
