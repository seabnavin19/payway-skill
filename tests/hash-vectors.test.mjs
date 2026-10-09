import { test } from 'node:test'
import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import { paywayHash } from '../docs/examples/node/payway-hash.mjs'

const vectors = JSON.parse(readFileSync(new URL('../test-vectors/hash.json', import.meta.url), 'utf8'))

for (const v of vectors) {
  test(`node hash: ${v.name}`, () => {
    assert.equal(paywayHash(v.values, v.api_key), v.expected)
  })
}

test('null/undefined count as empty string', () => {
  assert.equal(paywayHash(['a', null, undefined, 'b'], 'k'), paywayHash(['a', '', '', 'b'], 'k'))
})
