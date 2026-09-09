/**
 * mock-idp/server.js -- the entire local stand-in for Microsoft Entra ID.
 *
 * The two NestJS APIs must not be able to tell this is a mock: it speaks
 * standard OIDC discovery + JWKS and signs RS256 tokens whose header kid
 * matches the published key, so jwks-rsa can select it.
 *
 * Routes (SPEC.txt 4.1):
 *   GET  /.well-known/openid-configuration
 *   GET  /jwks.json
 *   GET  /authorize?redirect_uri=&state=&prompt=
 *   POST /token            (application/json OR x-www-form-urlencoded)
 *
 * Token lifetime is deliberately short (TOKEN_TTL_SECONDS, default 120) so
 * acceptance test 6 -- the silent renewal handshake -- is observable.
 */
const express = require('express');
const fs = require('node:fs');
const path = require('node:path');
const crypto = require('node:crypto');
const { SignJWT, exportJWK, calculateJwkThumbprint } = require('jose');

// ---------------------------------------------------------------------------
// Config (SPEC.txt 5.1 -- these values are byte-identical across services)
// ---------------------------------------------------------------------------
const PORT = Number(process.env.PORT || 5000);
const ISSUER = process.env.ISSUER || `http://localhost:${PORT}`;
const AUDIENCE = process.env.AUDIENCE || 'api://agent-platform';
const TOKEN_TTL_SECONDS = Number(process.env.TOKEN_TTL_SECONDS || 120);
const SCOPE = 'access_as_user';

const KEYS_DIR = path.join(__dirname, 'keys');
const PRIVATE_KEY_PATH = path.join(KEYS_DIR, 'private.pem');
const PUBLIC_KEY_PATH = path.join(KEYS_DIR, 'public.pem');
const USERS_PATH = path.join(__dirname, 'users.json');

// ---------------------------------------------------------------------------
// Fixtures + keys
// ---------------------------------------------------------------------------
function loadUsers() {
  const users = JSON.parse(fs.readFileSync(USERS_PATH, 'utf8'));
  if (!Array.isArray(users) || users.length === 0) {
    throw new Error('users.json must be a non-empty array of fixture users');
  }
  for (const u of users) {
    for (const field of ['id', 'tid', 'oid', 'name', 'email']) {
      if (!u[field]) {
        throw new Error(`users.json: user "${u.id || '?'}" is missing "${field}"`);
      }
    }
  }
  return users;
}

function loadKeys() {
  if (!fs.existsSync(PRIVATE_KEY_PATH) || !fs.existsSync(PUBLIC_KEY_PATH)) {
    console.error('[mock-idp] no signing keypair found in ./keys');
    console.error('[mock-idp] run:  npm run keys   (i.e. node generate-keys.js)');
    process.exit(1);
  }
  return {
    privateKey: crypto.createPrivateKey(fs.readFileSync(PRIVATE_KEY_PATH, 'utf8')),
    publicKey: crypto.createPublicKey(fs.readFileSync(PUBLIC_KEY_PATH, 'utf8')),
  };
}

/**
 * Entra's "sub" is an opaque, app-scoped pseudonym -- deliberately NOT the
 * join key. Derived here so it is stable per user but useless for correlation:
 * the applications must key on tid + oid (SPEC.txt Section 8).
 */
function subjectFor(user) {
  return crypto
    .createHash('sha256')
    .update(`${user.tid}|${user.oid}|${AUDIENCE}`)
    .digest('base64url');
}

const escapeHtml = (value) =>
  String(value).replace(/[&<>"']/g, (c) => (
    { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]
  ));

// ---------------------------------------------------------------------------
// App
// ---------------------------------------------------------------------------
async function main() {
  const users = loadUsers();
  const { privateKey, publicKey } = loadKeys();

  // The JWKS entry and the JWT header must carry the SAME kid, otherwise
  // jwks-rsa cannot select the key and both APIs return 401.
  const publicJwk = await exportJWK(publicKey);
  const kid = await calculateJwkThumbprint(publicJwk, 'sha256');
  const jwks = {
    keys: [{ ...publicJwk, kid, use: 'sig', alg: 'RS256' }],
  };

  const app = express();
  app.disable('x-powered-by');
  app.use(express.json());
  app.use(express.urlencoded({ extended: false }));

  app.use((req, _res, next) => {
    console.log(`[mock-idp] ${req.method} ${req.originalUrl}`);
    next();
  });

  // -- OIDC discovery ------------------------------------------------------
  app.get('/.well-known/openid-configuration', (_req, res) => {
    res.set('Access-Control-Allow-Origin', '*'); // public metadata, as in Entra
    res.json({
      issuer: ISSUER,
      authorization_endpoint: `${ISSUER}/authorize`,
      token_endpoint: `${ISSUER}/token`,
      jwks_uri: `${ISSUER}/jwks.json`,
    });
  });

  // -- JWKS: fetched by BOTH NestJS APIs -----------------------------------
  app.get('/jwks.json', (_req, res) => {
    res.set('Access-Control-Allow-Origin', '*'); // public keys only
    res.json(jwks);
  });

  // -- Authorization endpoint: the fixture-user picker ----------------------
  app.get('/authorize', (req, res) => {
    const redirectUri = req.query.redirect_uri;
    const state = req.query.state ? String(req.query.state) : '';
    const prompt = req.query.prompt ? String(req.query.prompt) : '';

    if (!redirectUri) {
      return res.status(400).type('html').send(
        '<h1>invalid_request</h1><p>redirect_uri is required.</p>'
      );
    }

    let base;
    try {
      base = new URL(String(redirectUri));
    } catch {
      return res.status(400).type('html').send(
        '<h1>invalid_request</h1><p>redirect_uri is not a valid absolute URL.</p>'
      );
    }

    const rows = users
      .map((u) => {
        const target = new URL(base.toString());
        target.searchParams.set('code', u.id); // the code IS the user id
        if (state) target.searchParams.set('state', state);
        return `
        <li>
          <a class="user" href="${escapeHtml(target.toString())}">
            <span class="name">${escapeHtml(u.name)}</span>
            <span class="email">${escapeHtml(u.email)}</span>
            <span class="tid">tid ${escapeHtml(u.tid)}</span>
            <span class="oid">oid ${escapeHtml(u.oid)}</span>
          </a>
        </li>`;
      })
      .join('');

    res.type('html').send(`<!doctype html>
<html lang="en">
<head>
<meta charset="utf-8">
<title>Mock Entra ID - pick a user</title>
<style>
  body { font-family: -apple-system, "Segoe UI", Roboto, Helvetica, Arial, sans-serif;
         margin: 2rem auto; max-width: 46rem; line-height: 1.45; color: #1b1b1f; }
  h1 { font-size: 1.35rem; margin-bottom: .25rem; }
  p.sub { color: #555; margin-top: 0; }
  ul { list-style: none; padding: 0; }
  a.user { display: block; padding: .85rem 1rem; margin: .5rem 0; text-decoration: none;
           border: 1px solid #ccc; border-radius: 6px; color: inherit; }
  a.user:hover { border-color: #0067b8; background: #f2f8fd; }
  .name { display: block; font-weight: 600; }
  .email { display: block; color: #444; }
  .tid, .oid { display: block; font-family: ui-monospace, Menlo, Consolas, monospace;
               font-size: .78rem; color: #666; }
  code { font-family: ui-monospace, Menlo, Consolas, monospace; }
  footer { margin-top: 1.5rem; font-size: .8rem; color: #666; }
</style>
</head>
<body>
  <h1>Mock Entra ID</h1>
  <p class="sub">Choose a fixture user to sign in as. Two tenants are represented
  &mdash; note the <code>tid</code> so you can test cross-tenant isolation.</p>
  <ul>${rows}</ul>
  <footer>
    redirect_uri: <code>${escapeHtml(base.toString())}</code><br>
    state: <code>${escapeHtml(state || '(none)')}</code><br>
    prompt: <code>${escapeHtml(prompt || '(none)')}</code>
    &mdash; this mock always shows the picker, so <code>prompt=login</code> and
    <code>prompt=select_account</code> behave identically.<br>
    tokens expire after ${TOKEN_TTL_SECONDS}s.
  </footer>
</body>
</html>`);
  });

  // -- Token endpoint ------------------------------------------------------
  app.post('/token', async (req, res) => {
    const body = req.body || {};
    const code = body.code ? String(body.code) : '';

    if (!code) {
      return res.status(400).json({
        error: 'invalid_request',
        error_description: 'code is required',
      });
    }

    const user = users.find((u) => u.id === code);
    if (!user) {
      return res.status(400).json({
        error: 'invalid_grant',
        error_description: `unknown code "${code}"`,
      });
    }

    const iat = Math.floor(Date.now() / 1000);
    const exp = iat + TOKEN_TTL_SECONDS;

    // Claim contract, SPEC.txt 5.2 -- exactly these claims, nothing else.
    const accessToken = await new SignJWT({
      tid: user.tid,
      oid: user.oid,
      name: user.name,
      preferred_username: user.email,
      scp: SCOPE,
    })
      .setProtectedHeader({ alg: 'RS256', typ: 'JWT', kid })
      .setIssuer(ISSUER)
      .setAudience(AUDIENCE)
      .setSubject(subjectFor(user))
      .setIssuedAt(iat)
      .setExpirationTime(exp)
      .sign(privateKey);

    res.json({
      access_token: accessToken,
      token_type: 'Bearer',
      expires_in: TOKEN_TTL_SECONDS,
    });
  });

  app.use((req, res) => {
    res.status(404).json({ error: 'not_found', error_description: `${req.method} ${req.path}` });
  });

  // eslint-disable-next-line no-unused-vars
  app.use((err, _req, res, _next) => {
    console.error('[mock-idp] unhandled error:', err);
    res.status(500).json({ error: 'server_error', error_description: String(err && err.message) });
  });

  app.listen(PORT, () => {
    const line = '='.repeat(72);
    console.log(line);
    console.log('  mock-idp  --  local stand-in for Microsoft Entra ID');
    console.log(line);
    console.log(`  issuer      : ${ISSUER}`);
    console.log(`  discovery   : ${ISSUER}/.well-known/openid-configuration`);
    console.log(`  jwks        : ${ISSUER}/jwks.json`);
    console.log(`  authorize   : ${ISSUER}/authorize?redirect_uri=...&state=...`);
    console.log(`  token       : ${ISSUER}/token   (POST, json or form-urlencoded)`);
    console.log(`  audience    : ${AUDIENCE}`);
    console.log(`  scope       : ${SCOPE}`);
    console.log(`  signing kid : ${kid}  (RS256)`);
    console.log(`  token ttl   : ${TOKEN_TTL_SECONDS}s  (short on purpose: renewal test)`);
    console.log(`  ${'-'.repeat(70)}`);
    console.log(`  fixture users (${users.length}) -- code = id:`);
    for (const u of users) {
      console.log(`    ${u.id.padEnd(6)} ${u.name.padEnd(14)} ${u.email}`);
      console.log(`           tid ${u.tid}`);
      console.log(`           oid ${u.oid}`);
    }
    const tenants = [...new Set(users.map((u) => u.tid))];
    console.log(`  ${tenants.length} distinct tenant(s) -- cross-tenant isolation is testable.`);
    console.log(line);
  });
}

main().catch((err) => {
  console.error('[mock-idp] failed to start:', err);
  process.exit(1);
});
