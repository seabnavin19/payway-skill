# PayWay Skill

Official-style ABA PayWay integration skills for AI coding agents, plus the knowledge base they read.
Install the skills and your agent takes a developer from "I have a business" to "PayWay live in
production" — choosing the right PayWay service, implementing it safely, testing it in sandbox and
reviewing it for go-live.

## How it works

When you start working on PayWay payments, your agent notices and loads the PayWay skills. It asks
about your business one question at a time and recommends the PayWay service that fits. It then
implements that service from the knowledge base — never from memory — tests it in the PayWay sandbox,
and runs a go-live review against the checklist. Any knowledge-base page still marked Draft is
disclosed, so you know which parts to double-check.

## Installation

### Claude Code

```
/plugin marketplace add seabnavin19/payway-skill
/plugin install payway@payway-skill
```

Then restart Claude Code; type `/payway` or just say "integrate PayWay".

### Gemini CLI

```
gemini extensions install https://github.com/seabnavin19/payway-skill
```

Update with `gemini extensions update payway`.

### Codex, GitHub Copilot, Cursor

Clone this repository and copy the folders under `skills/` into the tool's skills directory
(`~/.codex/skills/`, `~/.copilot/skills/`, `~/.cursor/skills/`), or copy `AGENTS.md` into your
project root.

### Claude.ai and Claude Desktop

Zip each folder under `skills/` (the zip contains the folder with its `SKILL.md`) and upload it under
Settings → Capabilities → Skills. Upload `using-payway` first.

### Any other agent

Copy `AGENTS.md` into your project root.

## Verify installation

Start a new session and ask: "Which PayWay service should I use for a coffee shop?"
The agent should use `choosing-a-payway-service` and ask about your business one question at a time.

## The basic workflow

1. **using-payway** — notices PayWay work, sets the knowledge-base and hard rules, and routes to the
   right skill. Outputs: which skill comes next.
2. **choosing-a-payway-service** — asks about the business and walks the decision tree. Outputs: a
   confirmed business summary and a recommended service, with the rejected alternative. Writes no code.
3. **implementing-payway** — reads the service, API, example and security pages and writes the
   integration. Outputs: server-side code that follows the docs exactly.
4. **testing-payway-in-sandbox** — runs or guides a sandbox payment. Outputs: an automated sandbox test
   or a confirmed manual sandbox payment and callback.
5. **payway-go-live-review** — checks the code against the go-live checklist. Outputs: pass/fail per
   item with file/line evidence.

## What's inside

| Skill | Triggers when… |
|---|---|
| `using-payway` | You mention ABA PayWay, PayWay, ABA payments, KHQR or accepting payments in Cambodia |
| `choosing-a-payway-service` | You want to accept payments with PayWay but haven't picked a service |
| `implementing-payway` | You're writing or changing code that calls PayWay APIs for a chosen service |
| `testing-payway-in-sandbox` | An integration is written and needs verifying in the sandbox |
| `payway-go-live-review` | You're preparing for production, or ask to review or audit PayWay code |
| `debugging-payway` | A PayWay call fails — hash mismatch, error code, rejected request, missing callback |

**Command:** `/payway [what you're building]` runs the whole workflow from the start (Claude Code).

**Knowledge base:** the pages under `docs/`, published at https://seabnavin19.github.io/payway-skill.
Agents start from its index, `llms.txt`.

## Updating

- **Claude Code:** `/plugin marketplace update payway-skill`
- **Gemini CLI:** `gemini extensions update payway`
- **Copied installs:** pull this repository and copy the files again.

## For the PayWay team: edit the knowledge base

You never need to install anything.

1. Open any page on the site and click **Edit this page** (or open the file under `docs/` on GitHub).
2. Edit, then **Propose changes** → **Create pull request**.
3. Wait for the green ✓. If you see a red ✗, open **Details** — it lists each problem as
   `file: what is wrong`.
4. A code owner approves and merges. The site updates within a few minutes.

**New page:** copy the matching file from `templates/` into the right `docs/` folder.
**Verifying a draft:** check it against the sandbox, then set `status: verified`,
`verified_by: <name>`, `verified_on: <YYYY-MM-DD>`. Remaining drafts: `/guides/drafts`.
**Never rename or move a file under `docs/`** — agents and other pages link to it by path.

## Migrating from payway-agent-kit

This repository replaces `seabnavin19/payway-agent-kit`. Uninstall the old plugin with
`/plugin uninstall payway-agent-kit@payway-agent-kit`, then install as described above.

## License

MIT
