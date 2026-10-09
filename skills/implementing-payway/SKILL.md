---
name: implementing-payway
description: "Use when writing or changing code that calls ABA PayWay APIs for a chosen service — checkout, QR, payment link, tokenization, recurring, pre-auth/capture, or payouts."
---

# Implementing PayWay

Follow the knowledge-base rules, hard rules and Draft content section in the `using-payway` skill.

## Stage 3 — Implement

Read, in order: the service page, every page in its "APIs involved", the example page for the
detected language, `guides/security.md`, and any related `best-practices/` pages.
Write code that:
- uses field names, URLs and hash field order exactly as written in the API pages;
- adapts the example to the project's framework and conventions;
- verifies callbacks and confirms transaction status server-side before fulfilling orders.

If the project's language has no example, follow the API pages directly and say there is no
official example for that language.

## Then

Hand off to the `testing-payway-in-sandbox` skill.
