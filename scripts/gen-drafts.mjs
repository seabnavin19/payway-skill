import { mkdirSync, writeFileSync } from 'node:fs'
import { loadPages } from './lib/pages.mjs'
import { buildDraftsPage } from './lib/agent-files.mjs'

const today = new Date().toISOString().slice(0, 10)
mkdirSync('docs/guides', { recursive: true })
writeFileSync('docs/guides/drafts.md', buildDraftsPage(loadPages('docs'), today))
