---
id: cof-subscription
type: api
title: Subscription
summary: Takes the customer's first payment and, in the same step, links their ABA account or card for fixed scheduled charges (CITR_FIX).
service: auto-payments/recurring
source: https://developer.payway.com.kh/subscription-21402227e0
status: draft
verified_by:
verified_on:
related: [security, recurring, cof-payment, cof-get-token-details, checkout-check-transaction]
---

# Subscription

Use this when the customer signs up for a plan with a fixed amount and frequency. It is the
Purchase endpoint with three extra fields (`ctid`, `token_flag` `CITR_FIX`, `frequency`): the customer
pays the first amount on PayWay's checkout page and gives consent; PayWay then sends a payment
callback to your `return_url` and a token callback (with the `pwt`) to the Credentials on File
callback URL in your profile. Later charges use [Payment](cof-payment.md) with `MITR_FIX`.
Part of [Recurring](../services/auto-payments/recurring.md).

## Endpoint

| | Sandbox | Production |
|---|---|---|
| Method | `POST` | `POST` |
| URL | `https://checkout-sandbox.payway.com.kh/api/payment-gateway/v1/payments/purchase` | `https://checkout.payway.com.kh/api/payment-gateway/v1/payments/purchase` |
| Content-Type | `multipart/form-data` | |

Production base URL is from the portal's [API Endpoints](https://developer.payway.com.kh/api-endpoints-984508m0) page.
The portal's [Schedule Payment guide](https://developer.payway.com.kh/schedule-payment-2038907m0) posts
this as an HTML form from the browser (`target="aba_webservice"`, PayWay plugin
`https://checkout.payway.com.kh/plugins/checkout2-0.js` and `AbaPayway.checkout()`), with the hash
computed on your server.

## Authentication & hash

Fields concatenated **in this exact order**, then signed with
[`paywayHash`](../examples/node/payway-hash.md) using your API key
(an optional field you do not send contributes an empty string):

1. `req_time`
2. `merchant_id`
3. `tran_id`
4. `amount`
5. `items`
6. `shipping`
7. `firstname`
8. `lastname`
9. `email`
10. `phone`
11. `type`
12. `payment_option`
13. `return_url`
14. `cancel_url`
15. `continue_success_url`
16. `return_deeplink`
17. `currency`
18. `custom_fields`
19. `return_params`
20. `payout`
21. `lifetime`
22. `additional_params`
23. `skip_success_page`
24. `token_flag`
25. `frequency`

> `ctid` is required but is not in the portal's hash list, and `additional_params` is in the hash list but not in the field list. The examples follow the hash list exactly. Not documented on the portal — confirm with PayWay team.

## Request fields

| Name | Type | Required | Rules / Description |
|---|---|---|---|
| `req_time` | string | Yes | Request date and time in UTC, `YYYYMMDDHHmmss`. |
| `merchant_id` | string(30) | Yes | Merchant key provided by ABA Bank. |
| `tran_id` | string(20) | Yes | Unique transaction ID for the payment. |
| `firstname` | string(20) | No | Buyer's first name. |
| `lastname` | string(20) | No | Buyer's last name. |
| `email` | string(50) | No | Buyer's email. |
| `phone` | string(20) | No | Buyer's phone. |
| `type` | string(20) | No | `purchase` for full purchase. |
| `payment_option` | string(20) | Yes | `cards`, `abapay`, or `abapay_deeplink` (returns JSON with `qr_string`, `abapay_deeplink`, `checkout_qr_url`). |
| `items` | string(500) | No | Base64 JSON array of items (`name`, `quantity`, `price`). Description only; not used for calculation or validation. |
| `shipping` | number | No | Shipping fee. |
| `amount` | number | Yes | Purchase amount. |
| `currency` | string | No | `KHR` or `USD`; defaults to your merchant profile's currency. |
| `return_url` | string | No | URL PayWay sends the payment notification to on success. |
| `cancel_url` | string | No | Redirect after the user closes or cancels the payment. |
| `skip_success_page` | integer | No | `0` don't skip, `1` skip the success page. Overrides the profile setting. |
| `continue_success_url` | string | No | Redirect after a successful payment. |
| `return_deeplink` | string | No | Base64 JSON with `ios_scheme` and `android_scheme`. Mandatory for mobile integration. |
| `custom_fields` | string | No | Base64 JSON shown in transaction list, details and export. |
| `return_params` | string | No | Information to include when PayWay calls your return URL after a successful payment. |
| `view_type` | string | No | `hosted_view` (new tab) or `popup` (bottom sheet on mobile, modal on desktop). |
| `payment_gate` | integer | No | Set to `0` to use Checkout if your profile also has the QR Payment API. |
| `payout` | string | No | Base64 JSON array of payouts, e.g. `[{"acc":"000133879","amt":1}]`. |
| `lifetime` | integer | No | Payment lifetime in minutes. Min 3 minutes, max 30 days; default 30 days. |
| `ctid` | string | Yes | Your consumer identification number. |
| `token_flag` | string | No | `CITR_FIX`. |
| `frequency` | string | When `token_flag` is `CITR_FIX` | `1W` weekly, `1M` monthly, `2M` every 2 months. |
| `hash` | string | Yes | Base64 HMAC-SHA512, see above. |

## Response

`200`: an HTML checkout page to render for the customer. With `payment_option` `abapay_deeplink`,
JSON instead:

```json
{
    "status": {
        "code": "00",
        "message": "Success!",
        "tran_id": "trx-20201019130949"
    },
    "qr_string": "00020101021230510016abaakhppxxx@abaa01153250212100849350208ABA Bank520410165...",
    "abapay_deeplink": "abamobilebank://ababank.com?type=payway&qrcode=00020101021230510016...",
    "checkout_qr_url": "https://checkout-uat.payway.com.kh/eyJzdGF0dXMiOnsiY29kZSI6IjAwIiw..."
}
```

| Name | Type | Description |
|---|---|---|
| `status.code` | string | `00` = success. See Errors. |
| `status.message` | string | Message for `code`. |
| `status.tran_id` | string | Transaction ID. |
| `qr_string` | string | KHQR string. |
| `abapay_deeplink` | string | Opens ABA Mobile to pay. |
| `checkout_qr_url` | string | PayWay-hosted QR page. |

**Callbacks**, from the [Schedule Payment guide](https://developer.payway.com.kh/schedule-payment-2038907m0).
PayWay sends two:

1. Payment completion, to `return_url` (or the callback URL in your API settings), JSON:

   ```json
   {
       "tran_id": "17425401324",
       "apv": "619195",
       "status": "0",
       "return_params": "xxxxxxxxxx"
   }
   ```

   `tran_id` is described as the transaction ID sent during the initial payment, `apv` the approval
   code, `status` the payment status, `return_params` the extra data you sent. The guide's PHP sample
   verifies an `X-PayWay-HMAC-SHA512` header: sort the body fields by key, concatenate the values,
   HMAC-SHA512 with `"YOUR_SECRET_KEY"`, Base64, compare.

   > Which key is `YOUR_SECRET_KEY` is not documented on the portal — confirm with PayWay team.

2. Token, to the callback URL in **Outlet Profile > Services > Credential on File**, JSON: `request_id`
   and `payment_credential` (`ctid`, `pwt`, `source_of_fund`, `type`, `status`, `expired_at`,
   `token_flag` `CITR_FIX`, `frequency`, `subscribed_amount`, `amount_limit_per_tran`, `currency`) —
   same fields as [Get token details](cof-get-token-details.md).

## Errors

Exception responses have a numeric `status.code`. Codes most relevant to subscriptions:

| Code | Meaning | What to do |
|---|---|---|
| `1` | Wrong hash | Check field order and API key. |
| `2` | Invalid transaction ID | Check `tran_id` format (max 20). |
| `3` | Invalid transaction amount | Check `amount`. |
| `4` | Duplicated transaction ID | Use a new `tran_id` per attempt. |
| `6` | Requested domain is not in whitelist | Ask PayWay to whitelist your domain. |
| `23` | Selected payment option is not enabled for this merchant profile | Use an enabled `payment_option`. |
| `26` | Invalid merchant profile | Check `merchant_id` / environment. |
| `27` | Invalid ctid | Check `ctid`. |
| `30` | Merchant is not enabled COF | Ask PayWay to enable Credentials on File. |
| `46` | Purchase amount for KHR currency could not contain decimal place | Send whole KHR amounts. |
| `47` | KHR amount must be greater than 100 KHR | Raise the amount. |
| `81` | The return URL is not in the whitelist | Whitelist the `return_url` domain. |
| `200` | Payment was canceled | Let the customer retry. |
| `201` | Payment was declined | Let the customer retry with another method. |
| `429` | Too many request, please try again in 1min. | Back off. |
| `503` | System under maintenance | Retry later. |

The full list (codes `0`–`87`, `200`, `201`, `401`, `403`, `429`, `503`) is on the
[portal page](https://developer.payway.com.kh/subscription-21402227e0).

## Pitfalls

- Two callbacks arrive, to two different URLs: the payment result at `return_url`, the token at the Credentials on File callback URL configured in your profile. Handle both.
- The token callback has a `request_id`, but this endpoint has no `request_id` field. How it maps to your subscription is not documented on the portal — confirm with PayWay team. The examples match the token by `ctid` and confirm it with [Get token details](cof-get-token-details.md).
- The portal's Purchase page calls the callback `tran_id` gateway-generated, while this guide says it is the one you sent. Find your record from `return_params` instead, then confirm with [Check transaction](checkout-check-transaction.md) using your own `tran_id`.
- This page does not say `return_url` is Base64-encoded, but the [Purchase](https://developer.payway.com.kh/purchase-14530820e0) page for the same endpoint does. The examples Base64-encode it. Not documented on this page — confirm with PayWay team.
- The customer cannot change the subscribed amount limit in ABA Mobile afterwards; `amount_limit_per_tran` is locked to `subscribed_amount`, so later `MITR_FIX` charges must use that same amount.
