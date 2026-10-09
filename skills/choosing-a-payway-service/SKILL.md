---
name: choosing-a-payway-service
description: "Use when a developer wants to accept payments with PayWay but has not chosen a PayWay service, or asks which PayWay option fits their business (checkout, QR, payment link, saved cards, recurring, pre-auth, payouts)."
---

# Choosing a PayWay Service

Follow the knowledge-base and hard rules in the `using-payway` skill.

## Stage 1 — Discover

Read `guides/choose-a-service.md`.
Ask the "Questions to ask the merchant" one at a time. Inspect the repository to detect the
language and framework (e.g. `package.json` → Node.js; `requirements.txt`/`pyproject.toml` → Python).
Output: a short business summary. Ask the developer to confirm it.

## Stage 2 — Recommend

Walk the decision tree in `guides/choose-a-service.md`, then read the matching service page.
Output: the recommended service, why it fits (quote the "When to use" item), and the closest
alternative you rejected and why. If nothing fits, say so — do not force a match.
If an answer is ambiguous, ask one follow-up; if still unclear, recommend the simpler service
and explain how to upgrade later.

## Then

Write no code in this skill. Wait for the developer to approve the recommendation, then hand off
to the `implementing-payway` skill.
