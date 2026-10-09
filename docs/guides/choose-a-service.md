---
id: choose-a-service
type: guide
title: Choose a service
summary: Decision tree that maps a merchant's business need to the right PayWay service.
status: draft
related: [security, go-live-checklist]
---

# Choose a service

Answer the questions in order. Stop at the first match.

## Decision tree

1. **Do you need to pay money *out* to other people** (sellers, drivers, partners)?
   - Split one customer payment between several accounts → [Split payment](../services/payouts/split-payment.md)
   - Send money to beneficiaries on demand → [Beneficiary payout](../services/payouts/beneficiary-payout.md)
2. **Do you need to hold funds now and charge the final amount later** (hotel, rental, deposit)?
   → [Pre-auth & capture](../services/hold-payments/pre-auth-capture.md)
3. **Will you charge the same customer again without them re-entering details** (subscriptions, top-ups, one-click)?
   - Charge on a fixed schedule → [Recurring](../services/auto-payments/recurring.md)
   - Save card/account for faster future checkout → [Tokenization](../services/auto-payments/tokenization.md)
4. **One-time payment.** Where does the customer pay?
   - On your website or in your app → [Online checkout](../services/accept-payments/online-checkout.md)
   - In person, at a counter or table → [Dynamic QR](../services/accept-payments/dynamic-qr.md)
   - No website — you send a link by chat, SMS or email → [Payment link](../services/accept-payments/payment-link.md)

## Questions to ask the merchant

| Ask | Why it matters |
|---|---|
| What do you sell, and to whom? | Physical vs digital goods, B2C vs B2B |
| Where does the customer pay: website, app, in person, or via a link? | Picks checkout vs QR vs link |
| One-time or repeated charges? | Picks one-time vs tokenization/recurring |
| Is the final amount known at payment time? | Unknown → pre-auth |
| Does money go to anyone besides you? | Yes → payouts |
| Which backend language and framework? | Picks the code example |

## When nothing fits

If the need is not covered by any service above, say so. Do not force a match.
Point the merchant to the official portal: <https://developer.payway.com.kh/>.
