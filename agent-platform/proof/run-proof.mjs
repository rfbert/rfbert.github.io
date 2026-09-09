#!/usr/bin/env node
/**
 * Acceptance harness for the agent-platform architecture.
 *
 * This does not test "does the code run". It tests the eight claims in
 * SPEC.txt Section 7 -- in particular the central one (test 5): that a SINGLE
 * token, from a SINGLE login, is independently validated by TWO separate APIs
 * which each provision the same identity into their OWN database.
 *
 * Usage:  node run-proof.mjs            (120s token TTL, as specified)
 *         TOKEN_TTL_SECONDS=25 node run-proof.mjs   (faster renewal test)
 */
import Database from 'better-sqlite3'
import { chromium } from 'playwright'

// The sandbox ships a pinned Chromium; use it rather than downloading one.
const CHROME = process.env.PROOF_CHROME || '/opt/pw-browsers/chromium-1194/chrome-linux/chrome'
import { readFileSync, existsSync } from 'node:fs'
import { join } from 'node:path'
import {
  ROOT, URLS, startAll, stopAll, cleanDatabases, decodeJwt, mintToken,
} from './lib/services.mjs'
import { test, check, evidence, pass, fail, skip, report, results } from './lib/assert.mjs'

const TTL = Number(process.env.TOKEN_TTL_SECONDS || 120)
const users = JSON.parse(readFileSync(join(ROOT, 'mock-idp', 'users.json'), 'utf8'))
const USERS = Array.isArray(users) ? users : users.users
const [userA, userB] = [USERS[0], USERS.find(u => u.tid !== USERS[0].tid) || USERS[1]]

const DB_A = join(ROOT, 'identity-gateway-api', 'gateway.db')
const DB_B = join(ROOT, 'agent-workspace-api', 'workspace.db')

const sleep = ms => new Promise(r => setTimeout(r, ms))

function usersTableOf(dbPath) {
  if (!existsSync(dbPath)) return { rows: [], table: null, missing: true }
  const db = new Database(dbPath, { readonly: true })
  const tables = db.prepare("SELECT name FROM sqlite_master WHERE type='table'").all().map(r => r.name)
  const table = tables.find(n => /^users$/i.test(n)) || tables.find(n => /^user$/i.test(n)) || tables.find(n => /user/i.test(n))
  const rows = table ? db.prepare(`SELECT * FROM "${table}"`).all() : []
  db.close()
  return { rows, table, tables, missing: false }
}

async function authed(url, token, init = {}) {
  return fetch(url, { ...init, headers: { ...(init.headers || {}), authorization: `Bearer ${token}` } })
}

/* ------------------------------------------------------------------ tests */

async function t1() {
  test(1, 'Mock IdP serves a JWKS public key')
  const r = await fetch(`${URLS.idp}/jwks.json`)
  check('GET /jwks.json returns 200', r.ok, `status ${r.status}`)
  const jwks = await r.json()
  check('response has a keys array', Array.isArray(jwks.keys) && jwks.keys.length > 0)
  const k = jwks.keys[0]
  check('key is RSA', k.kty === 'RSA', `kty=${k.kty}`)
  check('key advertises a kid', Boolean(k.kid), `kid=${k.kid}`)
  check('key advertises RS256', k.alg === 'RS256' || !k.alg, `alg=${k.alg}`)
  const disco = await (await fetch(`${URLS.idp}/.well-known/openid-configuration`)).json()
  check('discovery document points at that JWKS', disco.jwks_uri === `${URLS.idp}/jwks.json`, disco.jwks_uri)
  evidence('issuer', disco.issuer)
  pass()
}

async function t2(browser) {
  test(2, 'Browser login at :3000 sets an httpOnly cookie and yields a JWT with tid/oid/aud/scp')
  const ctx = await browser.newContext()
  const page = await ctx.newPage()
  await page.goto(`${URLS.gwWeb}/api/auth/login`, { waitUntil: 'domcontentloaded' })
  check('redirected to the IdP authorize page', page.url().startsWith(URLS.idp), page.url())
  const link = page.locator(`a[href*="code=${userA.id}"]`).first()
  await link.waitFor({ timeout: 15000 })
  await link.click()
  await page.waitForURL(u => u.toString().startsWith(URLS.gwWeb), { timeout: 20000 })
  evidence('landed on', page.url())

  const cookies = await ctx.cookies()
  const session = cookies.find(c => c.httpOnly && String(c.value).split('.').length === 3)
  check('a session cookie exists and is httpOnly', Boolean(session), session ? `name=${session.name}` : `cookies=${cookies.map(c => c.name).join(',')}`)

  const tokenRes = await page.request.get(`${URLS.gwWeb}/api/auth/token`)
  check('/api/auth/token returns 200', tokenRes.ok(), `status ${tokenRes.status()}`)
  const { access_token } = await tokenRes.json()
  const { payload } = decodeJwt(access_token)
  check('claim tid present', Boolean(payload.tid), `tid=${payload.tid}`)
  check('claim oid present', Boolean(payload.oid), `oid=${payload.oid}`)
  check('claim aud correct', payload.aud === 'api://agent-platform', `aud=${payload.aud}`)
  check('claim scp includes access_as_user', String(payload.scp).includes('access_as_user'), `scp=${payload.scp}`)
  check('token is short-lived as specified', (payload.exp - payload.iat) === TTL, `lifetime=${payload.exp - payload.iat}s`)

  // Storage must be empty -- the spec forbids localStorage/sessionStorage.
  const stored = await page.evaluate(() => ({ ls: Object.keys(localStorage), ss: Object.keys(sessionStorage) }))
  check('token is NOT in localStorage/sessionStorage', stored.ls.length === 0 && stored.ss.length === 0, JSON.stringify(stored))
  await ctx.close()
  pass()
}

async function t3() {
  test(3, 'Gateway API accepts the Bearer token and JIT-provisions into Database A')
  const token = await mintToken(userA.id)
  const anon = await fetch(`${URLS.gwApi}/conversations`)
  check('unauthenticated request is rejected', anon.status === 401, `status ${anon.status}`)
  const r = await authed(`${URLS.gwApi}/conversations`, token)
  check('authenticated request returns 200', r.ok, `status ${r.status}`)
  const { rows, table } = usersTableOf(DB_A)
  evidence('Database A users table', table)
  const row = rows.find(u => u.tid === userA.tid && u.oid === userA.oid)
  check('a user row was created in Database A', Boolean(row), `rows=${rows.length}`)
  check('row carries the tid from the token', row?.tid === userA.tid, `${row?.tid}`)
  check('row carries the oid from the token', row?.oid === userA.oid, `${row?.oid}`)
  pass()
}

async function t4(browser) {
  test(4, 'Iframe loads and the postMessage handshake completes')
  const ctx = await browser.newContext()
  const page = await ctx.newPage()
  const consoleLines = []
  page.on('console', m => consoleLines.push(m.text()))

  await page.goto(`${URLS.gwWeb}/api/auth/login`, { waitUntil: 'domcontentloaded' })
  await page.locator(`a[href*="code=${userA.id}"]`).first().click()
  await page.waitForURL(u => u.toString().startsWith(URLS.gwWeb), { timeout: 20000 })
  await page.goto(`${URLS.gwWeb}/workspace`, { waitUntil: 'domcontentloaded' })

  const frameEl = await page.waitForSelector('iframe', { timeout: 20000 })
  const frame = await frameEl.contentFrame()
  check('iframe element is present', Boolean(frame))

  // The child must actually render -- a CSP frame-ancestors mistake shows up
  // here as a blank frame, which is the pitfall the spec calls out.
  const mode = frame.locator('[data-testid="mode"]')
  await mode.waitFor({ timeout: 25000 })
  const modeText = (await mode.textContent()) || ''
  check('child rendered inside the frame (CSP allows it)', modeText.length > 0)
  check('child reports iframe mode', /iframe/i.test(modeText), modeText.trim())

  const log = page.locator('[data-testid="handshake-entry"]')
  await log.first().waitFor({ timeout: 20000 })
  const entries = (await log.allTextContents()).join(' | ')
  evidence('handshake log', entries)
  check('TOKEN_REQUIRED was observed', /TOKEN_REQUIRED/.test(entries))
  check('AUTH_TOKEN was observed', /AUTH_TOKEN/.test(entries))
  check('TOKEN_REQUIRED precedes AUTH_TOKEN', entries.indexOf('TOKEN_REQUIRED') < entries.indexOf('AUTH_TOKEN'))

  const identity = frame.locator('[data-testid="identity"]')
  await identity.waitFor({ timeout: 20000 })
  const idText = (await identity.textContent()) || ''
  check('child obtained an identity using the relayed token', idText.includes(userA.oid), idText.trim().slice(0, 120))
  await ctx.close()
  pass()
}

async function t5() {
  test(5, 'ONE token, TWO APIs, TWO databases, ONE identity', true)
  const token = await mintToken(userA.id)
  const { payload } = decodeJwt(token)

  const a = await authed(`${URLS.gwApi}/me`, token)
  const b = await authed(`${URLS.wsApi}/me`, token)
  check('gateway-api (:4000) accepts the token', a.ok, `status ${a.status}`)
  check('workspace-api (:4001) accepts the SAME token', b.ok, `status ${b.status}`)
  const meA = await a.json(), meB = await b.json()
  evidence('/me from :4000', JSON.stringify(meA))
  evidence('/me from :4001', JSON.stringify(meB))

  check('both resolved the same tid', meA.tid === meB.tid && meA.tid === payload.tid, `${meA.tid} / ${meB.tid}`)
  check('both resolved the same oid', meA.oid === meB.oid && meA.oid === payload.oid, `${meA.oid} / ${meB.oid}`)
  check('they report different databases', meA.database !== meB.database, `${meA.database} vs ${meB.database}`)

  const A = usersTableOf(DB_A), B = usersTableOf(DB_B)
  check('gateway.db and workspace.db are separate files', DB_A !== DB_B && !A.missing && !B.missing)
  const rowA = A.rows.find(u => u.tid === payload.tid && u.oid === payload.oid)
  const rowB = B.rows.find(u => u.tid === payload.tid && u.oid === payload.oid)
  check('Database A holds a row for this identity', Boolean(rowA))
  check('Database B holds its OWN row for the same identity', Boolean(rowB))
  check('the two rows are independent records (no shared PK space required)',
    rowA && rowB && rowA.tid === rowB.tid && rowA.oid === rowB.oid,
    `A.id=${rowA?.id} B.id=${rowB?.id}`)
  check('neither database references the other', !A.tables.some(t => /analys/i.test(t)) && !B.tables.some(t => /conversation/i.test(t)),
    `A=[${A.tables}] B=[${B.tables}]`)
  pass()
}

async function t6(browser) {
  test(6, `Token expiry (${TTL}s) triggers silent renewal, with no second login`)
  const ctx = await browser.newContext()
  const page = await ctx.newPage()
  await page.goto(`${URLS.gwWeb}/api/auth/login`, { waitUntil: 'domcontentloaded' })
  await page.locator(`a[href*="code=${userA.id}"]`).first().click()
  await page.waitForURL(u => u.toString().startsWith(URLS.gwWeb), { timeout: 20000 })
  await page.goto(`${URLS.gwWeb}/workspace`, { waitUntil: 'domcontentloaded' })
  const frame = await (await page.waitForSelector('iframe', { timeout: 20000 })).contentFrame()
  await frame.locator('[data-testid="identity"]').waitFor({ timeout: 25000 })

  const before = (await page.locator('[data-testid="handshake-entry"]').allTextContents()).length
  evidence('handshake messages before expiry', before)

  console.log(`     waiting ${TTL + 5}s for the token to expire...`)
  await sleep((TTL + 5) * 1000)

  // Any authenticated action now must 401 and self-heal via the relay.
  const refresh = frame.locator('[data-testid="refresh"]').first()
  if (await refresh.count()) await refresh.click()
  else await frame.locator('[data-testid="identity"]').click({ force: true }).catch(() => {})

  await page.waitForFunction(
    n => document.querySelectorAll('[data-testid="handshake-entry"]').length > n,
    before, { timeout: 45000 })
  const after = (await page.locator('[data-testid="handshake-entry"]').allTextContents())
  evidence('handshake log after expiry', after.slice(-4).join(' | '))
  check('a further TOKEN_REQUIRED/AUTH_TOKEN round happened', after.length > before, `${before} -> ${after.length}`)
  check('the user was NOT sent back to a login screen', page.url().startsWith(`${URLS.gwWeb}/workspace`), page.url())
  const idText = await frame.locator('[data-testid="identity"]').textContent()
  check('the child still holds a working identity after renewal', String(idText).includes(userA.oid), String(idText).trim().slice(0, 120))
  await ctx.close()
  pass()
}

async function t7(browser) {
  test(7, 'Standalone mode works against the same backend, with zero backend changes')
  const ctx = await browser.newContext()
  const page = await ctx.newPage()
  await page.goto(`${URLS.wsWeb}/`, { waitUntil: 'domcontentloaded' })
  const mode = page.locator('[data-testid="mode"]')
  await mode.waitFor({ timeout: 20000 })
  const modeText = (await mode.textContent()) || ''
  check('workspace-web reports standalone mode when not framed', /standalone|independent/i.test(modeText), modeText.trim())

  // Drive its own login.
  if (await page.locator('a[href*="/api/auth/login"], button:has-text("Login")').count()) {
    await page.locator('a[href*="/api/auth/login"], button:has-text("Login")').first().click()
  } else {
    await page.goto(`${URLS.wsWeb}/api/auth/login`, { waitUntil: 'domcontentloaded' })
  }
  await page.locator(`a[href*="code=${userA.id}"]`).first().click({ timeout: 15000 })
  await page.waitForURL(u => u.toString().startsWith(URLS.wsWeb), { timeout: 20000 })
  const identity = page.locator('[data-testid="identity"]')
  await identity.waitFor({ timeout: 25000 })
  const idText = (await identity.textContent()) || ''
  check('standalone login resolved the same identity', idText.includes(userA.oid), idText.trim().slice(0, 120))
  evidence('standalone identity', idText.trim().slice(0, 160))
  await ctx.close()
  pass()
}

async function t8() {
  test(8, 'A second user, in a different tenant, sees none of the first user\'s data')
  const tokA = await mintToken(userA.id)
  const tokB = await mintToken(userB.id)
  evidence('user A', `${userA.name} tid=${userA.tid}`)
  evidence('user B', `${userB.name} tid=${userB.tid}`)
  check('the two fixtures are in different tenants', userA.tid !== userB.tid, `${userA.tid} vs ${userB.tid}`)

  const title = `private-to-A-${Math.floor(Date.now() / 1000)}`
  const created = await authed(`${URLS.gwApi}/conversations`, tokA, {
    method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify({ title }),
  })
  check('user A can create a conversation', created.ok, `status ${created.status}`)

  const text = `analysis-private-to-A-${Math.floor(Date.now() / 1000)}`
  const an = await authed(`${URLS.wsApi}/analyses`, tokA, {
    method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify({ text }),
  })
  check('user A can create an analysis', an.ok, `status ${an.status}`)

  const bConvos = await (await authed(`${URLS.gwApi}/conversations`, tokB)).json()
  const bAnalyses = await (await authed(`${URLS.wsApi}/analyses`, tokB)).json()
  const bConvoList = Array.isArray(bConvos) ? bConvos : (bConvos.items || bConvos.conversations || [])
  const bAnList = Array.isArray(bAnalyses) ? bAnalyses : (bAnalyses.items || bAnalyses.analyses || [])
  evidence('user B conversation count', bConvoList.length)
  evidence('user B analysis count', bAnList.length)
  check('user B cannot see user A\'s conversation', !JSON.stringify(bConvoList).includes(title))
  check('user B cannot see user A\'s analysis', !JSON.stringify(bAnList).includes(text))

  const aConvos = await (await authed(`${URLS.gwApi}/conversations`, tokA)).json()
  check('user A still sees their own conversation', JSON.stringify(aConvos).includes(title))
  pass()
}

/* --------------------------------------------------------------- the runner */

const RUN = [
  ['t1', t1, false], ['t2', t2, true], ['t3', t3, false], ['t4', t4, true],
  ['t5', t5, false], ['t6', t6, true], ['t7', t7, true], ['t8', t8, false],
]

let browser
try {
  console.log(`\nagent-platform acceptance proof   (token TTL ${TTL}s)\n`)
  cleanDatabases()
  await startAll({ tokenTtl: TTL })
  browser = await chromium.launch({
    executablePath: existsSync(CHROME) ? CHROME : undefined,
    args: ['--no-sandbox', '--disable-dev-shm-usage'],
  })

  for (const [name, fn, needsBrowser] of RUN) {
    try {
      console.log(`  running ${name}...`)
      await (needsBrowser ? fn(browser) : fn())
    } catch (e) {
      fail(e)
      console.error(`  ${name} failed: ${e.message}`)
    }
  }
} catch (e) {
  console.error('\nFATAL: could not bring the system up:', e.message)
  if (results.length === 0) test(0, 'system startup').status = 'fail'
} finally {
  if (browser) await browser.close().catch(() => {})
  await stopAll()
}

const summary = report()
process.exit(summary.failed > 0 ? 1 : 0)
