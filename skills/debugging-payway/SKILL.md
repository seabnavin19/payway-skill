---
name: debugging-payway
description: "Use when a PayWay call fails — hash mismatch, a PayWay error code, a rejected request, or a callback that never arrives or doesn't match."
---

# Debugging PayWay

Follow the knowledge-base rules, hard rules and Draft content section in the `using-payway` skill.

1. Fetch `llms.txt` and find the API pages for the failing call.
2. Read their "Errors" and "Pitfalls" sections.
3. Diagnose against the developer's code: compare field names, URLs, hash field order and
   callback handling with what the pages say.

Never guess what an error code means. If the pages don't list it, say so and link the page's
`source:` URL or https://developer.payway.com.kh/.
