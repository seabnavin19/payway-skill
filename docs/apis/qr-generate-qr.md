---
id: qr-generate-qr
type: api
title: QR API
summary: Generates a dynamic payment QR (ABA KHQR, WeChat Pay or Alipay) for a fixed amount, returned as a QR string, image and ABA Mobile deeplink.
service: accept-payments/dynamic-qr
source: https://developer.payway.com.kh/qr-api-14530840e0
status: draft
verified_by:
verified_on:
related: [security, dynamic-qr, checkout-check-transaction]
---

# QR API

Call this from your server when the customer is ready to pay at a counter, kiosk or device.
Display the returned QR (`qrImage`, or render `qrString` yourself). When the customer pays,
PayWay posts a notification to your `callback_url`; then confirm with
[Check transaction](checkout-check-transaction.md). Works for online and in-store merchants.
KHR transactions support ABA PAY and KHQR; USD transactions support ABA PAY, KHQR, WeChat and Alipay.

## Endpoint

| | Sandbox | Production |
|---|---|---|
| Method | `POST` | `POST` |
| URL | `https://checkout-sandbox.payway.com.kh/api/payment-gateway/v1/payments/generate-qr` | `https://checkout.payway.com.kh/api/payment-gateway/v1/payments/generate-qr` |
| Content-Type | `application/json` | |

Production base URL is from the portal's [API Endpoints](https://developer.payway.com.kh/api-endpoints-984508m0) page.

## Authentication & hash

Fields concatenated **in this exact order**, then signed with
[`paywayHash`](../examples/node/payway-hash.md) using your API key
(an optional field you do not send contributes an empty string):

1. `req_time`
2. `merchant_id`
3. `tran_id`
4. `amount`
5. `items`
6. `first_name`
7. `last_name`
8. `email`
9. `phone`
10. `purchase_type`
11. `payment_option`
12. `callback_url`
13. `return_deeplink`
14. `currency`
15. `custom_fields`
16. `return_params`
17. `payout`
18. `lifetime`
19. `qr_image_template`

Order taken from the portal's field list; its PHP sample has a typo (`$last_name+ email`) but the same order.

## Request fields

| Name | Type | Required | Rules / Description |
|---|---|---|---|
| `req_time` | string | Yes | Request date and time in UTC, `YYYYMMDDHHmmss`. |
| `merchant_id` | string(30) | Yes | Merchant key provided by ABA Bank. |
| `tran_id` | string(20) | Yes | Unique transaction ID. |
| `first_name` | string(20) | No | Payer's first name. |
| `last_name` | string(20) | No | Payer's last name. |
| `email` | string(50) | No | Payer's email. |
| `phone` | string(20) | No | Payer's phone number. |
| `amount` | number | Yes | At least 100 KHR or 0.01 USD; cannot be null. |
| `currency` | string(3) | Yes | `KHR` or `USD`, not case-sensitive. |
| `purchase_type` | string(20) | No | `purchase` (default) or `pre-auth`. Alipay and WeChat do not support pre-auth. |
| `payment_option` | string(20) | Yes | `abapay_khqr` (ABA KHQR), `wechat` (USD only), `alipay` (USD only). |
| `items` | string(500) | No | Base64-encoded JSON array of items (up to 50). Description only — not used for calculation or validation. |
| `callback_url` | string(255) | No | Base64-encoded URL that receives the payment notification. |
| `return_deeplink` | string(255) | No | Base64-encoded JSON `{"android_scheme": ..., "ios_scheme": ...}`. |
| `custom_fields` | string(255) | No | Base64-encoded JSON of custom fields. |
| `return_params` | string | No | Extra information included in the pushback after payment. |
| `payout` | string(255) | No | Base64-encoded JSON array, e.g. `[{"account":"201030101","amount":1.72}]`. |
| `lifetime` | integer | Yes | Transaction lifetime in minutes. Min 3 minutes, max 120 days, default 30 days. |
| `qr_image_template` | string(20) | Yes | QR image template, e.g. `template3_color` (portal example). |
| `hash` | string | Yes | Base64 HMAC-SHA512, see above. |

> The full list of `qr_image_template` values is shown only as images on the
> [ABA QR API](https://developer.payway.com.kh/aba-qr-api-3158158f0) page. Not documented on the portal — confirm with PayWay team.

## Response

```json
{
  "qrString": "00020101021230510016abaakhppxxx@abaa01151250212145328460208ABA Bank52048249530384054040.015802KH5925OLD ME 25 CHAR WINNER IP",
  "qrImage": "data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAKAAAACgCAYAAACLz2ctAAAACXBIWXMAAA7EAAAOxAGVKw4bAAAOC0lEQVR4nO2deahV1RfHl6ZlaaZ",
  "abapay_deeplink": "abamobilebank://ababank.com?type=payway&qrcode=00020101021230510016abaakhppxxx%40abaa01151250212145328460208ABA+Bank5",
  "app_store": "https://itunes.apple.com/al/app/aba-mobile-bank/id968860649?mt=8",
  "play_store": "https://play.google.com/store/apps/details?id=com.paygo24.ibank",
  "amount": 0.01,
  "currency": "USD",
  "status": {
    "code": "0",
    "message": "Success.",
    "trace_id": "b9f93f45b49f08e26dfcfb8c2da396c6"
  }
}
```

| Name | Type | Description |
|---|---|---|
| `qrString` | string | QR content as a string. |
| `qrImage` | string | QR as a base64 image (`data:image/png;base64,...`). |
| `abapay_deeplink` | string | Opens ABA Mobile so the customer can confirm payment. |
| `app_store` | string | App Store link if ABA Mobile is not installed. |
| `play_store` | string | Play Store link if ABA Mobile is not installed. |
| `amount` | number | Transaction amount. |
| `currency` | string | Transaction currency. |
| `status.code` | string | `0` on success; see Errors. |
| `status.message` | string | Message for `code`. |
| `status.trace_id` | string | Unique request identifier for tracing. |

Callback to `callback_url` (POST), from the [ABA QR API](https://developer.payway.com.kh/aba-qr-api-3158158f0) guide:
`tran_id`, `apv`, `status` (`"0"`), `return_params`, `original_amount`, `original_currency`,
`payment_amount`, `payment_currency`, `total_amount`, `discount_amount`, `transaction_date`,
`first_name`, `last_name`, `email`, `phone`, `bank_ref`, `payment_type`, `payer_account`,
`bank_name`, `card_source`.

## Errors

| Code | Meaning | What to do |
|---|---|---|
| `1` | Wrong Hash. | Check field order and that hashed values equal the sent values. |
| `6` | Requested Domain is not in whitelist. | Ask PayWay to whitelist your domain/IP. |
| `8` | Something went wrong. Please reach out to our digital support team for assistance | Contact PayWay support. |
| `12` | Payment currency is not allowed. | Use a currency enabled on your profile. |
| `16` | Invalid First Name. It must not contain numbers or special characters or not more than 100 characters. | Fix `first_name`. |
| `17` | Invalid Last Name. It must not contain numbers or special characters or not more than 100 characters. | Fix `last_name`. |
| `18` | Invalid Phone Number. | Fix `phone`. |
| `19` | Invalid Email. | Fix `email`. |
| `21` | End of API lifetime. | Create a new QR. |
| `23` | Selected Payment Option is not enabled for this Merchant Profile. | Use an enabled option or contact PayWay. |
| `32` | Service is not enable. | Ask PayWay to enable the QR API service. |
| `35` | Payout Info is invalid. | Fix `payout`. |
| `44` | Purchase amount has reached transaction limit. | Lower the amount or contact PayWay. |
| `47` | KHR Amount must be greater than 100 KHR. | Raise the amount. |
| `48` | Something went wrong with requested parameters. | Check all parameters. |
| `96` | Invalid merchant data | Check `merchant_id` / environment. |
| `102` | The URL is not in the whitelist. | Whitelist the `callback_url` domain. |
| `403` | Duplicated Transaction ID | Use a new `tran_id`. |
| `429` | You've reached the maximum attempt limit. | Back off and retry later. |

## Pitfalls

- `callback_url`, `items`, `return_deeplink`, `custom_fields` and `payout` are Base64-encoded, and the hash covers the encoded value.
- `lifetime`, `qr_image_template` and `currency` are required here (unlike Purchase).
- Success `status.code` is `"0"` here, not `"00"` as in Check transaction.
- `qrImage` can be up to 0.5 MB. On constrained networks, render `qrString` yourself and use the KHQR frame as a static template.
- How PayWay formats a JSON number `amount` for hash verification is not stated. Hash the exact text you send (e.g. send `0.01`, hash `"0.01"`).
  > Not documented on the portal — confirm with PayWay team.
- The callback is not proof of payment: the portal says to also confirm with [Check transaction](checkout-check-transaction.md).
- The guide describes the callback `tran_id` as "Payment transaction ID generated by the payment gateway", so do not assume it equals the `tran_id` you sent. Put your order ID in `return_params` (documented as included in the callback), find the order from it, and call Check transaction with **your** `tran_id`.
  > Whether the callback `tran_id` equals the merchant's `tran_id` is not documented on the portal — confirm with PayWay team.
