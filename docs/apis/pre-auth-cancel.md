---
id: pre-auth-cancel
type: api
title: Cancel pre-purchase transaction
summary: Releases a pre-authorization hold so the customer's funds are returned.
service: hold-payments/pre-auth-capture
source: https://developer.payway.com.kh/cancel-pre-purchase-transaction-14530836e0
status: draft
verified_by:
verified_on:
related: [security, pre-auth-capture, pre-auth-complete]
---

# Cancel pre-purchase transaction

Call this from your server when you will not charge a held transaction (booking cancelled, deposit
returned). Notes from the portal:

- You can only cancel a pre-auth that is still pending; a completed or already-cancelled pre-auth cannot be cancelled.
- Each pre-auth can be cancelled only once.
- After a successful cancellation the transaction status becomes `CANCELLED`.
- ABA PAY and card holds are released to the payer instantly; KHQR payments are refunded to the payer.

## Endpoint

| | Sandbox | Production |
|---|---|---|
| Method | `POST` | `POST` |
| URL | `https://checkout-sandbox.payway.com.kh/api/merchant-portal/merchant-access/online-transaction/pre-auth-cancellation` | `https://checkout.payway.com.kh/api/merchant-portal/merchant-access/online-transaction/pre-auth-cancellation` |
| Content-Type | `application/json` | |

Production base URL is from the portal's [API Endpoints](https://developer.payway.com.kh/api-endpoints-984508m0) page.

## Authentication & hash

Fields concatenated **in this exact order**, then signed with
[`paywayHash`](../examples/node/payway-hash.md) using your API key:

1. `merchant_id`
2. `merchant_auth`
3. `request_time`

`merchant_auth` is encrypted exactly as for [Complete pre-auth transactions](pre-auth-complete.md#authentication-hash)
(117-byte chunks, RSA public key from ABA Bank, Base64) and hashed in that final form.

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
| `tran_id` | string | Yes | The pre-auth purchase transaction ID to cancel. |

## Response

> The portal gives no response example for this endpoint; the fields below are from its response schema.

| Name | Type | Description |
|---|---|---|
| `grand_total` | number | The original amount authorized for the pre-auth. |
| `currency` | string | Original transaction currency. |
| `transaction_status` | string | `CANCELLED` after a successful cancellation. |
| `status.code` | string | See Errors. |
| `status.message` | string | Message for `code`. |

## Errors

| Code | Meaning | What to do |
|---|---|---|
| `00` | Success! | Check `transaction_status` is `CANCELLED`. |
| `PTL02` | Invalid hash provided | Check field order (`merchant_id`, `merchant_auth`, `request_time`) and API key. |
| `PTL04` | Parameter validation failed | Verify all required fields are correctly formatted. |
| `PTL06` | The request has expired | Generate a new request and retry. |
| `PTL36` | Invalid transaction | Check `tran_id`. |
| `PTL62` | Invalid merchant information | Check `merchant_id` / `mc_id`. |
| `PTL63` | Merchant does not have a security configuration file | Contact support. |
| `PTL59` | Unable to complete or cancel Pre-auth | Check the transaction status before retrying. |
| `PTL60` | Pre-auth amount exceeds the allowed limit | Reduce the amount and try again. |
| `PTL61` | Invalid action type | Use a valid operation type. |
| `PTL157` | An unexpected error occurred | Retry later or contact PayWay digital support. |
| `PTL168` | Concurrent requests are not allowed | Wait a few seconds and retry. |
| `PTL169` | The merchant profile cannot accept payments. Settlement account is closed | Contact PayWay. |
| `USD-NOT-ALLOW` | The requested amount is not permitted | Choose a valid amount. |
| `KHR-LESS-100` | KHR amount must be greater than 100 KHR | Raise the amount. |
| `KHR-CONTAIN-DECIMAL` | Amount for KHR currency must be a whole number | Send whole KHR amounts. |

## Pitfalls

- The hash order here is `merchant_id`, `merchant_auth`, `request_time` — not the same as Complete.
- Cancel and Complete are mutually exclusive and one-shot: lock the booking on your side so a cancel and a capture cannot run at the same time.
- Unhandled pre-auths are cancelled automatically after 30 days (default), per the [Pre-auth guide](https://developer.payway.com.kh/pre-auth-3158156f0).
