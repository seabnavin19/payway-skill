---
id: cof-payment
type: api
title: Payment
summary: Charges a customer's saved ABA account or card using a stored token (ctid + pwt).
service: auto-payments/tokenization
source: https://developer.payway.com.kh/payment-19336821e0
status: draft
verified_by:
verified_on:
related: [security, tokenization, cof-link-account, cof-link-card, checkout-check-transaction]
---

# Payment

Call this from your server to charge a stored token: when the customer clicks "Pay now" with a saved
method (`CITU_FLEX`), when you charge on demand (`MITU_FLEX`), or for each scheduled charge of a
subscription (`MITR_FIX`). The response only says whether the request was accepted; the result
arrives at your `callback_url`, and you confirm it with
[Check transaction](checkout-check-transaction.md). Can also place a hold (`purchase_type`
`pre-auth`).

## Endpoint

| | Sandbox | Production |
|---|---|---|
| Method | `POST` | `POST` |
| URL | `https://checkout-sandbox.payway.com.kh/api/payment-gateway/v3/purchase/payment-credential` | `https://checkout.payway.com.kh/api/payment-gateway/v3/purchase/payment-credential` |
| Content-Type | `application/json` | |

Production base URL is from the portal's [API Endpoints](https://developer.payway.com.kh/api-endpoints-984508m0) page.

## Authentication & hash

Fields concatenated **in this exact order**, then signed with
[`paywayHash`](../examples/node/payway-hash.md) using your API key
(an optional field you do not send contributes an empty string):

1. `request_time`
2. `merchant_id`
3. `tran_id`
4. `amount`
5. `currency`
6. `items`
7. `ctid`
8. `pwt`
9. `first_name`
10. `last_name`
11. `email`
12. `phone`
13. `purchase_type`
14. `callback_url`
15. `custom_fields`
16. `return_params`
17. `payout`
18. `token_flag`
19. `shipping_fee`

> `amount` and `shipping_fee` are JSON numbers. How a number is written into the hash string (for example `4.5` or `4.50`) is not documented on the portal — confirm with PayWay team. The examples hash the exact text they send.

## Request fields

| Name | Type | Required | Rules / Description |
|---|---|---|---|
| `request_time` | string | Yes | Request date and time in UTC, `YYYYMMDDHHmmss`. |
| `merchant_id` | string(20) | Yes | Merchant key provided by ABA Bank. |
| `tran_id` | string(20) | Yes | Unique transaction ID for the payment. |
| `ctid` | string(24) | Yes | Your consumer identification number. |
| `pwt` | string | Yes | PayWay Token from the token callback / [Get token details](cof-get-token-details.md). |
| `first_name` | string(20) | No | Buyer's first name. |
| `last_name` | string(20) | No | Buyer's last name. |
| `email` | string(50) | No | Buyer's email. |
| `phone` | string(20) | No | Buyer's phone. |
| `amount` | number | Yes | Total purchase amount, excluding shipping. KHR: at least 100. USD: at least 0.01. |
| `shipping_fee` | number | No | Shipping fee. |
| `currency` | string | Yes | `KHR` or `USD`; must be enabled on your profile. |
| `token_flag` | string | Yes | `CITU_FLEX`, `MITU_FLEX` or `MITR_FIX`; must be enabled on your profile. |
| `purchase_type` | string | No | `purchase` (default) or `pre-auth`. |
| `callback_url` | string | No | Where the payment result is sent. Base64-encoded. If omitted, the default in your API settings is used; a custom domain must be whitelisted. |
| `items` | string(500) | No | Base64 JSON array of items (`name`, `quantity`, `price`), up to 50 lines. |
| `return_params` | string(500) | No | Extra data returned to you after payment. |
| `payout` | string(500) | No | Base64 JSON array of payouts, e.g. `[{"acc":"000133879","amt":1}]`. |
| `custom_fields` | string(500) | No | Base64 JSON shown in transaction details, lists and exports. |
| `hash` | string | Yes | Base64 HMAC-SHA512, see above. |

Which `token_flag` to send depends on how the token was linked
([Unschedule Payment](https://developer.payway.com.kh/unschedule-payment-2038908m0),
[Schedule Payment](https://developer.payway.com.kh/schedule-payment-2038907m0)):

| Token linked as | Send `token_flag` |
|---|---|
| `CITI_FLEX` | `CITU_FLEX` (customer present) |
| `CITO_FLEX` | `MITU_FLEX` (merchant-initiated, on demand) |
| `CITR_FIX` | `MITR_FIX` (scheduled, fixed amount) |

## Response

```json
{
  "status": {
    "code": "00",
    "message": "Success.",
    "trace_id": "d79f472376737a997f6ea66d0d8eb045"
  }
}
```

| Name | Type | Description |
|---|---|---|
| `status.code` | string | `00` = request accepted. See Errors. |
| `status.message` | string | Message for `code`. |
| `status.trace_id` | string | Log ID for debugging. |

**Payment callback** (posted to `callback_url`, JSON), from the
[Unschedule Payment guide](https://developer.payway.com.kh/unschedule-payment-2038908m0):

```json
{
  "tran_id": "6605586317",
  "apv": "541181",
  "status": 0
}
```

| Name | Type | Description |
|---|---|---|
| `tran_id` | string | Transaction ID sent in the payment request. |
| `apv` | string | Approval code. |
| `status` | number | Payment status. |

The guide says a hash signature is sent in a request header and gives a PHP sample (sort fields by
key, concatenate values, HMAC-SHA512, Base64). The callback should arrive within 3 seconds; if not,
use [Check transaction](checkout-check-transaction.md).

> The header name and the key for the callback signature are not stated on the Unschedule Payment page (the sample's parameter is called `$publicKey`), and the meaning of each `status` value is not listed. Not documented on the portal — confirm with PayWay team.

## Errors

| Code | Meaning | What to do |
|---|---|---|
| `00` | Success | Wait for the callback, then confirm with Check transaction. |
| `01` | Wrong Hash | Check field order and API key. |
| `04` | The given data was invalid (HTTP 400; details in `status.errors`) | Fix the fields listed in `errors`. |
| `98` | Merchant id not found | Check `merchant_id` / environment. |

## Pitfalls

- `status.code` `00` only means the request was accepted, not that the customer was charged. Confirm with [Check transaction](checkout-check-transaction.md) using your own `tran_id`, and compare the amount with your order.
- Expired, frozen or removed tokens are declined. Check the token with [Get token details](cof-get-token-details.md) and ask the customer to renew if needed.
- A `CITI_FLEX` token cannot be used for merchant-initiated charges; link with `CITO_FLEX` for that.
- The page description lists the supported token types as `CITI_FLEX`, `CITO_FLEX` and `CITR_FIX` (the linking flags), while `token_flag` takes `CITU_FLEX`, `MITU_FLEX` and `MITR_FIX` — send the latter.
- The portal's request example also contains `return_deeplink`, which is not in the field list or hash. Not documented on the portal — confirm with PayWay team.
