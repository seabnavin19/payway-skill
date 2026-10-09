import { test } from 'node:test'
import assert from 'node:assert/strict'
import { mkdtempSync, mkdirSync, writeFileSync, readFileSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { inlineSnippets, buildLlmsTxt, buildDraftsPage, writeAgentFiles } from '../scripts/lib/agent-files.mjs'

const page = (rel, data) => ({ rel, url: '/' + rel.replace(/\.md$/, ''), data, body: '', raw: '' })

test('inlineSnippets replaces <<< with fenced file content', () => {
  const dir = mkdtempSync(join(tmpdir(), 'kb-'))
  mkdirSync(join(dir, 'examples/python'), { recursive: true })
  writeFileSync(join(dir, 'examples/python/h.py'), 'print(1)\r\n')
  const out = inlineSnippets('before\n<<< @/examples/python/h.py\nafter', dir)
  assert.equal(out, 'before\n```python\nprint(1)\n```\nafter')
})

test('inlineSnippets throws on missing file', () => {
  assert.throws(() => inlineSnippets('<<< @/nope.mjs', tmpdir()), /snippet file not found "nope.mjs"/)
})

test('llms.txt groups by type, marks drafts, uses absolute .md urls', () => {
  const txt = buildLlmsTxt([
    page('apis/x.md', { type: 'api', title: 'X', summary: 'Does X.', status: 'draft' }),
    page('guides/security.md', { type: 'guide', title: 'Security', summary: 'Sign things.', status: 'verified' }),
  ], 'https://kb.test')
  assert.match(txt, /^# PayWay Integration Knowledge Base$/m)
  assert.ok(txt.indexOf('## Guides') < txt.indexOf('## API reference'))
  assert.match(txt, /^- \[Security\]\(https:\/\/kb\.test\/guides\/security\.md\): Sign things\.$/m)
  assert.match(txt, /^- \[X\]\(https:\/\/kb\.test\/apis\/x\.md\): Does X\. \(DRAFT — unverified\)$/m)
})

test('llms.txt skips pages with load errors', () => {
  const txt = buildLlmsTxt([{ rel: 'bad.md', data: null, error: 'x' }], 'https://kb.test')
  assert.ok(!txt.includes('bad.md'))
})

test('drafts page lists only drafts, excluding itself', () => {
  const md = buildDraftsPage([
    page('apis/x.md', { type: 'api', title: 'X', status: 'draft', source: 'https://p/x' }),
    page('guides/security.md', { type: 'guide', title: 'S', status: 'verified' }),
    page('guides/drafts.md', { type: 'guide', title: 'D', status: 'draft' }),
  ], '2026-10-05')
  assert.match(md, /^id: drafts$/m)
  assert.match(md, /\| \[X\]\(\/apis\/x\) \| api \| \[official page\]\(https:\/\/p\/x\) \|/)
  assert.ok(!md.includes('security'))
  assert.ok(!md.includes('[D]'))
})

test('writeAgentFiles writes raw md with snippets inlined, plus llms.txt', () => {
  const docs = mkdtempSync(join(tmpdir(), 'kb-'))
  const out = mkdtempSync(join(tmpdir(), 'out-'))
  mkdirSync(join(docs, 'examples/node'), { recursive: true })
  writeFileSync(join(docs, 'examples/node/a.mjs'), 'export const a = 1\n')
  writeFileSync(join(docs, 'examples/node/a.md'),
    '---\nid: a\ntype: example\ntitle: A\nsummary: S\nstatus: draft\nlanguage: node\n---\n<<< @/examples/node/a.mjs\n')
  writeAgentFiles(docs, out, 'https://kb.test')
  assert.match(readFileSync(join(out, 'examples/node/a.md'), 'utf8'), /```js\nexport const a = 1\n```/)
  assert.match(readFileSync(join(out, 'llms.txt'), 'utf8'), /kb\.test\/examples\/node\/a\.md/)
})
