#!/usr/bin/env node
/**
 * Bring the whole stack up and hold it there until killed (Ctrl-C / SIGTERM).
 * Used by the adversarial audit, which probes a live system rather than
 * reading code. Same lifecycle guarantees as run-proof.mjs: ports cleared
 * first, fail-fast if a service dies, whole process groups killed on exit.
 */
import { startAll, stopAll, URLS } from './lib/services.mjs'

const TTL = Number(process.env.TOKEN_TTL_SECONDS || 120)
let closing = false
const shutdown = async () => {
  if (closing) return
  closing = true
  console.log('\nshutting down...')
  await stopAll()
  process.exit(0)
}
process.on('SIGINT', shutdown)
process.on('SIGTERM', shutdown)

await startAll({ tokenTtl: TTL })
console.log('STACK READY')
console.log(JSON.stringify(URLS, null, 2))
console.log('\nHolding. Send SIGTERM to tear down.')
setInterval(() => {}, 1 << 30)
