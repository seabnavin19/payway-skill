---
name: testing-payway-in-sandbox
description: "Use when a PayWay integration has been written and needs to be verified against the PayWay sandbox before anyone calls it done."
---

# Testing PayWay in Sandbox

Follow the knowledge-base rules, hard rules and Draft content section in the `using-payway` skill.

## Stage 4 — Test

Read the service page's "Sandbox testing" section. Write an automated sandbox test if the project
has a test setup; otherwise walk the developer through a manual sandbox payment. Do not declare
success until the developer confirms a sandbox payment and its callback completed.

## Then

Hand off to the `payway-go-live-review` skill.
