---
id: pre-auth-complete-with-payout
type: api
title: Complete pre-auh transaction with payout
summary: Captures a pre-authorized transaction and splits the captured amount among payout accounts.
service: hold-payments/pre-auth-capture
source: https://developer.payway.com.kh/complete-pre-auh-transaction-with-payout-14666701e0
status: draft
verified_by:
verified_on:
related: [security, pre-auth-capture, pre-auth-complete, pre-auth-cancel]
---

# Complete pre-auth transaction with payout

The portal's title is spelled "pre-auh". Same endpoint, hash and response as
[Complete pre-auth transactions](pre-auth-complete.md), with an extra `payout` list inside
`merchant_auth` that says how the captured money is distributed. Same conditions: one completion per
pre-auth, not on expired or cancelled pre-auths, cards up to +10% of the original amount.

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
| `tran_id` | string | Yes | The pre-auth purchase transaction ID to complete. |
| `complete_amount` | decimal | Yes | Amount to complete. |
| `payout` | string | Yes | Payout instruction. The PHP sample passes a list of `{"acc": <ABA account or MID>, "amt": <amount>}` objects. |

> `payout` is typed `string` but the PHP sample sends a JSON array (not Base64, unlike `payout` in Purchase). Not documented on the portal — confirm with PayWay team. Payout accounts generally have to be whitelisted first ([Add a beneficiary to whitelist](payout-add-beneficiary.md)).

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

Same codes as [Complete pre-auth transactions](pre-auth-complete.md#errors): `00`, `PTL02`, `PTL04`,
`PTL06`, `PTL36`, `PTL62`, `PTL63`, `PTL59`, `PTL60`, `PTL61`, `PTL153`, `PTL157`, `PTL168`,
`PTL169`, `USD-NOT-ALLOW`, `KHR-LESS-100`, `KHR-CONTAIN-DECIMAL`.

## Pitfalls

- The payout amounts should add up to `complete_amount`. Not documented on the portal — confirm with PayWay team.
- Compute payout amounts on your server; never accept accounts or amounts from the browser.
- Only one completion per pre-auth, so the payout split cannot be changed afterwards.
- The hash order is `merchant_auth`, `request_time`, `merchant_id`.
