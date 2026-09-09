// Process lifecycle for the six services. Starts them, waits for each port to
// answer, tees their stdout/stderr to logs/, and guarantees teardown.

import { spawn, execSync } from 'node:child_process'
import { createWriteStream, mkdirSync, existsSync, rmSync } from 'node:fs'
import { join, dirname } from 'node:path'
import { fileURLToPath } from 'node:url'

const HERE = dirname(fileURLToPath(import.meta.url))
export const ROOT = join(HERE, '..', '..')          // agent-platform/
const LOGS = join(HERE, '..', 'logs')

export const PORTS = {
  idp: 5000, gwApi: 4000, wsApi: 4001, agentApi: 8000, gwWeb: 3000, wsWeb: 3001,
}
export const URLS = {
  idp:      `http://localhost:${PORTS.idp}`,
  gwApi:    `http://localhost:${PORTS.gwApi}`,
  wsApi:    `http://localhost:${PORTS.wsApi}`,
  agentApi: `http://localhost:${PORTS.agentApi}`,
  gwWeb:    `http://localhost:${PORTS.gwWeb}`,
  wsWeb:    `http://localhost:${PORTS.wsWeb}`,
}

const procs = []

/**
 * Return the pid listening on a port, or null.
 *
 * This exists because the build agents start their own instances while
 * verifying their work, and a leftover process silently answering on the right
 * port is the worst possible failure mode for an acceptance harness: every
 * probe succeeds while testing the WRONG BINARY.
 */
function portPid(port) {
  try {
    const out = execSync(`ss -lptnH 'sport = :${port}' 2>/dev/null || true`, { encoding: 'utf8' })
    const m = out.match(/pid=(\d+)/)
    return m ? Number(m[1]) : null
  } catch { return null }
}

/** Refuse to start on top of anything. Kill squatters, then verify. */
export function freePorts({ quiet = false } = {}) {
  const killed = []
  for (const [name, port] of Object.entries(PORTS)) {
    const pid = portPid(port)
    if (pid && pid !== process.pid) {
      killed.push(`${name}:${port} (pid ${pid})`)
      try { process.kill(pid, 'SIGKILL') } catch {}
    }
  }
  if (killed.length && !quiet) console.log(`  cleared stale listeners: ${killed.join(', ')}`)
  const stillBusy = Object.entries(PORTS).filter(([, port]) => portPid(port))
  if (stillBusy.length) {
    throw new Error(`ports still occupied after cleanup: ${stillBusy.map(([n, p]) => `${n}:${p}`).join(', ')}`)
  }
  return killed
}

function launch(name, cmd, args, cwd, env = {}) {
  mkdirSync(LOGS, { recursive: true })
  const out = createWriteStream(join(LOGS, `${name}.log`), { flags: 'w' })
  const p = spawn(cmd, args, {
    cwd, env: { ...process.env, ...env }, stdio: ['ignore', 'pipe', 'pipe'],
    // Own process group: `npx`/`npm exec` fork a child that outlives the
    // wrapper, and an orphaned next-server squatting on a port makes the NEXT
    // proof run silently test the wrong binary. Killing the group prevents it.
    detached: true,
  })
  p.stdout.pipe(out); p.stderr.pipe(out)
  p.__name = name
  p.on('exit', (code, sig) => {
    p.__exited = { code, sig }
    if (!p.__expected && code !== 0) console.error(`  ! ${name} exited early (code=${code} sig=${sig}) -- see proof/logs/${name}.log`)
  })
  procs.push({ name, p })
  return p
}

export async function waitForHttp(url, { timeoutMs = 120000, label = url, proc = null } = {}) {
  const deadline = Date.now() + timeoutMs
  let lastErr = 'no attempt'
  while (Date.now() < deadline) {
    // If the process we launched has already died, a responding port means we
    // are about to test somebody else's binary. Fail instead.
    if (proc && proc.__exited) {
      throw new Error(
        `${label} exited before becoming ready (code=${proc.__exited.code}). ` +
        `See proof/logs/${proc.__name}.log`)
    }
    try {
      // Any HTTP response at all means the port is serving -- a 401/403 from a
      // guarded endpoint is a perfectly good liveness signal.
      const r = await fetch(url, { redirect: 'manual' })
      return r
    } catch (e) { lastErr = e.message }
    await new Promise(r => setTimeout(r, 400))
  }
  throw new Error(`timed out waiting for ${label} (${url}): ${lastErr}`)
}

export function cleanDatabases() {
  for (const db of ['identity-gateway-api/gateway.db', 'agent-workspace-api/workspace.db']) {
    const f = join(ROOT, db)
    for (const suffix of ['', '-wal', '-shm']) {
      if (existsSync(f + suffix)) rmSync(f + suffix)
    }
  }
}

export async function startAll({ tokenTtl = 120, quiet = false } = {}) {
  const say = m => { if (!quiet) console.log(m) }
  freePorts({ quiet })

  say(`  starting mock-idp        :${PORTS.idp}   (token TTL ${tokenTtl}s)`)
  const pIdp = launch('mock-idp', 'node', ['server.js'], join(ROOT, 'mock-idp'),
    { PORT: String(PORTS.idp), TOKEN_TTL_SECONDS: String(tokenTtl) })
  await waitForHttp(`${URLS.idp}/jwks.json`, { label: 'mock-idp', proc: pIdp })

  say(`  starting agent-api       :${PORTS.agentApi} (FastAPI, internal only)`)
  const py = join(ROOT, 'agent-api', '.venv', 'bin', 'python')
  const pAgent = launch('agent-api', py, ['-m', 'uvicorn', 'main:app', '--port', String(PORTS.agentApi), '--host', '127.0.0.1'],
    join(ROOT, 'agent-api'))
  await waitForHttp(`${URLS.agentApi}/health`, { label: 'agent-api', proc: pAgent })

  say(`  starting gateway-api     :${PORTS.gwApi}   (Database A)`)
  const pGwApi = launch('identity-gateway-api', 'node', ['dist/main.js'], join(ROOT, 'identity-gateway-api'))
  await waitForHttp(`${URLS.gwApi}/me`, { label: 'identity-gateway-api', proc: pGwApi })

  say(`  starting workspace-api   :${PORTS.wsApi}   (Database B)`)
  const pWsApi = launch('agent-workspace-api', 'node', ['dist/main.js'], join(ROOT, 'agent-workspace-api'))
  await waitForHttp(`${URLS.wsApi}/me`, { label: 'agent-workspace-api', proc: pWsApi })

  say(`  starting gateway-web     :${PORTS.gwWeb}   (Next.js 1, iframe host)`)
  const pGwWeb = launch('identity-gateway-web',
    join(ROOT, 'identity-gateway-web', 'node_modules', '.bin', 'next'),
    ['start', '-p', String(PORTS.gwWeb)], join(ROOT, 'identity-gateway-web'))
  await waitForHttp(`${URLS.gwWeb}/`, { label: 'identity-gateway-web', proc: pGwWeb })

  say(`  starting workspace-web   :${PORTS.wsWeb}   (Next.js 2, iframe child)`)
  const pWsWeb = launch('agent-workspace-web',
    join(ROOT, 'agent-workspace-web', 'node_modules', '.bin', 'next'),
    ['start', '-p', String(PORTS.wsWeb)], join(ROOT, 'agent-workspace-web'))
  await waitForHttp(`${URLS.wsWeb}/`, { label: 'agent-workspace-web', proc: pWsWeb })

  say('  all six services up\n')
}

export async function stopAll() {
  const killGroup = (p, sig) => {
    try { process.kill(-p.pid, sig) } catch { try { p.kill(sig) } catch {} }
  }
  for (const { p } of procs) { p.__expected = true; killGroup(p, 'SIGTERM') }
  await new Promise(r => setTimeout(r, 1500))
  for (const { p } of procs) killGroup(p, 'SIGKILL')
  procs.length = 0
  // Belt and braces: nothing may be left holding a port.
  await new Promise(r => setTimeout(r, 400))
  try { freePorts({ quiet: true }) } catch {}
}

export function decodeJwt(token) {
  const [h, p] = token.split('.')
  const j = s => JSON.parse(Buffer.from(s.replace(/-/g, '+').replace(/_/g, '/'), 'base64').toString('utf8'))
  return { header: j(h), payload: j(p) }
}

// Mint a token straight from the mock IdP, bypassing the browser. The
// authorization code IS the fixture user id, so this mirrors what the browser
// flow does without needing one.
export async function mintToken(userId) {
  const r = await fetch(`${URLS.idp}/token`, {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify({ code: userId, grant_type: 'authorization_code' }),
  })
  if (!r.ok) throw new Error(`mint failed for ${userId}: ${r.status} ${await r.text()}`)
  const body = await r.json()
  if (!body.access_token) throw new Error(`no access_token in mint response: ${JSON.stringify(body)}`)
  return body.access_token
}
