---
id: payout-payout
type: api
title: Payout
summary: Sends money from your settlement account to up to 10 whitelisted beneficiaries in one request.
service: payouts/beneficiary-payout
source: https://developer.payway.com.kh/payout-14530816e0
status: draft
verified_by:
verified_on:
related: [security, beneficiary-payout, payout-add-beneficiary, payout-update-beneficiary-status]
---

# Payout

The portal describes this as the "ABA PayWay Funds Route API": it distributes funds from your
settlement account to third parties, sellers, service providers, or your ABA bank accounts. Every
beneficiary must first be added with [Add a beneficiary to whitelist](payout-add-beneficiary.md).
The result comes back in the response; no callback is documented.

## Endpoint

| | Sandbox | Production |
|---|---|---|
| Method | `POST` | `POST` |
| URL | `https://checkout-sandbox.payway.com.kh/api/payment-gateway/v2/direct-payment/merchant/payout` | `https://checkout.payway.com.kh/api/payment-gateway/v2/direct-payment/merchant/payout` |
| Content-Type | `application/json` | |

Production base URL is from the portal's [API Endpoints](https://developer.payway.com.kh/api-endpoints-984508m0) page.

## Authentication & hash

Fields concatenated **in this exact order**, then HMAC-SHA512 signed with your API key:

1. `merchant_id`
2. `tran_id`
3. `beneficiaries`
4. `amount`
5. `custom_fields`
6. `currency`

`beneficiaries` is hashed in its final encrypted, Base64 form. A `custom_fields` you don't send is hashed as `''`.

> **Hex, not Base64.** The portal's PHP sample is `hash_hmac('sha512', $b4Hash, $api_key)` with no
> `base64_encode`, which outputs a lowercase hex digest, and the request example's hash
> (`3c70c551a...d1092f6e22228a7686c51bc1162a...`) is hex. Every other PayWay API in these docs uses
> Base64, so [`paywayHash`](../examples/node/payway-hash.md) does **not** fit here as is; the examples
> compute the hex digest directly. Not documented on the portal beyond the sample — confirm with PayWay team.

> How the JSON-number `amount` is written into the hash string is not documented on the portal — confirm with PayWay team. The PHP sample concatenates the number as is (`3.44` → `"3.44"`); the examples hash the same text they send.

**`beneficiaries` encryption.** JSON-encode the beneficiary list, split it into chunks of
117 bytes, encrypt each chunk with the **RSA public key provided by ABA Bank** (PHP
`openssl_public_encrypt`, default padding), concatenate and Base64-encode. The portal's sample:

```php
$beneficiaries_info = json_encode([
    ['account' => '200030000', 'amount' => 100],
    ['account' => '012538302', 'amount' => 200],
]);
```

> The RSA padding mode is not named on the portal; PHP's `openssl_public_encrypt` default is PKCS#1 v1.5. Not documented on the portal — confirm with PayWay team.

## Request fields

| Name | Type | Required | Rules / Description |
|---|---|---|---|
| `merchant_id` | string(255) | Yes | Merchant key provided by ABA Bank. |
| `tran_id` | string(20) | Yes | Unique transaction ID. |
| `beneficiaries` | string(1000) | Yes | RSA-encrypted, Base64 JSON list of `{"account": <ABA account or MID>, "amount": <number>}`. The sample comment: "You can use mixed MID and Account in beneficiary, make sure all of them has the same currency as transaction currency." |
| `amount` | number (float) | Yes | Total payout amount (sum of all beneficiary amounts). `KHR`: at least 100 KHR. `USD`: at least 0.01 USD. |
| `currency` | string(3) | Yes | `KHR` or `USD`. |
| `custom_fields` | string(255) | No | Additional information as a JSON string, associated with the payment transaction, e.g. `{"Invoice_ID":"INV-1234","Province":"Phnom Penh"}`. |
| `hash` | string(512) | Yes | HMAC-SHA512, see above. |

Request example from the portal:

```json
{
  "merchant_id": "EC0001",
  "tran_id": "A17259584044451",
  "beneficiaries": "ElKjECTZK7ym...NX0Dt2dz...",
  "amount": 3.44,
  "currency": "USD",
  "custom_fields": "{\"timestamp\":\"2024-08-23 10:35:55.437\",\"traceId\":\"63f9645fa3bd8678907ed4c038357385\"}",
  "hash": "3c70c551a...d1092f6e22228a7686c51bc1162a..."
}
```

## Response

Success:

```json
{
  "transaction_id": "172595840773178",
  "transaction_date": "2024-09-10T15:53:27.2157019+07:00",
  "external_reference": "100FT30147412155",
  "apv": "328097",
  "transaction_amount": 3.44,
  "transaction_currency": "USD",
  "beneficiaries": [
    { "payout_id": "172595842687056", "name": "", "mid_acccount": "200030000", "amount": 1.72, "currency": "USD" },
    { "payout_id": "172595842679750", "name": "", "mid_acccount": "012538302", "amount": 1.72, "currency": "USD" }
  ],
  "status": {
    "code": "0",
    "message": "Success!",
    "tran_id": "172595840773178",
    "trace_id": "e728bf3e95e32e3c97286fc9f8aef82d"
  }
}
```

Exception:

```json
{
  "status": {
    "code": "83",
    "message": "Transaction is duplicated",
    "tran_id": "172595840773178",
    "trace_id": "e728bf3e95e32e3c97286fc9f8aef82d"
  }
}
```

| Name | Type | Description |
|---|---|---|
| `transaction_id` | string | Unique transaction ID passed from the merchant. |
| `transaction_date` | string | Approved date and time of the transaction. |
| `external_reference` | string | Unique booking entry reference from the core banking system. |
| `apv` | string | Random 6-digit number generated by the payment gateway. |
| `transaction_amount` | number | Total transaction amount. |
| `transaction_currency` | string | Transaction currency. |
| `beneficiaries[].payout_id` | string | Unique ID generated by the payment gateway. |
| `beneficiaries[].name` | string | Beneficiary name. |
| `beneficiaries[].mid_acccount` | string | Beneficiary identifier: MID or ABA account. (Spelled with three `c`s on the portal.) |
| `beneficiaries[].amount` | number | Payout amount. |
| `beneficiaries[].currency` | string | Payout currency; follows the transaction currency. |
| `status.code` | string | See Errors. |
| `status.message` | string | Message for `code`. |
| `status.tran_id` | string | Unique transaction ID passed from the merchant. |
| `status.trace_id` | string | Gateway trace ID; quote it to PayWay when reporting an error. |

> `transaction_id` and `status.tran_id` are described as "pass from merchant", yet the portal's examples show `172595840773178` for a request `tran_id` of `A17259584044451`. Which value comes back is not documented on the portal — confirm with PayWay team. The examples do not rely on it.

## Errors

| Code | Meaning | What to do |
|---|---|---|
| `0` | Success | Record the payout as paid. |
| `4` | Duplicated Transaction ID | This `tran_id` was already used: reconcile, don't resend under a new `tran_id`. |
| `11` | Something went wrong. Try again or contact the merchant for help | Reconcile before any retry. |
| `24` | Can not decrypt data | Check the RSA public key and chunked encryption of `beneficiaries`. |
| `25` | Allow maximum 10 beneficiaries per requests | Split into several payouts. |
| `26` | Invalid Merchant Profile | Check `merchant_id`. |
| `36` | Payout account or amount is invalid | Check each `account` and `amount`. |
| `37` | Payout accounts are not in whitelist | [Whitelist](payout-add-beneficiary.md) the account first. |
| `44` | Purchase amount has reached transaction limit | Lower the amount or contact PayWay. |
| `48` | Something went wrong with requested parameters. Please try again or contact the merchant for help | Check the request fields. |
| `70` | Total purchase amount has reached daily limit. Please use difference account | Wait or contact PayWay. |
| `79` | Payment Rejected! | Contact PayWay. |
| `80` | Custom fields invalid | Send `custom_fields` as a JSON string, max 255. |
| `81` | The total amount must be greater than 0. Please double check and try again. | Fix `amount`. |
| `82` | Invalid transaction currency. We only support USD or KHR. Please double check and try again. | Fix `currency`. |
| `83` | Transaction is duplicated. | Same as `4`. |
| `84` | Unable to access the merchant's account details. Please verify that your settlement account is still active. | Check your settlement account with PayWay. |
| `85` | Transaction currency does not match the merchant's currency. Please review your details. | Use your merchant currency. |
| `86` | Unable to debit the merchant's account. | Check your balance / contact PayWay. |
| `87` | Unable to retrieve the beneficiary's account details. | Check the account. |
| `88` | Unable to retrieve the beneficiary's MID details. | Check the MID. |
| `89` | Unable to retrieve the beneficiary's account details. | Check the account. |
| `90` | The currencies for the merchant and beneficiary do not align. Please review your details. | Use beneficiaries in your merchant currency. |
| `91` | Unable to credit the beneficiary's account. | Reconcile with PayWay before any retry. |
| `92` | The total payout amount does not match the total transaction amount. Please review your details. | Make `amount` the exact sum of the beneficiary amounts. |
| `93` | Insufficient balance. | Top up your settlement account. |
| `400` | Bad request | Check the request format. |
| `LAM01` | Total purchase amount has reached daily limit. Please use difference account | Wait or contact PayWay. |
| `LAM02` | Total purchase amount has reached monthly limit. Please use difference account | Wait or contact PayWay. |

## Pitfalls

- The hash order is `merchant_id`, `tran_id`, `beneficiaries`, `amount`, `custom_fields`, `currency` — no request time — and the PHP sample outputs **hex**, not Base64.
- Beneficiary keys here are `account` / `amount`; the Purchase `payout` field uses `acc` / `amt`.
- `amount` must equal the sum of the beneficiary amounts (code `92`); work in minor units to avoid rounding drift.
- This moves money out of your settlement account. Build the beneficiary list and amounts only from your own records, send each payout once (`tran_id` = your payout record ID), and never auto-retry an unclear result under a new `tran_id`.
- No API to query a payout's status afterwards is documented on the portal — confirm with PayWay team. Keep `external_reference`, `payout_id`s and `trace_id` for reconciliation.
