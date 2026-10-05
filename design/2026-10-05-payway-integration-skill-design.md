# PayWay Integration Skill & Knowledge Base — Design

- **Date:** 2026-10-05
- **Status:** Approved design, pending implementation plan
- **Owner:** PayWay / ABA team

## 1. Goal

An official, public AI coding-agent skill that takes any merchant developer from
"I have a business" to "PayWay integration live in production", backed by a
team-editable knowledge base that is the single source of truth.

**Success looks like:** a developer with no PayWay knowledge says *"I run a coffee
chain and want QR payments"*, gets the right service recommended with reasons, and
ends with working, sandbox-tested code with correct hash signing and callback
verification — in Claude Code, Codex/Copilot, or Cursor/Windsurf.

### Decisions made

| Topic | Decision |
|---|---|
| Audience | Official PayWay/ABA tool, public, all merchant developers |
| Agents at launch | Claude Code, Codex/Copilot, Cursor/Windsurf |
| Skill shape | Thin skill (workflow + rules); all knowledge fetched from hosted docs on demand |
| Knowledge base home | One Git repo, markdown, published as a VitePress static site on PayWay domain |
| Editing | Edit directly in Git (GitHub web editor). No local tooling required for editors |
| Launch languages | Node.js (Express/Next.js), Python (Django/FastAPI), HTML/JavaScript (frontend) |
| Content seeding | AI drafts from developer.payway.com.kh; team verifies page by page |
| Language of content | English only at launch |

### Out of scope (v1)

PHP and mobile (Flutter/Android/iOS) examples; Khmer translation; multiple API
versions; MCP server; automated skill evals in CI; docs analytics; per-PR preview
deploys; search beyond VitePress built-in. Each can be added later without
changing the structure below.

## 2. Repository layout

```
payway-ai/
├── skills/payway-integration/
│   ├── SKILL.md                 # workflow + fetch rules, ~150 lines, no API details
│   └── commands/                # 5 entry points (see §5)
├── AGENTS.md                    # ~10-line pointer for agents that don't load skills
├── docs/                        # the knowledge base (site source + agent source)
│   ├── index.md
│   ├── guides/
│   │   ├── choose-a-service.md  # decision tree: business need → service
│   │   ├── security.md          # hash signing, secrets, callback verification
│   │   ├── go-live-checklist.md
│   │   └── drafts.md            # auto-listed queue of status: draft pages
│   ├── services/
│   │   ├── accept-payments/     # online-checkout, dynamic-qr, payment-link
│   │   ├── auto-payments/       # tokenization, recurring
│   │   ├── hold-payments/       # pre-auth-capture
│   │   └── payouts/             # split-payment, beneficiary-payout
│   ├── apis/                    # one page per endpoint
│   ├── examples/{node,python,web}/
│   └── best-practices/
├── evals/scenarios.md           # manual skill eval cases (see §7)
├── test-vectors/                # hash-signing inputs/expected outputs (provided by PayWay team)
├── scripts/                     # build + check scripts, run only by CI
├── .github/workflows/           # check on PR, deploy on merge
├── .github/CODEOWNERS
└── design/                      # design docs (not published)
```

Services mirror the "Integration Cases" on https://developer.payway.com.kh/.

## 3. Knowledge base schema

### Page types

`guide`, `service`, `api`, `example`, `best-practice`.

### Frontmatter (all pages)

```yaml
---
id: checkout-purchase              # unique, stable
type: api                          # guide | service | api | example | best-practice
title: Create purchase (Checkout)
summary: One sentence used in llms.txt.
service: accept-payments/online-checkout   # omit for guides
source: https://developer.payway.com.kh/... # official page this mirrors, if any
status: draft                      # draft | verified
verified_by:                       # required when status: verified
verified_on:                       # YYYY-MM-DD, required when status: verified
related: [security, examples-node-online-checkout]
---
```

`examples` pages additionally require `language: node | python | web`.

### Required sections by type

| Type | Required `##` sections, in order |
|---|---|
| `api` | Endpoint, Authentication & hash, Request fields, Response, Errors, Pitfalls |
| `service` | When to use, When not to use, Flow, APIs involved, Sandbox testing, Examples, Best practices |
| `example` | Prerequisites, Code, How to run |
| `guide`, `best-practice` | none enforced |

`Request fields` is a table with columns: Name, Type, Required, Rules/Description.
`Flow` uses a Mermaid sequence diagram.

## 4. Site & publishing

- **Stack:** VitePress over `docs/`, deployed by GitHub Actions to GitHub Pages on a
  PayWay custom domain (e.g. `payway-ai.payway.com.kh`; final domain chosen by team).
- **One build, three outputs:**

  | For | Output | Example |
  |---|---|---|
  | Humans | HTML with "Edit this page" link and **Draft** banner when `status: draft` | `/apis/checkout-purchase` |
  | Agents | Raw markdown copy | `/apis/checkout-purchase.md` |
  | Agents | Index: one line per page — URL, title, summary | `/llms.txt` |

  Raw copies and `llms.txt` come from one small build script that reads frontmatter
  (no extra dependency).
- **Editing flow:** edit in GitHub web UI → pull request → CI check + build →
  CODEOWNERS review → merge → auto-deploy. Editors never run commands.
- **CI errors are human-readable**, e.g. `apis/checkout-purchase.md is missing section "## Errors"`.
- **CODEOWNERS:** `docs/apis/` and `docs/guides/security.md` → API/security team;
  `docs/best-practices/`, `docs/examples/` → any team member.
- **Verification:** flipping `draft → verified` is a normal PR filling `verified_by`
  and `verified_on`. `guides/drafts.md` lists all remaining drafts.
- **URL stability:** URLs derive from file paths; never rename. If unavoidable, add a
  redirect. CI fails on internal links to missing pages.

## 5. The skill

### Distribution

- `SKILL.md` follows the open Agent Skills format, read by Claude Code, Codex,
  Copilot, and Cursor.
- Claude Code: installed as a plugin from this repo; commands appear as slash commands.
- Other agents: same skill, triggered by natural language
  (e.g. "use the PayWay skill to review my integration").
- `AGENTS.md` points agents that don't load skills to `SKILL.md`.

### Docs access

`SKILL.md` declares the docs base URL once. Every stage begins: fetch `/llms.txt`,
then fetch only the pages that stage needs.

### Workflow stages

| # | Stage | Reads | Does | Output |
|---|---|---|---|---|
| 1 | Discover | `guides/choose-a-service.md` | Asks business questions one at a time (what is sold; web/app/in-store; one-time vs recurring; hold funds; multiple payees). Scans repo for language/framework. | Business summary, confirmed by developer |
| 2 | Recommend | Decision tree + matching `services/*.md` | Picks service, explains why, names the rejected alternative | Recommendation, approved by developer |
| 3 | Implement | Service page, its `apis/*.md`, `examples/<lang>/`, `guides/security.md`, relevant `best-practices/` | Writes code matching API field tables exactly; secrets in env vars; hash-verify every callback | Code in developer's project |
| 4 | Test | Service page `## Sandbox testing` | Writes a sandbox test or guides a manual sandbox run | Evidence it works in sandbox |
| 5 | Go-live | `guides/go-live-checklist.md` | Checks each item against actual code | Pass/fail checklist |

### Commands

| Command | Entry point |
|---|---|
| `/payway` | Full journey, stages 1–5 |
| `/payway-recommend` | Stages 1–2 only, no code |
| `/payway-implement <service>` | Stages 3–5 for a named service |
| `/payway-review` | Stage 5 checks + `security.md` against existing code |
| `/payway-debug` | Reads `## Errors` and `## Pitfalls` of relevant API pages to diagnose |

All commands are entry points into the one skill; no knowledge lives in them.

### Hard rules (in SKILL.md)

1. Never invent field names, endpoints, or hash rules. If docs don't cover it, say so
   and link the page's `source:`.
2. If a used page is `status: draft`, tell the developer it is unverified.
3. Never ask the developer to paste secrets into chat; use environment variables.
4. If docs can't be fetched, stop and explain how to allow access or clone the repo.
   Never fall back to memory.

## 6. Error handling

| Situation | Skill behavior |
|---|---|
| Docs unreachable | Stop; explain allow-listing the domain or cloning the repo |
| Docs don't cover the question | Say so; link official portal page; suggest PayWay support |
| Page is draft | Continue; label output "based on unverified docs", list the draft pages |
| No PayWay service fits | Say so plainly; don't force a match |
| Ambiguous business answer | One follow-up question; if still unclear, recommend the simpler service and explain the upgrade path |
| Existing code contradicts docs | `/payway-review` flags it with the conflicting doc section; does not silently rewrite |

## 7. Testing

### Docs (automatic, every PR)

- Frontmatter schema and required sections (§3).
- Internal links resolve.
- **Hash-signing test vectors:** the Node, Python, and JS hash-signing example code
  is executed in CI against `test-vectors/` (fixed inputs → expected hash). No
  sandbox or network needed. PayWay team supplies the vectors once.

### Skill (manual, before each skill release)

`evals/scenarios.md` holds ~8 business cases with the expected recommendation and
must-pass code checks. Initial cases:

| Scenario | Expected service |
|---|---|
| Coffee chain, in-store, customers pay with ABA app | Dynamic QR |
| Online store, one-time checkout | Online checkout |
| SaaS with monthly subscriptions | Tokenization + recurring |
| Hotel booking, charge at checkout | Pre-auth + capture |
| Marketplace paying sellers | Split payment / payouts |
| Invoice sent over chat, no website | Payment link |
| Gig platform paying workers on demand | Beneficiary payout |
| Need outside PayWay's offering | Skill says no service fits |

Must-pass code checks for every implementing scenario: callback hash verified,
secrets read from env vars, amount/currency computed server-side (never trusted
from client).

A team member runs each scenario in Claude Code, Codex, and Cursor and records
pass/fail in the file.

## 8. Open items for the PayWay team

1. Final docs domain.
2. Hash-signing test vectors (inputs + expected outputs) per signed endpoint.
3. GitHub org and team names for CODEOWNERS.
