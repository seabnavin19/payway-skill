---
id: example-python-payway-hash
type: example
title: Request signing in Python
summary: payway_hash() — HMAC-SHA512 request signing for Python, tested against test vectors.
language: python
status: draft
related: [security]
---

# Request signing in Python

## Prerequisites

- Python 3.8 or newer (standard library only, no packages).

## Code

<<< @/examples/python/payway_hash.py

## How to run

```python
import os
from payway_hash import payway_hash
hash_ = payway_hash([req_time, merchant_id, tran_id, amount], os.environ["PAYWAY_API_KEY"])
```

Pass values in the order from the API page's **Authentication & hash** section.
