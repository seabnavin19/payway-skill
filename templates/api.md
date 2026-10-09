---
id: <service-short>-<endpoint-short>        # e.g. checkout-purchase — never change after merge
type: api
title: <Endpoint name as on the portal>
summary: <One sentence: what this endpoint does.>
service: <group>/<service>                  # e.g. accept-payments/online-checkout
source: <exact developer.payway.com.kh URL>
status: draft
verified_by:
verified_on:
related: [security]
---

# <Endpoint name>

<One paragraph: when you call this endpoint and what happens next.>

## Endpoint

| | Sandbox | Production |
|---|---|---|
| Method | `POST` | `POST` |
| URL | `<sandbox url>` | `<production url>` |
| Content-Type | `<content type>` | |

## Authentication & hash

Fields concatenated **in this exact order**, then signed with
[`paywayHash`](../examples/node/payway-hash.md) using your API key:

1. `<field>`
2. `<field>`

## Request fields

| Name | Type | Required | Rules / Description |
|---|---|---|---|
| `<field>` | string(20) | Yes | <rule> |

## Response

```json
<response example copied from the portal>
```

| Name | Type | Description |
|---|---|---|

## Errors

| Code | Meaning | What to do |
|---|---|---|

## Pitfalls

- <Something developers commonly get wrong with this endpoint.>
