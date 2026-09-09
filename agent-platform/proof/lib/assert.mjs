// Minimal assertion + reporting layer for the acceptance harness.
// Every check is recorded as evidence, whether it passes or fails, so the
// final report can show WHY something is considered proven.

export const results = []

let current = null

export function test(id, title, critical = false) {
  current = { id, title, critical, checks: [], status: 'pending', error: null }
  results.push(current)
  return current
}

export function evidence(label, value) {
  if (!current) throw new Error('evidence() called outside a test')
  current.checks.push({ label, value: String(value).slice(0, 400) })
}

export function check(label, condition, detail = '') {
  if (!current) throw new Error('check() called outside a test')
  const ok = Boolean(condition)
  current.checks.push({ label, ok, detail: String(detail).slice(0, 400) })
  if (!ok) throw new Error(`FAILED CHECK: ${label}${detail ? ` -- ${detail}` : ''}`)
  return ok
}

export function pass() { if (current) current.status = 'pass' }
export function fail(err) {
  if (current) { current.status = 'fail'; current.error = err?.message || String(err) }
}
export function skip(reason) {
  if (current) { current.status = 'skip'; current.error = reason }
}

export function report() {
  const line = '='.repeat(78)
  console.log(`\n${line}\nACCEPTANCE RESULTS\n${line}`)
  for (const r of results) {
    const mark = r.status === 'pass' ? 'PASS' : r.status === 'fail' ? 'FAIL' : 'SKIP'
    const crit = r.critical ? '  *** CRITICAL ***' : ''
    console.log(`\n[${mark}] ${r.id}. ${r.title}${crit}`)
    for (const c of r.checks) {
      if ('ok' in c) console.log(`        ${c.ok ? 'ok  ' : 'BAD '} ${c.label}${c.detail ? `  (${c.detail})` : ''}`)
      else console.log(`        --   ${c.label}: ${c.value}`)
    }
    if (r.error) console.log(`        ERROR: ${r.error}`)
  }
  const passed = results.filter(r => r.status === 'pass').length
  const failed = results.filter(r => r.status === 'fail').length
  const skipped = results.filter(r => r.status === 'skip').length
  console.log(`\n${line}\n${passed} passed, ${failed} failed, ${skipped} skipped, of ${results.length} acceptance tests\n${line}`)
  return { passed, failed, skipped, total: results.length }
}
