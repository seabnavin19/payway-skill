---
id: checkout-purchase
type: api
title: Purchase
summary: Creates a checkout transaction and returns the PayWay checkout page (or a QR/deeplink JSON for abapay_khqr_deeplink).
service: accept-payments/online-checkout
source: https://developer.payway.com.kh/purchase-14530820e0
status: draft
verified_by:
verified_on:
related: [security, online-checkout, checkout-check-transaction]
---

# Purchase

Call this when the customer clicks **Pay** on your website or app. PayWay responds with an HTML
checkout page that you render (popup / bottom sheet with the PayWay plugin JS, or a hosted page).
After payment, PayWay sends the result to your `return_url`; confirm it with
[Check transaction](checkout-check-transaction.md).

## Endpoint

| | Sandbox | Production |
|---|---|---|
| Method | `POST` | `POST` |
| URL | `https://checkout-sandbox.payway.com.kh/api/payment-gateway/v1/payments/purchase` | `https://checkout.payway.com.kh/api/payment-gateway/v1/payments/purchase` |
| Content-Type | `multipart/form-data` | |

Production base URL is from the portal's [API Endpoints](https://developer.payway.com.kh/api-endpoints-984508m0) page.
Calls are only accepted from a domain/IP whitelisted by PayWay.

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
23. `google_pay_token`
24. `skip_success_page`

`view_type` and `payment_gate` are request fields but are **not** in the portal's hash list.

## Request fields

| Name | Type | Required | Rules / Description |
|---|---|---|---|
| `req_time` | string | Yes | Request date and time in UTC, `YYYYMMDDHHmmss`. |
| `merchant_id` | string(30) | Yes | Merchant key provided by ABA Bank. |
| `tran_id` | string(20) | Yes | Unique transaction identifier. |
| `firstname` | string(100) | No | Buyer's first name. |
| `lastname` | string(100) | No | Buyer's last name. |
| `email` | string(50) | No | Buyer's email. |
| `phone` | string(20) | No | Buyer's phone. |
| `type` | string(20) | No | `purchase` (default) or `pre-auth`. Pre-auth only supports ABA PAY, KHQR and card. |
| `payment_option` | string(20) | No | `cards`, `abapay_khqr`, `abapay_khqr_deeplink`, `alipay`, `wechat`, `google_pay`. Empty = PayWay shows the options enabled on your profile. |
| `items` | string | No | Base64-encoded JSON array of items (up to 50). Description only — not used for calculation or validation. |
| `shipping` | number | No | Shipping fee. |
| `amount` | number | Yes | Purchase amount. |
| `currency` | string | No | `KHR` or `USD`. Empty = default currency of your merchant profile. |
| `return_url` | string | No | Base64-encoded URL that receives the payment callback. |
| `cancel_url` | string | No | Redirect URL when the user closes or cancels the payment dialog. |
| `skip_success_page` | integer | No | `0` don't skip, `1` skip success page. Empty = profile setting. |
| `continue_success_url` | string | No | Redirect URL after a successful payment. |
| `return_deeplink` | string | No | Base64-encoded JSON `{"ios_scheme": ..., "android_scheme": ...}`. Mandatory for mobile integration. |
| `custom_fields` | string | No | Base64-encoded JSON; shown in transaction list, details and export. |
| `return_params` | string | No | Information to include when PayWay calls your return URL. |
| `view_type` | string | No | `hosted_view` (new tab) or `popup` (bottom sheet on mobile web, modal on desktop). |
| `payment_gate` | integer | No | Set `0` to use Checkout if your profile also has the QR Payment API service. |
| `payout` | string | No | Base64-encoded JSON array, e.g. `[{"acc":"000133879","amt":1}]`. |
| `additional_params` | string | No | Base64-encoded JSON for WeChat Mini Program: `wechat_sub_appid`, `wechat_sub_openid`. |
| `lifetime` | integer | No | Payment lifetime in minutes. Min 3 minutes, max 30 days, default 30 days. |
| `google_pay_token` | string | No | Required when `payment_option` is `google_pay` and you manage payment selection. |
| `hash` | string | Yes | Base64 HMAC-SHA512, see above. |

## Response

Default: an HTML checkout page to render for the customer.

```html
<!DOCTYPE html>
<html data-capo="">
<head>
<meta charset="utf-8">
<title>PayWay - Checkout</title>
...
</head>
<body>
...
</body>
</html>
```

With `payment_option=abapay_khqr_deeplink`, JSON:

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
| `status.code` | string | `00` on success; see Errors. |
| `status.message` | string | Message for `code`. |
| `status.tran_id` | string | Transaction ID. |
| `qr_string` | string | KHQR content. |
| `abapay_deeplink` | string | Deeplink that opens ABA Mobile. |
| `checkout_qr_url` | string | PayWay-hosted QR checkout URL. |

Callback to `return_url` (POST, `application/json`), from the
[Ecommerce Checkout](https://developer.payway.com.kh/ecommerce-checkout-3158159f0) guide:
`tran_id`, `apv`, `status` (`"0"`), `return_params`, `original_amount`, `original_currency`,
`payment_amount`, `payment_currency`, `total_amount`, `discount_amount`, `transaction_date`,
`first_name`, `last_name`, `email`, `phone`, `bank_ref`, `payment_type`, `payer_account`,
`bank_name`, `card_source`.

## Errors

Error responses are JSON `{"status": {"code": <int>, "message": "..."}}`. Selected codes
(the portal lists codes 0–87, 200, 201, 401, 403, 429, 503 — see the source page for all):

| Code | Meaning | What to do |
|---|---|---|
| `1` | Wrong hash | Check field order and that hashed values equal the sent values. |
| `2` | Invalid transaction ID | Fix `tran_id` (max 20 chars). |
| `3` | Invalid transaction amount | Fix `amount`. |
| `4` | Duplicated transaction ID | Use a new `tran_id` per attempt. |
| `6` | Requested domain is not in whitelist | Ask PayWay to whitelist your domain/IP. |
| `12` | Payment currency is not allowed | Use a currency enabled on your profile. |
| `23` | Selected payment option is not enabled for this merchant profile | Use an enabled option or contact PayWay. |
| `45` | Purchase with zero amount is not allowed | Amount must be > 0. |
| `46` | Purchase amount for KHR currency could not contain decimal place | Send whole KHR. |
| `47` | KHR amount must be greater than 100 KHR | Raise the amount. |
| `69` | Transaction lifetime can not be less than 3 minutes | `lifetime` ≥ 3. |
| `81` | The return URL is not in the whitelist | Whitelist the `return_url` domain. |
| `429` | Too many request, please try again in 1min. | Back off and retry. |
| `503` | System under maintenance | Retry later. |

## Pitfalls

- `return_url`, `items`, `return_deeplink`, `custom_fields`, `payout` and `additional_params` must be Base64-encoded, and the hash is computed over the encoded value.
- The hash must include every parameter you post, in the order above; skipped optional fields are empty strings.
- `amount` must be computed on your server — never take it from the browser. See [Never trust client amounts](../best-practices/never-trust-client-amounts.md).
- If your profile also has the QR Payment API service, send `payment_gate=0` to use Checkout.
- Calling from the browser address bar or with `GET` returns `405 Method Not Allowed`.
- The callback alone is not proof of payment; confirm with [Check transaction](checkout-check-transaction.md).
