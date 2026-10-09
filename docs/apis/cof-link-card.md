---
id: cof-link-card
type: api
title: Link Card
summary: Returns a PayWay-hosted HTML page where the customer enters card details to save the card as a token.
service: auto-payments/tokenization
source: https://developer.payway.com.kh/link-card-19336819e0
status: draft
verified_by:
verified_on:
related: [security, tokenization, cof-get-token-details, cof-payment]
---

# Link Card

Use this when the customer chooses "Add/Link New Card". PayWay responds with an HTML page you render
in an iframe; the customer types the card number, expiry and CVV **directly into PayWay's page**, so
card data never touches your server. PayWay then posts the token (`pwt`) and masked card number to
your `callback_url`. Supports Visa, Mastercard, JCB and UPI. Part of
[Tokenization](../services/auto-payments/tokenization.md).

## Endpoint

| | Sandbox | Production |
|---|---|---|
| Method | `POST` | `POST` |
| URL | `https://checkout-sandbox.payway.com.kh/api/payment-credential/v3/cof/link-card` | `https://checkout.payway.com.kh/api/payment-credential/v3/cof/link-card` |
| Content-Type | `multipart/form-data` | |

Production base URL is from the portal's [API Endpoints](https://developer.payway.com.kh/api-endpoints-984508m0) page.
The portal's guide posts this as an HTML form (`target="aba_webservice"`) from the browser, with the
hash computed on your server, using PayWay's `checkout-popup.html?file=js` script and `AbaPayway.addCard()`.

## Authentication & hash

Fields concatenated **in this exact order**, then signed with
[`paywayHash`](../examples/node/payway-hash.md) using your API key:

1. `merchant_id`
2. `request_time`
3. `ctid`
4. `callback_url`
5. `request_id`
6. `token_flag`
7. `frequency`
8. `amount`
9. `currency`
10. `continue_success_url`

> `frequency` and `amount` appear in the portal's hash sample but are not request fields on this page. The examples hash them as empty strings. Not documented on the portal — confirm with PayWay team.

## Request fields

| Name | Type | Required | Rules / Description |
|---|---|---|---|
| `request_id` | string | Yes | Your request ID, unique on your side. Used later to get the token details (only the last record is returned). 5–24 letters and digits, no spaces or special characters. |
| `request_time` | string | Yes | Request date and time in UTC, `YYYYMMDDHHmmss`. |
| `merchant_id` | string(20) | Yes | Merchant key provided by ABA Bank. |
| `ctid` | string | Yes | Your consumer identification number. 5–24 letters and digits, no spaces or special characters. |
| `token_flag` | string | Yes | `CITI_FLEX` or `CITO_FLEX`. The flag must be enabled on your profile. |
| `currency` | string | Yes | `KHR` or `USD`, based on your merchant profile. |
| `callback_url` | string | No | Where the token details are sent. Base64-encoded. If empty, the `pushback_url` in your profile is used. The domain must be whitelisted. |
| `continue_success_url` | string | No | URL behind the **Done** button on the success screen. Base64-encoded. |
| `hash` | string | Yes | Base64 HMAC-SHA512, see above. |

> The portal's sample form also sends a `return_param` field that is not listed in the request schema or hash. Not documented on the portal — confirm with PayWay team.

## Response

`200 text/html`: whether the request succeeds or fails, PayWay returns an HTML page to render in an
iframe. On error the page shows an error message; on success it shows the saved-card form.

The token callback has the same format as for [Link Account](cof-link-account.md#response)
(`request_id` and `payment_credential`), with `type` `Visa`, `MC`, `CUP` or `JCB`.

## Errors

> Error codes for this endpoint are not documented on the portal (errors are shown inside the returned HTML page) — confirm with PayWay team.

## Pitfalls

- Never collect card numbers in your own form; the customer must type them into PayWay's hosted page.
- The response is HTML, not JSON — render it, don't parse it.
- The callback is not signed according to the portal. Fetch the token with [Get token details](cof-get-token-details.md) using your own stored `request_id` instead of trusting the callback body.
- When Card on File is enabled, the normal checkout page also shows a "Save Card for Future Use" checkbox, and tokens from it arrive at the same `callback_url` — handle that callback too.
- Compute the hash on your server; only the signed field values go to the browser, never the API key.
