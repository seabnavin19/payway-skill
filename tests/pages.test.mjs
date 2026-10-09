import { test } from 'node:test'
import assert from 'node:assert/strict'
import { mkdtempSync, mkdirSync, writeFileSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { loadPages } from '../scripts/lib/pages.mjs'

function fixture(files) {
  const dir = mkdtempSync(join(tmpdir(), 'kb-'))
  for (const [rel, text] of Object.entries(files)) {
    mkdirSync(join(dir, rel, '..'), { recursive: true })
    writeFileSync(join(dir, rel), text)
  }
  return dir
}

test('parses frontmatter, body and url', () => {
  const dir = fixture({ 'apis/x.md': '---\nid: x\ntype: api\n---\n## Endpoint\n' })
  const [p] = loadPages(dir)
  assert.equal(p.rel, 'apis/x.md')
  assert.equal(p.url, '/apis/x')
  assert.equal(p.data.id, 'x')
  assert.match(p.body, /^## Endpoint$/m)
})

test('index pages map to directory urls', () => {
  const dir = fixture({ 'index.md': '# Home\n', 'guides/index.md': '# G\n' })
  assert.deepEqual(loadPages(dir).map(p => p.url), ['/guides/', '/'])
})

test('CRLF files parse the same as LF', () => {
  const dir = fixture({ 'a.md': '---\r\nid: a\r\n---\r\n## Endpoint\r\n' })
  const [p] = loadPages(dir)
  assert.equal(p.data.id, 'a')
  assert.ok(!p.body.includes('\r'))
  assert.match(p.body, /^## Endpoint$/m)
})

test('invalid YAML is reported, not thrown', () => {
  const dir = fixture({ 'bad.md': '---\nid: [unclosed\n---\nbody\n' })
  const [p] = loadPages(dir)
  assert.equal(p.data, null)
  assert.match(p.error, /invalid frontmatter/)
})
