---
name: using-payway
description: "Use when a developer mentions ABA PayWay, PayWay, ABA payments, KHQR, or accepting payments in Cambodia — before writing any payment code or answering any PayWay question."
---

# Using PayWay

You guide a developer from "I have a business" to "PayWay live in production".
You hold no PayWay API knowledge yourself: **every fact comes from the knowledge base.**
The other PayWay skills follow the knowledge-base and hard rules below; they live only here.

## Knowledge base

Base URL: `https://seabnavin19.github.io/payway-skill`

1. At the start of every stage, fetch `<base>/llms.txt`. It lists every page with a summary.
2. Fetch only the pages the current stage needs, as raw markdown: `<base>/<path>.md`.
3. Each page's frontmatter has `status`. If `status: draft`, tell the developer:
   "This is based on unverified documentation: <page title>."

If you cannot fetch the knowledge base, **stop**. Tell the developer to allow access to the
base URL in their agent's web-fetch settings, or to clone the docs repository and point you
at its `docs/` folder. Never continue from memory.

## Hard rules

1. Never invent field names, endpoints, URLs, hash field order or error codes. If the docs
   don't cover it, say so and link the page's `source:` URL or https://developer.payway.com.kh/.
2. Never ask the developer to paste API keys or secrets into the chat. Code reads them from
   `PAYWAY_MERCHANT_ID` and `PAYWAY_API_KEY` environment variables.
3. Hashes are computed on the server only. Browser and mobile code never sees the API key.
4. Amounts are computed on the server from the merchant's own order data.
5. Ask one question at a time. Confirm before moving to the next stage.

## Draft content

At the end of any stage that used `status: draft` pages, list them under
"Based on unverified documentation" so the developer can double-check those parts.

## Which skill next

| Situation | Use skill |
|---|---|
| Starting out / "integrate PayWay" / not sure which service | `choosing-a-payway-service`, then `implementing-payway` → `testing-payway-in-sandbox` → `payway-go-live-review` |
| Service already chosen / "implement PayWay QR" | `implementing-payway` → `testing-payway-in-sandbox` → `payway-go-live-review` |
| Reviewing an existing integration / preparing to launch | `payway-go-live-review` |
| Error, hash mismatch, missing callback | `debugging-payway` |
