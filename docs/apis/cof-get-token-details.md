---
id: cof-get-token-details
type: api
title: Get token details
summary: Retrieves the linked account or card token (pwt) and its status for one of your request IDs.
service: auto-payments/tokenization
source: https://developer.payway.com.kh/get-token-details-19336824e0
status: draft
verified_by:
verified_on:
related: [security, tokenization, recurring, cof-link-account, cof-link-card]
---

# Get token details

The portal offers this for when the callback from **link account**, **link card** or **token
renewal** does not arrive. Because that callback is not signed, the examples also call it after every
token callback, with the `request_id` *you* stored, and save the token from this response instead
of from the callback body.

## Endpoint

| | Sandbox | Production |
|---|---|---|
| Method | `POST` | `POST` |
| URL | `https://checkout-sandbox.payway.com.kh/api/payment-credential/v3/token-management/get-token-details` | `https://checkout.payway.com.kh/api/payment-credential/v3/token-management/get-token-details` |
| Content-Type | `application/json` | |

Production base URL is from the portal's [API Endpoints](https://developer.payway.com.kh/api-endpoints-984508m0) page.

## Authentication & hash

Fields concatenated **in this exact order**, then signed with
[`paywayHash`](../examples/node/payway-hash.md) using your API key:

1. `merchant_id`
2. `request_time`
3. `request_id`

## Request fields

| Name | Type | Required | Rules / Description |
|---|---|---|---|
| `request_time` | string | Yes | Request date and time in UTC, `YYYYMMDDHHmmss`. |
| `request_id` | string | Yes | The `request_id` you sent when linking. 5–24 letters and digits. Only the last record is returned. |
| `merchant_id` | string(20) | Yes | Merchant key provided by ABA Bank. |
| `hash` | string | Yes | Base64 HMAC-SHA512, see above. |

## Response

```json
{
  "status": {
    "code": "00",
    "message": "Success",
    "trace_id": "175576519295871"
  },
  "data": {
    "ctid": "64513556cc930062e8cb3ae59eee8fbf459c53e",
    "pwt": "6451355C97035CDE21FB13..E0945C21007136F3D423A1B",
    "source_of_fund": "*****5312",
    "type": "ABA ACCOUNT",
    "status": 0,
    "expired_at": "2019-08-24T14:15:22Z",
    "token_flag": "CITI_FLEX",
    "frequency": "",
    "subscribed_amount": 0,
    "amount_limit_per_tran": 200,
    "currency": "USD"
  }
}
```

| Name | Type | Description |
|---|---|---|
| `status.code` | string | `00` = success. See Errors. |
| `status.message` | string | Message for `code`. |
| `status.trace_id` | string | Log ID for debugging. |
| `data.ctid` | string | Your consumer identification number. |
| `data.pwt` | string | PayWay Token, used to make payments. |
| `data.source_of_fund` | string | Masked card or ABA account number (last 4 digits shown). |
| `data.type` | string | `Visa`, `MC` (Mastercard), `CUP` (UnionPay), `JCB`, `ABA ACCOUNT`. |
| `data.status` | integer | `0` removed, `1` active, `2` frozen. |
| `data.expired_at` | string (date-time) | Token expiry date. |
| `data.token_flag` | string | `CITI_FLEX`, `CITO_FLEX` or `CITR_FIX`. |
| `data.frequency` | string | Empty for `CITI_FLEX` / `CITO_FLEX`. For `CITR_FIX`: `1W` weekly, `1M` monthly, `2M` every 2 months. |
| `data.subscribed_amount` | number | Fixed subscription amount; `0` for `CITI_FLEX` / `CITO_FLEX`. |
| `data.amount_limit_per_tran` | number | Per-transaction amount limit; equals `subscribed_amount` for `CITR_FIX`. |
| `data.currency` | string | Token currency. |

## Errors

| Code | Meaning | What to do |
|---|---|---|
| `00` | Success | Read `data`. |
| `01` | Wrong hash | Check field order and API key. (The portal's example shows this as `"1"`.) |
| `04` | The given data was invalid (HTTP 400; details in `status.errors`) | Fix the fields listed in `errors`. |
| `98` | Merchant id not found | Check `merchant_id` / environment. |
| `104` | Data not found | Check `request_id`; the link may not be finished yet. |

## Pitfalls

- The hash order (`merchant_id`, `request_time`, `request_id`) differs from the JSON field order.
- Check `data.status` is `1` before charging: `0` (removed) and `2` (frozen) tokens are declined.
- Compare `data.ctid` with the `ctid` you stored for that customer before saving the token.
- The portal shows wrong hash as both `01` and `1`; compare codes loosely.
