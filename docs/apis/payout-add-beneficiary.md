---
id: payout-add-beneficiary
type: api
title: Add a beneficiary to whitelist
summary: Adds an ABA account or ABA merchant (MID) to your payout whitelist so it can receive split payments and payouts.
service: payouts/split-payment
source: https://developer.payway.com.kh/add-a-beneficiary-to-whitelist-14530818e0
status: draft
verified_by:
verified_on:
related: [security, split-payment, beneficiary-payout, payout-payout, payout-update-beneficiary-status]
---

# Add a beneficiary to whitelist

Call this once per beneficiary, before you name them in any `payout` instruction (Split & Payout) or
in a [Payout](payout-payout.md) request. The portal's Payout guide says a beneficiary is
automatically **enabled** once added. A beneficiary must be an **ABA account holder** (you need
their ABA account) or an **ABA merchant** (you need their MID). To disable one later, use
[Update a beneficiary status](payout-update-beneficiary-status.md).

## Endpoint

| | Sandbox | Production |
|---|---|---|
| Method | `POST` | `POST` |
| URL | `https://checkout-sandbox.payway.com.kh/api/merchant-portal/merchant-access/whitelist-account/add-whitelist-payout` | `https://checkout.payway.com.kh/api/merchant-portal/merchant-access/whitelist-account/add-whitelist-payout` |
| Content-Type | `application/json` | |

Production base URL is from the portal's [API Endpoints](https://developer.payway.com.kh/api-endpoints-984508m0) page.

## Authentication & hash

Fields concatenated **in this exact order**, then signed with
[`paywayHash`](../examples/node/payway-hash.md) using your API key (Base64 of the raw HMAC-SHA512):

1. `request_time`
2. `merchant_auth`

`merchant_auth` is hashed in its final encrypted, Base64 form. `merchant_id` is not part of the hash.

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
| `payee` | string | Yes | Beneficiary identifier: a MID or an ABA account. |

Request example from the portal:

```json
{
  "request_time": "20200728093403",
  "merchant_id": "ec000002",
  "merchant_auth": "39aaa43...c00a",
  "hash": "EVDFA21....t+sWw=="
}
```

## Response

> The portal gives no response example for this endpoint; the fields below are from its response schema.

| Name | Type | Description |
|---|---|---|
| `data.name` | string(255) | Beneficiary name: the outlet name for a MID, the account holder's name for an account. |
| `data.payee` | string(250) | The destination beneficiary: MID or ABA account number. |
| `data.currency` | string(10) | The merchant's currency for a MID, the account currency for an ABA account holder. |
| `data.type` | string(20) | `Merchant` for a MID, `ABA Account` for an account holder. |
| `data.status` | integer | `1` Active, `0` Inactive. |
| `data.created_at` | string | Date and time the beneficiary was added to the list. |
| `status.code` | string | See Errors. |
| `status.message` | string | Message for `code`. |

## Errors

| Code | Meaning | What to do |
|---|---|---|
| `PTL02` | Wrong hash | Hash `request_time` then `merchant_auth`, Base64 of the raw HMAC. |
| `PTL04` | Parameter validation required | Send all four fields. |
| `PTL25` | Invalid account class | The account cannot be a beneficiary; ask the beneficiary for another account. |
| `PTL99` | Merchant invalid currency | Contact PayWay. |
| `PTL134` | Account not found | Check the account number. |
| `PTL146` | Payee is invalid | Check the MID or account. |
| `PTL147` | Currency of the payee does not the same as merchant currency | Use a beneficiary account in your merchant currency. |
| `PTL148` | Payee already exist | Already on your whitelist, but it may be inactive; see [Update a beneficiary status](payout-update-beneficiary-status.md). |
| `PTL150` | Business profile is not found | Contact PayWay. |
| `PTL151` | Failed to whitelist account | Retry later or contact PayWay. |

> The portal lists no success code for this endpoint (the sibling Update a beneficiary status lists `00`). Not documented on the portal — confirm with PayWay team. The examples treat the call as successful only when the response contains `data` with `status` `1` (Active), or the code is `PTL148` (already listed). An already-listed payee may be inactive, in which case Purchase rejects the payout (code `42`: Payout info contain account invalid status).

## Pitfalls

- The hash is only `request_time` + `merchant_auth`, and it is Base64 of the raw HMAC — unlike [Payout](payout-payout.md), whose PHP sample produces a hex digest.
- `payee` goes inside the encrypted `merchant_auth`, not as a top-level field.
- Whitelisting decides who can receive your money. Call it only from a staff-authorized back office, with the account taken from your own beneficiary records — never from a customer-facing request.
- The beneficiary's currency must match your merchant currency (`PTL147`).
