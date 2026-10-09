import { readFileSync, readdirSync } from 'node:fs'
import { join, relative, sep } from 'node:path'
import matter from 'gray-matter'

export function loadPage(docsDir, file) {
  const raw = readFileSync(file, 'utf8').replace(/\r\n/g, '\n')
  const rel = relative(docsDir, file).split(sep).join('/')
  const url = '/' + rel.replace(/(^|\/)index\.md$/, '$1').replace(/\.md$/, '')
  try {
    const { data, content } = matter(raw)
    return { rel, url, data, body: content, raw }
  } catch (e) {
    return { rel, url, data: null, body: '', raw, error: `invalid frontmatter: ${e.reason ?? e.message}` }
  }
}

export function loadPages(docsDir) {
  return readdirSync(docsDir, { recursive: true })
    .map(f => String(f))
    .filter(f => f.endsWith('.md') && !f.split(/[\\/]/).some(part => part.startsWith('.')))
    .map(f => loadPage(docsDir, join(docsDir, f)))
    .sort((a, b) => a.rel.localeCompare(b.rel))
}
