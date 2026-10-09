import { test } from 'node:test'
import assert from 'node:assert/strict'
import { mkdtempSync, writeFileSync, mkdirSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { checkPage, checkSite, resolveLink } from '../scripts/lib/check.mjs'

const base = { id: 'p', type: 'guide', title: 'T', summary: 'S', status: 'draft' }
const page = (data, body = '', rel = 'guides/p.md') =>
  ({ rel, url: '/' + rel.replace(/\.md$/, ''), data, body, raw: body })

const API_BODY = ['Endpoint', 'Authentication & hash', 'Request fields', 'Response', 'Errors', 'Pitfalls']
  .map(s => `## ${s}\n`).join('\n')

test('valid guide passes', () => {
  assert.deepEqual(checkPage(page(base)), [])
})

test('missing required field is named', () => {
  const { summary, ...noSummary } = base
  assert.deepEqual(checkPage(page(noSummary)), ['guides/p.md: missing frontmatter field "summary"'])
})

test('unknown type and status are named', () => {
  const errs = checkPage(page({ ...base, type: 'faq', status: 'done' }))
  assert.ok(errs.some(e => e.includes('unknown type "faq"')))
  assert.ok(errs.some(e => e.includes('unknown status "done"')))
})

test('verified needs verified_by and verified_on', () => {
  const errs = checkPage(page({ ...base, status: 'verified' }))
  assert.ok(errs.some(e => e.includes('"verified_by"')))
  assert.ok(errs.some(e => e.includes('"verified_on"')))
})

test('verified_on as YAML date is accepted', () => {
  const d = { ...base, status: 'verified', verified_by: 'a', verified_on: new Date('2026-10-05') }
  assert.deepEqual(checkPage(page(d)), [])
})

test('api page needs all sections', () => {
  assert.deepEqual(checkPage(page({ ...base, type: 'api' }, API_BODY)), [])
  const errs = checkPage(page({ ...base, type: 'api' }, API_BODY.replace('## Errors\n', '')))
  assert.deepEqual(errs, ['guides/p.md: missing section "## Errors"'])
})

test('sections out of order are reported', () => {
  const swapped = API_BODY.replace('## Endpoint', '## TMP').replace('## Pitfalls', '## Endpoint').replace('## TMP', '## Pitfalls')
  const errs = checkPage(page({ ...base, type: 'api' }, swapped))
  assert.ok(errs[0].includes('sections out of order'))
})

test('headings inside code fences do not count', () => {
  const body = '```md\n' + API_BODY + '```\n'
  assert.equal(checkPage(page({ ...base, type: 'api' }, body)).length, 6)
})

test('example needs a known language', () => {
  const body = '## Prerequisites\n## Code\n## How to run\n'
  const errs = checkPage(page({ ...base, type: 'example', language: 'php' }, body))
  assert.ok(errs[0].includes('"language"'))
})

test('missing frontmatter entirely gives readable errors', () => {
  const errs = checkPage(page({}))
  assert.equal(errs.length, 5)
  assert.ok(errs.every(e => e.startsWith('guides/p.md: missing frontmatter field')))
})

test('loader error is passed through', () => {
  const errs = checkPage({ rel: 'x.md', error: 'invalid frontmatter: bad' })
  assert.deepEqual(errs, ['x.md: invalid frontmatter: bad'])
})

test('resolveLink handles relative, absolute, anchors, .md and index', () => {
  assert.equal(resolveLink('services/a/b.md', '../../apis/x.md#fields'), '/apis/x')
  assert.equal(resolveLink('guides/p.md', '/apis/x'), '/apis/x')
  assert.equal(resolveLink('guides/p.md', 'security'), '/guides/security')
  assert.equal(resolveLink('guides/p.md', '../index.md'), '/')
  assert.equal(resolveLink('guides/p.md', '#top'), null)
  assert.equal(resolveLink('guides/p.md', 'https://x.com/a'), null)
  assert.equal(resolveLink('guides/p.md', 'mailto:a@b.c'), null)
  assert.equal(resolveLink('index.md', '/llms.txt'), null)
})

test('checkSite reports broken links, duplicate ids, unknown related, missing snippets', () => {
  const dir = mkdtempSync(join(tmpdir(), 'kb-'))
  mkdirSync(join(dir, 'examples/node'), { recursive: true })
  writeFileSync(join(dir, 'examples/node/ok.mjs'), 'x')
  const pages = [
    page({ ...base, id: 'a', related: ['b', 'ghost'] },
      '[ok](b.md) [ok2](./b#x) [bad](missing.md) `[not](a-link.md)`\n<<< @/examples/node/ok.mjs\n<<< @/examples/node/gone.mjs\n',
      'guides/a.md'),
    page({ ...base, id: 'b' }, '', 'guides/b.md'),
    page({ ...base, id: 'b' }, '', 'guides/c.md'),
  ]
  const errs = checkSite(pages, dir)
  assert.deepEqual(errs.sort(), [
    'guides/a.md: broken link "missing.md"',
    'guides/a.md: related id "ghost" not found',
    'guides/a.md: snippet file not found "examples/node/gone.mjs"',
    'guides/c.md: duplicate id "b" (also in guides/b.md)',
  ])
})
