---
id: <service>                               # e.g. online-checkout
type: service
title: <Service name>
summary: <One sentence: what business problem this solves.>
service: <group>/<service>
source: <portal URL>
status: draft
verified_by:
verified_on:
related: [security, go-live-checklist]
---

# <Service name>

## When to use

- <Business situation>

## When not to use

- <Situation> → use [<other service>](../<group>/<service>.md) instead.

## Flow

```mermaid
sequenceDiagram
  participant C as Customer
  participant M as Merchant server
  participant P as PayWay
  M->>P: <request>
  P-->>M: <response>
```

## APIs involved

| Step | API |
|---|---|
| 1 | [<Endpoint>](../../apis/<id>.md) |

## Sandbox testing

1. <Steps to test end-to-end in sandbox.>

## Examples

- [Node.js](../../examples/node/<service>.md)
- [Python](../../examples/python/<service>.md)

## Best practices

- <Service-specific practice.> See also [Security](../../guides/security.md).
