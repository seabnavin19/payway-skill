import { loadPages } from './lib/pages.mjs'
import { checkSite } from './lib/check.mjs'

const errs = checkSite(loadPages('docs'), 'docs')
if (errs.length) {
  console.error(`Found ${errs.length} problem(s) in the docs:\n` + errs.map(e => `  - ${e}`).join('\n'))
  process.exit(1)
}
console.log('All docs pages pass.')
