---
id: example-node-payway-hash
type: example
title: Request signing in Node.js
summary: paywayHash() — HMAC-SHA512 request signing for Node.js, tested against test vectors.
language: node
status: draft
related: [security]
---

# Request signing in Node.js

## Prerequisites

- Node.js 18 or newer (uses built-in `node:crypto`, no packages).

## Code

<<< @/examples/node/payway-hash.mjs

## How to run

```js
import { paywayHash } from './payway-hash.mjs'
const hash = paywayHash([reqTime, merchantId, tranId, amount], process.env.PAYWAY_API_KEY)
```

Pass values in the order from the API page's **Authentication & hash** section.
