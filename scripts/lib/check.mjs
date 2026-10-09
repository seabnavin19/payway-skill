import { existsSync } from 'node:fs'
import { join, posix } from 'node:path'

export const TYPES = ['guide', 'service', 'api', 'example', 'best-practice']
export const REQUIRED_SECTIONS = {
  api: ['Endpoint', 'Authentication & hash', 'Request fields', 'Response', 'Errors', 'Pitfalls'],
  service: ['When to use', 'When not to use', 'Flow', 'APIs involved', 'Sandbox testing', 'Examples', 'Best practices'],
  example: ['Prerequisites', 'Code', 'How to run'],
}
const STATUSES = ['draft', 'verified']
const LANGUAGES = ['node', 'python', 'web']
const REQUIRED_FIELDS = ['id', 'type', 'title', 'summary', 'status']
const empty = v => v == null || v === ''

export function stripFences(md) {
  return md.replace(/^```[\s\S]*?^```[^\n]*$/gm, '').replace(/`[^`\n]*`/g, '')
}

export function resolveLink(fromRel, target) {
  if (/^[a-z][a-z0-9+.-]*:/i.test(target)) return null
  const clean = target.split('#')[0].split('?')[0]
  if (!clean) return null
  if (/\.[a-z0-9]+$/i.test(clean) && !/\.(md|html)$/i.test(clean)) return null // static file, e.g. /llms.txt
  const abs = clean.startsWith('/') ? clean : posix.join('/', posix.dirname(fromRel), clean)
  return abs.replace(/\.(md|html)$/, '').replace(/\/index$/, '/')
}

export function checkPage(page) {
  const errs = []
  const e = msg => errs.push(`${page.rel}: ${msg}`)
  if (page.error) { e(page.error); return errs }
  const d = page.data ?? {}

  for (const f of REQUIRED_FIELDS) if (empty(d[f])) e(`missing frontmatter field "${f}"`)
  if (!empty(d.type) && !TYPES.includes(d.type)) e(`unknown type "${d.type}" (use one of: ${TYPES.join(', ')})`)
  if (!empty(d.status) && !STATUSES.includes(d.status)) e(`unknown status "${d.status}" (use draft or verified)`)
  if (d.status === 'verified') {
    for (const f of ['verified_by', 'verified_on']) if (empty(d[f])) e(`status is verified but "${f}" is empty`)
  }
  if (d.type === 'example' && !LANGUAGES.includes(d.language)) {
    e(`example pages need "language" set to one of: ${LANGUAGES.join(', ')}`)
  }
  if (d.related != null && !Array.isArray(d.related)) e('"related" must be a list, e.g. [security, checkout-purchase]')

  const expected = REQUIRED_SECTIONS[d.type] ?? []
  const headings = [...stripFences(page.body).matchAll(/^## +(.+?)\s*$/gm)].map(m => m[1])
  const missing = expected.filter(s => !headings.includes(s))
  for (const s of missing) e(`missing section "## ${s}"`)
  if (!missing.length) {
    const actual = headings.filter(h => expected.includes(h))
    if (actual.join('|') !== expected.join('|')) e(`sections out of order, expected: ${expected.join(' → ')}`)
  }
  return errs
}

export function checkSite(pages, docsDir) {
  const errs = pages.flatMap(checkPage)
  const urls = new Set(pages.map(p => p.url))
  const firstById = new Map()
  for (const p of pages) {
    const id = p.data?.id
    if (empty(id)) continue
    if (firstById.has(id)) errs.push(`${p.rel}: duplicate id "${id}" (also in ${firstById.get(id)})`)
    else firstById.set(id, p.rel)
  }
  for (const p of pages) {
    for (const r of Array.isArray(p.data?.related) ? p.data.related : []) {
      if (!firstById.has(r)) errs.push(`${p.rel}: related id "${r}" not found`)
    }
    const text = stripFences(p.body)
    for (const [, target] of text.matchAll(/\]\(([^)\s]+)(?:\s+"[^"]*")?\)/g)) {
      const url = resolveLink(p.rel, target)
      if (url && !urls.has(url)) errs.push(`${p.rel}: broken link "${target}"`)
    }
    for (const [, file] of p.body.matchAll(/^<<< @\/([^\s{#]+)/gm)) {
      if (!existsSync(join(docsDir, file))) errs.push(`${p.rel}: snippet file not found "${file}"`)
    }
  }
  return errs
}
