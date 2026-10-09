import { createHmac } from 'node:crypto'

// PayWay signs requests with HMAC-SHA512, base64-encoded, over the field values
// concatenated in the exact order given in each API page's "Authentication & hash"
// section. Pass values as the exact strings you send (e.g. "10.00", not 10).
// Server-side only: the API key must never reach the browser.
export function paywayHash(values, apiKey) {
  const message = values.map(v => v ?? '').join('')
  return createHmac('sha512', apiKey).update(message, 'utf8').digest('base64')
}
