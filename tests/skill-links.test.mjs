import { test } from 'node:test'
import assert from 'node:assert/strict'
import { readFileSync, readdirSync, existsSync } from 'node:fs'
import matter from 'gray-matter'

const SKILLS = readdirSync('skills').map(d => `skills/${d}/SKILL.md`)
const COMMANDS = readdirSync('commands').map(f => `commands/${f}`)
const files = [...SKILLS, ...COMMANDS, 'AGENTS.md']

test('six skills, each with matching name and a real description', () => {
  assert.equal(SKILLS.length, 6)
  for (const f of SKILLS) {
    const { data } = matter(readFileSync(f, 'utf8'))
    assert.equal(data.name, f.split('/')[1], f)
    assert.ok(data.description?.length > 50, f)
    assert.ok(data.description.length <= 1024, f)
  }
})

test('every docs path referenced by skills, commands and AGENTS.md exists', () => {
  const missing = []
  for (const f of files) {
    const text = readFileSync(f, 'utf8')
    for (const [, p] of text.matchAll(/`((?:guides|services|apis|examples|best-practices)\/[^`*<>]+?\.md)`/g)) {
      if (!existsSync(`docs/${p}`)) missing.push(`${f} → docs/${p}`)
    }
  }
  assert.deepEqual(missing, [])
})

test('every skill named in using-payway exists', () => {
  const text = readFileSync('skills/using-payway/SKILL.md', 'utf8')
  for (const s of SKILLS.map(f => f.split('/')[1]).filter(n => n !== 'using-payway')) {
    assert.match(text, new RegExp(s), `using-payway does not route to ${s}`)
  }
})

test('manifests agree on names', () => {
  const plugin = JSON.parse(readFileSync('.claude-plugin/plugin.json', 'utf8'))
  const market = JSON.parse(readFileSync('.claude-plugin/marketplace.json', 'utf8'))
  assert.equal(plugin.name, 'payway')
  assert.equal(market.name, 'payway-skill')
  assert.equal(market.plugins[0].name, 'payway')
  assert.equal(market.plugins[0].source, './')
  assert.ok(existsSync(JSON.parse(readFileSync('gemini-extension.json', 'utf8')).contextFileName))
})
