import { readFileSync, writeFileSync, mkdirSync } from 'node:fs'
import { join, dirname, extname } from 'node:path'
import { loadPages } from './pages.mjs'

const FENCE_LANG = { '.mjs': 'js', '.js': 'js', '.py': 'python', '.html': 'html' }
const GROUPS = [
  ['guide', 'Guides'],
  ['service', 'Services'],
  ['api', 'API reference'],
  ['example', 'Code examples'],
  ['best-practice', 'Best practices'],
]

export function inlineSnippets(md, docsDir) {
  return md.replace(/^<<< @\/([^\s{#]+).*$/gm, (_, file) => {
    let code
    try { code = readFileSync(join(docsDir, file), 'utf8') }
    catch { throw new Error(`snippet file not found "${file}"`) }
    const lang = FENCE_LANG[extname(file)] ?? extname(file).slice(1)
    return '```' + lang + '\n' + code.replace(/\r\n/g, '\n').trimEnd() + '\n```'
  })
}

export function buildLlmsTxt(pages, baseUrl) {
  const ok = pages.filter(p => !p.error && p.data)
  const lines = [
    '# PayWay Integration Knowledge Base',
    '',
    '> Official knowledge for integrating ABA PayWay. Fetch only the pages you need.',
    '> Pages marked DRAFT are unverified — tell the developer when you rely on them.',
  ]
  for (const [type, heading] of GROUPS) {
    const group = ok.filter(p => p.data.type === type)
    if (!group.length) continue
    lines.push('', `## ${heading}`, '')
    for (const p of group) {
      const draft = p.data.status === 'draft' ? ' (DRAFT — unverified)' : ''
      lines.push(`- [${p.data.title}](${baseUrl}/${p.rel}): ${p.data.summary}${draft}`)
    }
  }
  return lines.join('\n') + '\n'
}

export function buildDraftsPage(pages, today) {
  const drafts = pages.filter(p => p.data?.status === 'draft' && p.rel !== 'guides/drafts.md')
  const rows = drafts.map(p => {
    const src = p.data.source ? `[official page](${p.data.source})` : '—'
    return `| [${p.data.title}](${p.url}) | ${p.data.type} | ${src} |`
  })
  return [
    '---',
    'id: drafts',
    'type: guide',
    'title: Pages waiting for verification',
    'summary: Auto-generated list of draft pages the PayWay team still needs to verify.',
    'status: verified',
    'verified_by: auto-generated',
    `verified_on: ${today}`,
    '---',
    '',
    '# Pages waiting for verification',
    '',
    `${drafts.length} page(s) are still drafts. To verify one: check it against the sandbox, then edit it and set`,
    '`status: verified`, `verified_by: <your name>`, `verified_on: <YYYY-MM-DD>`.',
    '',
    '| Page | Type | Source |',
    '|---|---|---|',
    ...rows,
    '',
  ].join('\n')
}

export function writeAgentFiles(docsDir, outDir, baseUrl) {
  const pages = loadPages(docsDir)
  for (const p of pages) {
    const dest = join(outDir, p.rel)
    mkdirSync(dirname(dest), { recursive: true })
    writeFileSync(dest, inlineSnippets(p.raw, docsDir))
  }
  writeFileSync(join(outDir, 'llms.txt'), buildLlmsTxt(pages, baseUrl))
}
