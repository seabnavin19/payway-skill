---
id: payout-update-beneficiary-status
type: api
title: Update a beneficiary status
summary: Disables or re-enables a whitelisted payout beneficiary.
service: payouts/split-payment
source: https://developer.payway.com.kh/update-a-beneficiary-status-14530817e0
status: draft
verified_by:
verified_on:
related: [security, split-payment, beneficiary-payout, payout-add-beneficiary]
---

# Update a beneficiary status

Toggles a whitelisted beneficiary between active and inactive. From the portal, use it:

- To prevent a whitelisted beneficiary from receiving future funds or from being used in payout instructions.
- To resume a previously disabled beneficiary so they can start receiving funds again or be used in payout instructions.

The beneficiary must already be on the list ([Add a beneficiary to whitelist](payout-add-beneficiary.md)).

## Endpoint

| | Sandbox | Production |
|---|---|---|
| Method | `POST` | `POST` |
| URL | `https://checkout-sandbox.payway.com.kh/api/merchant-portal/merchant-access/whitelist-account/update-whitelist-status` | `https://checkout.payway.com.kh/api/merchant-portal/merchant-access/whitelist-account/update-whitelist-status` |
| Content-Type | `application/json` | |

Production base URL is from the portal's [API Endpoints](https://developer.payway.com.kh/api-endpoints-984508m0) page.

## Authentication & hash

Fields concatenated **in this exact order**, then signed with
[`paywayHash`](../examples/node/payway-hash.md) using your API key (Base64 of the raw HMAC-SHA512):

1. `request_time`
2. `merchant_auth`

`merchant_auth` is hashed in its final encrypted, Base64 form, and is encrypted exactly as for
[Add a beneficiary to whitelist](payout-add-beneficiary.md#authentication-hash) (117-byte chunks,
RSA public key from ABA Bank, Base64).

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
| `status` | int | Yes | `0` to disable the beneficiary, `1` to activate it. |

Request example from the portal:

```json
{
  "request_time": "20200728093403",
  "merchant_id": "ec000002",
  "merchant_auth": "39aaa43.....0c00a",
  "hash": "EVDFA2118UD0boKhkAcOb...+5KCCt+sWw=="
}
```

## Response

> The portal gives no response example for this endpoint; the fields below are from its response schema.

| Name | Type | Description |
|---|---|---|
| `data.name` | string | Beneficiary name: the outlet name for a MID, the account holder's name for an account. |
| `data.payee` | string(250) | The destination beneficiary: MID or ABA account number. |
| `data.currency` | string | The merchant's currency for a MID, the account currency for an ABA account holder. |
| `data.type` | string(20) | `Merchant` for a MID, `ABA Account` for an account holder. |
| `data.status` | integer | `1` Active, `0` Inactive. |
| `data.created_at` | string | Date and time the beneficiary was added to the list. |
| `status.code` | string | See Errors. |
| `status.message` | string | Message for `code`. |

## Errors

| Code | Meaning | What to do |
|---|---|---|
| `00` | Success! | Read `data.status` for the new state. |
| `PTL02` | Wrong hash | Hash `request_time` then `merchant_auth`, Base64 of the raw HMAC. |
| `PTL04` | Parameter validation required | Send all four fields, and `status` inside `merchant_auth`. |
| `PTL46` | Merchant not found | Check `merchant_id` / `mc_id`. |
| `PTL149` | Invalid whitelist account | The payee is not on your whitelist; add it first. |
| `PTL150` | Business profile is not found | Contact PayWay. |

## Pitfalls

- `status` is an integer inside `merchant_auth` (`0` / `1`), not a top-level field.
- Disable a beneficiary as soon as your relationship with them ends (seller off-boarded, account changed), so a stale record in your system cannot route money to them.
- Whether disabling affects split instructions already attached to unpaid QR codes or payment links is not documented on the portal — confirm with PayWay team.
