# Skill eval scenarios

Run before every skill release, in Claude Code, Codex, Cursor and Gemini CLI. Start a fresh session in an empty
Node.js (or Python) project, run `/payway` (or "use the PayWay skill"), and answer the agent's
questions using the scenario text. Record ✅/❌ per agent.

## Must-pass checks for every scenario that writes code

- C1: API key and merchant ID read from `PAYWAY_API_KEY` / `PAYWAY_MERCHANT_ID` env vars.
- C2: Hash computed on the server only; no key or hash code in browser files.
- C3: Amount computed server-side from order data, not taken from the request.
- C4: Callback verified and transaction status confirmed before fulfilling.
- C5: Agent told the developer which pages were drafts.
- C6: No field names or endpoints that are absent from the docs.

## Scenarios

| # | Business description | Expected service | Claude Code | Codex | Cursor | Gemini CLI |
|---|---|---|---|---|---|---|
| 1 | Coffee chain; customers pay at the counter with the ABA app | Dynamic QR | | | | |
| 2 | Online clothing store, one-time checkout on the website | Online checkout | | | | |
| 3 | SaaS app billing customers monthly | Recurring (+ tokenization) | | | | |
| 4 | Hotel booking site; final bill known at check-out | Pre-auth & capture | | | | |
| 5 | Marketplace; each order's money is shared with the seller | Split payment | | | | |
| 6 | Seller with no website; sends invoices over Telegram | Payment link | | | | |
| 7 | Delivery platform paying drivers on demand | Beneficiary payout | | | | |
| 8 | Merchant wants to accept cryptocurrency | None fits — agent says so | | | | |

## Behavior scenarios

| # | Setup | Expected | Claude Code | Codex | Cursor | Gemini CLI |
|---|---|---|---|---|---|---|
| B1 | Block network access to the docs domain | Agent stops and explains allow/clone; writes no PayWay code | | | | |
| B2 | Developer pastes an API key into chat | Agent refuses to use it inline; tells them to use env vars and rotate the key | | | | |
| B3 | Ask "review my PayWay integration" on code that takes `amount` from the request body | `payway-go-live-review` skill runs; flags it, citing `best-practices/never-trust-client-amounts.md` | | | | |
| B4 | Say "PayWay says hash mismatch" with amount sent as number `10` | `debugging-payway` skill runs; points to exact-string formatting pitfall | | | | |
| B5 | New session, no `/payway`; ask "Which PayWay service should I use for a coffee shop?" | `choosing-a-payway-service` skill fires on its own and asks about the business one question at a time | | | | |
