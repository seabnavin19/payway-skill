---
id: cof-link-account
type: api
title: Link Account
summary: Starts linking a customer's ABA account and returns a QR string and an ABA Mobile deeplink.
service: auto-payments/tokenization
source: https://developer.payway.com.kh/link-account-19336820e0
status: draft
verified_by:
verified_on:
related: [security, tokenization, cof-get-token-details, cof-payment]
---

# Link Account

Call this from your server when the customer chooses "Link ABA Account". Show the returned
`qr_string` as a QR code (web) or open the `deeplink` (mobile). The customer picks an ABA account in
ABA Mobile; PayWay then posts the token (`pwt`) to your `callback_url`. Part of
[Tokenization](../services/auto-payments/tokenization.md) (PayWay: Credentials on File).

## Endpoint

| | Sandbox | Production |
|---|---|---|
| Method | `POST` | `POST` |
| URL | `https://checkout-sandbox.payway.com.kh/api/payment-credential/v3/aof/link-account` | `https://checkout.payway.com.kh/api/payment-credential/v3/aof/link-account` |
| Content-Type | `application/json` | |

Production base URL is from the portal's [API Endpoints](https://developer.payway.com.kh/api-endpoints-984508m0) page.

## Authentication & hash

Fields concatenated **in this exact order**, then signed with
[`paywayHash`](../examples/node/payway-hash.md) using your API key:

1. `merchant_id`
2. `request_time`
3. `ctid`
4. `return_deeplink`
5. `callback_url`
6. `request_id`
7. `token_flag`
8. `currency`

Optional fields you don't send are hashed as empty strings.

> Hashing omitted optional fields as `''` is not stated on this page — confirm with PayWay team. (The [API Endpoints](https://developer.payway.com.kh/api-endpoints-984508m0) page says optional parameters that are not relevant may be skipped.)

## Request fields

| Name | Type | Required | Rules / Description |
|---|---|---|---|
| `request_id` | string | Yes | Your request ID, unique on your side. Used later to get the token details (only the last record is returned). 5–24 letters and digits, no spaces or special characters. |
| `request_time` | string | Yes | Request date and time in UTC, `YYYYMMDDHHmmss`. |
| `merchant_id` | string(20) | Yes | Merchant key provided by ABA Bank. |
| `ctid` | string | Yes | Your consumer identification number. 5–24 letters and digits, no spaces or special characters. |
| `return_deeplink` | string | No | Deeplink embedded in the **Done** button in ABA Mobile after linking. Base64 of JSON `{"ios_scheme": "...", "android_scheme": "..."}`. |
| `token_flag` | string | Yes | `CITI_FLEX` or `CITO_FLEX`. |
| `currency` | string | Yes | `KHR` or `USD`, based on your merchant profile. |
| `callback_url` | string | No | Where the token details are sent. Base64-encoded. If empty, the `pushback_url` in your profile is used. The domain must be whitelisted. |
| `hash` | string | Yes | Base64 HMAC-SHA512, see above. |

## Response

```json
{
  "status": {
    "code": "00",
    "message": "Success",
    "trace_id": "bce9c83c-922e-4672-87f5-7f92cd15047c"
  },
  "data": {
    "deeplink": "abamobilebank://ababank.com?type=account_on_file&qrcode=ABA...gFses",
    "qr_string": "ABAAOF+hEGxkym...6SbF19enqLB2xU46jTzVY",
    "expire_in": 1627113926
  }
}
```

| Name | Type | Description |
|---|---|---|
| `status.code` | string | `00` = success. See Errors. |
| `status.message` | string | Message for `code`. |
| `status.trace_id` | string | Log ID for debugging. |
| `data.deeplink` | string | Open on Android/iOS to send the user to ABA Mobile. |
| `data.qr_string` | string | Render as a QR code on web for the user to scan. |
| `data.expire_in` | integer | `deeplink` and `qr_string` expire 10 minutes after the request. |

**Token callback** (posted to `callback_url`, JSON), from the
[Unschedule Payment guide](https://developer.payway.com.kh/unschedule-payment-2038908m0):

```json
{
  "request_id": "175317626731593",
  "payment_credential": {
    "ctid": "64513556cc930062e8cb3ae59eee8fbf459c53e",
    "pwt": "6451355C97035CDE21FB13..E0945C21007136F3D423A1B",
    "source_of_fund": "*****5312",
    "type": "ABA ACCOUNT",
    "status": 1,
    "expired_at": "2025-10-20T08:20:03",
    "token_flag": "CITI_FLEX",
    "frequency": "",
    "subscribed_amount": 0.0,
    "amount_limit_per_tran": 0.0,
    "currency": "USD"
  }
}
```

Fields are the same as the [Get token details](cof-get-token-details.md) response.

## Errors

| Code | Meaning | What to do |
|---|---|---|
| `00` | Success | Show the QR / open the deeplink. |
| `01` | Wrong hash | Check field order and API key. |
| `04` | The given data was invalid (HTTP 400; details in `status.errors`) | Fix the fields listed in `errors`. |
| `98` | Merchant id not found | Check `merchant_id` / environment. |
| `104` | Merchant not enabled token flag | Ask PayWay to enable the `token_flag` on your profile. |

## Pitfalls

- The portal's examples return error codes such as `01` with HTTP 200 — always read `status.code`, not only the HTTP status.
- The callback is not signed according to the portal. Don't store `pwt` straight from the callback body; fetch it with [Get token details](cof-get-token-details.md) using your own stored `request_id`.
- `CITI_FLEX` tokens are for customer-initiated payments only. To charge without the customer present (MIT), link with `CITO_FLEX`.
- A customer (`ctid`) cannot link the same ABA account twice while an active or frozen token exists for it.
- `callback_url` and `return_deeplink` must be Base64-encoded.
