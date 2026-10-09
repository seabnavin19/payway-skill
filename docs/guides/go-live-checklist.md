---
id: go-live-checklist
type: guide
title: Go-live checklist
summary: Items to verify in code and configuration before switching to production.
status: draft
related: [security]
---

# Go-live checklist

Check every item against the actual code, not memory. Each item is pass/fail.

## Credentials

- [ ] Production merchant ID and API key come from environment variables / secret manager.
- [ ] No API key, merchant ID or hash computation appears in frontend code or the git history.
- [ ] Sandbox and production base URLs are selected by configuration, not by editing code.

## Requests

- [ ] Every signed request concatenates fields in the order documented on its API page.
- [ ] Amounts are formatted exactly as documented and computed server-side.
- [ ] `tran_id` is unique per attempt and stored before calling PayWay.

## Callbacks and confirmation

- [ ] Callback URL is HTTPS and publicly reachable.
- [ ] Callback is verified as documented on the API page.
- [ ] Order is fulfilled only after server-side status confirmation with matching amount and currency.
- [ ] Callback handler is idempotent.

## Operations

- [ ] Errors from PayWay are logged with `tran_id` (without secrets).
- [ ] A full payment was completed end-to-end in sandbox, including the callback.
- [ ] Someone knows how to reach PayWay support and where to find transaction records.
