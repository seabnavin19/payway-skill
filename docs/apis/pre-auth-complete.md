---
id: pre-auth-complete
type: api
title: Complete pre-auth transactions
summary: Captures a pre-authorized (held) transaction for the final amount.
service: hold-payments/pre-auth-capture
source: https://developer.payway.com.kh/complete-pre-auth-transactions-14530835e0
status: draft
verified_by:
verified_on:
related: [security, pre-auth-capture, pre-auth-cancel, pre-auth-complete-with-payout, checkout-purchase]
---

# Complete pre-auth transactions

Call this from your server when the service is delivered (check-out, car returned) to charge the
customer for the final amount of a held transaction created with [Purchase](checkout-purchase.md)
`type` `pre-auth`. To release the hold instead, use [Cancel pre-purchase transaction](pre-auth-cancel.md).
To split the captured money, use [Complete pre-auth transaction with payout](pre-auth-complete-with-payout.md).

Conditions from the portal:

- You can only complete a pre-auth once.
- Expired or cancelled pre-auths cannot be completed.
- For card payments you can complete up to 10% above the original pre-auth amount.

## Endpoint

| | Sandbox | Production |
|---|---|---|
| Method | `POST` | `POST` |
| URL | `https://checkout-sandbox.payway.com.kh/api/merchant-portal/merchant-access/online-transaction/pre-auth-completion` | `https://checkout.payway.com.kh/api/merchant-portal/merchant-access/online-transaction/pre-auth-completion` |
| Content-Type | `application/json` | |

Production base URL is from the portal's [API Endpoints](https://developer.payway.com.kh/api-endpoints-984508m0) page.

## Authentication & hash

Fields concatenated **in this exact order**, then signed with
[`paywayHash`](../examples/node/payway-hash.md) using your API key:

1. `merchant_auth`
2. `request_time`
3. `merchant_id`

`merchant_auth` is hashed in its final encrypted, Base64 form.

**`merchant_auth` encryption.** JSON-encode the object below, split the JSON into chunks of
117 bytes, encrypt each chunk with the **RSA public key provided by ABA Bank** (PHP
`openssl_public_encrypt`, default padding), concatenate the encrypted chunks and Base64-encode the result.

> The RSA padding mode is not named on the portal; PHP's `openssl_public_encrypt` default is PKCS#1 v1.5. Not documented on the portal — confirm with PayWay team.

## Request fields

| Name | Type | Required | Rules / Description |
|---|---|---|---|
| `request_time` | string | Yes | Request date and time in UTC, `YYYYMMDDHHmmss`. |
| `merchant_id` | string(20) | Yes | Merchant key provided by ABA Bank. |
| `merchant_auth` | string | Yes | RSA-encrypted, Base64 JSON object (fields below). |
| `hash` | string | Yes | Base64 HMAC-SHA512, see above. |

Fields inside `merchant_auth`:

| Name | Type | Required | Rules / Description |
|---|---|---|---|
| `mc_id` | string | Yes | Merchant key provided by ABA Bank; same value as `merchant_id`. |
| `tran_id` | string | Yes | The pre-auth purchase transaction ID to complete. |
| `complete_amount` | decimal | Yes | Amount to complete. |

> Whether `complete_amount` is sent as a JSON number or a string is not documented on the portal — confirm with PayWay team. The examples send a JSON number.

## Response

> The portal gives no response example for this endpoint; the fields below are from its response schema.

| Name | Type | Description |
|---|---|---|
| `grand_total` | number | The original amount authorized for the pre-auth. |
| `currency` | string(3) | Original transaction currency. |
| `transaction_status` | string | `COMPLETED` once successfully completed. |
| `status.code` | string | See Errors. |
| `status.message` | string | Message for `code`. |

## Errors

| Code | Meaning | What to do |
|---|---|---|
| `00` | Transaction successful | Check `transaction_status` is `COMPLETED`. |
| `PTL02` | Invalid hash value | Check field order (`merchant_auth`, `request_time`, `merchant_id`) and API key. |
| `PTL04` | Parameter validation failed | Check the fields. |
| `PTL06` | The request has expired | Send a fresh `request_time`. |
| `PTL36` | Invalid transaction | Check `tran_id`. |
| `PTL62` | Merchant information is invalid | Check `merchant_id` / `mc_id`. |
| `PTL63` | The merchant does not have a security configuration file | Contact PayWay. |
| `PTL59` | Unable to complete or cancel the pre-authorization | Check the status with Check transaction; it may be completed, cancelled or expired. |
| `PTL60` | Pre-authorization completion amount exceeds the authorized limit | Lower `complete_amount`. |
| `PTL61` | Invalid action type | Contact PayWay. |
| `PTL153` | Completing pre-authorization fees for a merchant with multiple settlement accounts is not allowed | Contact PayWay. |
| `PTL157` | An unexpected error occurred | Retry later or contact PayWay digital support. |
| `PTL168` | Concurrent requests are not allowed for this operation | Retry in a few seconds. |
| `PTL169` | The merchant profile cannot accept payments because the settlement account is closed | Contact PayWay. |
| `USD-NOT-ALLOW` | The requested amount is not allowed for USD transactions | Check the amount. |
| `KHR-LESS-100` | The transaction amount in KHR must be at least 100 KHR | Raise the amount. |
| `KHR-CONTAIN-DECIMAL` | KHR transaction amounts cannot contain decimal places | Send whole KHR amounts. |

## Pitfalls

- The hash order is `merchant_auth`, `request_time`, `merchant_id` — different from Cancel (`merchant_id`, `merchant_auth`, `request_time`).
- Only one completion per pre-auth: guard against double-clicks and retries on your side.
- A pre-auth that is neither completed nor cancelled within 30 days (default) is cancelled automatically and the funds go back to the payer ([Pre-auth guide](https://developer.payway.com.kh/pre-auth-3158156f0)).
- Before completing, confirm the hold with [Check transaction](checkout-check-transaction.md): `payment_status` `PRE-AUTH` and the amount you expect.
- Compute `complete_amount` on your server from the final bill; the +10% allowance applies to cards only.
