---
name: payway-go-live-review
description: "Use when preparing a PayWay integration for production, or when asked to review or audit existing PayWay payment code."
---

# PayWay Go-Live Review

Follow the knowledge-base and hard rules in the `using-payway` skill.

## Stage 5 — Go-live

Read `guides/go-live-checklist.md`. Check every item against the actual code and configuration.
Output: the checklist with pass/fail per item and the file/line evidence for each.

## Reviewing an existing integration

When asked to review or audit PayWay code you did not just write, read `guides/security.md` and
`guides/go-live-checklist.md`, then audit the existing code against both. Report each conflict with
the docs, citing the page section and the file/line. Do not silently rewrite: change code only when
the developer asks.
