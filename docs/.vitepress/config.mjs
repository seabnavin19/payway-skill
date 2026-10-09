import { fileURLToPath } from 'node:url'
import { defineConfig } from 'vitepress'
import { loadPages } from '../../scripts/lib/pages.mjs'
import { writeAgentFiles } from '../../scripts/lib/agent-files.mjs'

// `||` not `??`: CI passes an empty string when the repo variable is unset
const BASE_URL = process.env.DOCS_BASE_URL || 'https://seabnavin19.github.io/payway-skill'
const REPO = process.env.GITHUB_REPOSITORY ?? 'seabnavin19/payway-skill'
const SECTIONS = [
  ['guide', 'Guides'],
  ['service', 'Services'],
  ['api', 'API reference'],
  ['example', 'Code examples'],
  ['best-practice', 'Best practices'],
]

function sidebar() {
  const pages = loadPages(fileURLToPath(new URL('..', import.meta.url)))
    .filter(p => p.data && p.rel !== 'index.md')
  return SECTIONS.map(([type, text]) => ({
    text,
    collapsed: type !== 'guide',
    items: pages.filter(p => p.data.type === type).map(p => ({ text: p.data.title, link: p.url })),
  })).filter(s => s.items.length)
}

export default defineConfig({
  base: '/payway-skill/',
  title: 'PayWay AI Knowledge Base',
  description: 'Integration knowledge for ABA PayWay, for developers and AI coding agents.',
  cleanUrls: true,
  lastUpdated: true,
  ignoreDeadLinks: [/^\/llms\.txt$/], // generated in buildEnd, after VitePress's link check
  themeConfig: {
    sidebar: sidebar(),
    search: { provider: 'local' },
    editLink: { pattern: `https://github.com/${REPO}/edit/master/docs/:path`, text: 'Edit this page' },
    socialLinks: [{ icon: 'github', link: `https://github.com/${REPO}` }],
  },
  buildEnd(siteConfig) {
    writeAgentFiles(siteConfig.srcDir, siteConfig.outDir, BASE_URL)
  },
})
