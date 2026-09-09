# agent-platform

## The claim being proven

**One Microsoft identity, two independent applications, two independent databases, data isolated per user.**
A single Microsoft Entra ID login issues exactly one JWT, and two completely independent
applications accept that same token with no token exchange, no shared session store and no
second login screen. Each application validates the token itself against the same issuer,
audience and JWKS, and then performs its own just-in-time find-or-create of a local user row in
its own SQLite database — `gateway.db` for the Identity Gateway and `workspace.db` for the Agent
Workspace — keyed only on the stable claim pair `tid + oid`, never on email or `sub`. The two
databases share no table, no foreign key and no file; the only thing correlating them is that
claim pair carried in the token. The second application runs embedded in the first through an
iframe, receiving the token over a two-message `postMessage` bridge (`TOKEN_REQUIRED` up,
`AUTH_TOKEN` down) that also serves silent renewal, and it runs standalone with its own login
against the same identity provider — with the backend code identical either way. This repository
is the structural proof of that architecture, runnable end to end on one machine, offline.

## Architecture

```text
 +--1 EXTERNAL IDENTITY-+ +--2 IDENTITY GATEWAY--+ +-3 INTEGRATION-+ +--4 AGENT WORKSPACE---+ +-5 AI SERVICE-+
 |                      | |                      | |               | |                      | |              |
 |       [ User ]       | | +------------------+ | |               | | +------------------+ | |              |
 |          |           | | |identity-gateway- | | |               | | | agent-workspace- | | |              |
 |          v           | | |       web        |-+-+---------------+-+>|       web        | | |              |
 |  Microsoft Entra ID  |-+>|    Next.js 1     | | |  < iframe >   | | |    Next.js 2     | | |              |
 |          |           | | | login / session  | | |               | | | iframe OR alone  | | |              |
 |          v           | | |   / renewal      | | |               | | +------------------+ | |              |
 |   OAuth 2.0 + OIDC   | | +------------------+ | | --AUTH_TOKEN->| |          |           | |              |
 |          |           | |          | (3)Bearer | |               | |          | (6)Bearer | |              |
 |          v           | |          v           | | <-TOKEN_REQD- | |          v           | | +----------+ |
 |    JWT validated     | | +------------------+ | |               | | +------------------+ | | |agent-api | |
 |          | (1)       | | |identity-gateway- | | | --AUTH_TOKEN->| | | agent-workspace- | | | | FastAPI  | |
 |          v           | | |       api        | | |   (renewed)   | | |       api        |<+-+>|          | |
 | #################### | | |    NestJS 1      | | |               | | |    NestJS 2      | | | | internal | |
 | # (2) STABLE      # <+-+-|  validates JWT   | | |   ONE LOGIN   | | | validates SAME   | | | | AI mock  | |
 | #  IDENTITY       #  | | +------------------+ | |     ONLY      | | |       JWT        | | | +----------+ |
 | #   tid + oid     #  | |          |           | |               | | +------------------+ | |      ^       |
 | #################### | |          v           | |               | |          |           | |      |       |
 |    |    |    |       | | +------------------+ | |               | |          v           | |  internal    |
 |    v    v    v       | | | (4) JIT: find or |<+-+-- same tid+oid+-+>| (7) JIT: find or | | |  call only   |
 |  App   Shared  scope | | |     create user  | | |   both sides  | | |     create user  | | |              |
 |  Reg.  audience  =   | | +------------------+ | |               | | +------------------+ | |              |
 |        access_as_user| |          | rd/write  | |               | |          | rd/write  | |              |
 |                      | |          v           | |               | |          v           | |              |
 |                      | |  ..................  | |               | |  ..................  | |              |
 |                      | |  :  DATABASE A    :  | |               | |  :  DATABASE B    :  | |              |
 |                      | |  :  users         :  | |               | |  :  users         :  | |              |
 |                      | |  :  conversations :  | |               | |  :  document_     :  | |              |
 |                      | |  ..................  | |               | |  :   analyses     :  | |              |
 |          :           | |                      | |               | |  ..................  | |              |
 |          :           | |                      | |               | |          ^           | |              |
 |          :.......... standalone mode: workspace does its own login ..........:           | |              |
 +----------------------+ +----------------------+ +---------------+ +----------------------+ +--------------+

 LEGEND (from source image):
   --->   execution flow
   ...>   configuration / identity
   ===>   token hand-off
   :...:  independent persistence
```

## Ports

Ports are fixed. They are baked into CORS rules, CSP `frame-ancestors` and postMessage target
origins. Do not renumber them.

| Port | Service | Stack | Role | Persistence |
|------|---------|-------|------|-------------|
| 5000 | `mock-idp` | Express + jose | Local stand-in for Microsoft Entra ID. OIDC discovery, JWKS, `/authorize`, `/token`. Tokens expire in 120s on purpose. | — |
| 3000 | `identity-gateway-web` | Next.js 1 | Login, session and renewal. Holds the JWT in an httpOnly cookie. Hosts the workspace iframe and is the **parent** half of the postMessage bridge. | — |
| 4000 | `identity-gateway-api` | NestJS 1 | Validates the JWT. JIT find-or-create on `(tid, oid)` — step (4). CORS allows `:3000` only. | **DATABASE A** — `gateway.db` (`users`, `conversations`) |
| 3001 | `agent-workspace-web` | Next.js 2 | Runs in the iframe or standalone. **Child** half of the postMessage bridge. Token in memory only. CSP `frame-ancestors http://localhost:3000`. | — |
| 4001 | `agent-workspace-api` | NestJS 2 | Validates the **same** JWT with the **same** `src/auth/` folder, unchanged. Its own JIT find-or-create on `(tid, oid)` — step (7). CORS allows `:3001` only. | **DATABASE B** — `workspace.db` (`users`, `document_analyses`) |
| 8000 | `agent-api` | FastAPI | Internal AI mock. No CORS middleware, unreachable from a browser, requires `X-Internal-Secret`. The user JWT is never forwarded here. | — |

## Quickstart

**Fastest path** — one command does install, keys and the Python venv:

```bash
cd agent-platform
./setup.sh
```

Then run the proof (`cd proof && node run-proof.mjs`) or start the stack (`npm run dev` + the uvicorn line). The manual steps below are the same thing, broken out.


Run these in exact order. You will need two terminals: one for the five Node services, one for
the Python service.

**1. Install**

```bash
cd agent-platform
npm install          # root: installs concurrently
npm run install:all  # installs the 5 node services, sequentially
```

**2. Configure**

`.env.example` at the root is the single source of the shared values. Copy each service's block
out of it into that service's own env file:

```
identity-gateway-web/.env.local
identity-gateway-api/.env
agent-workspace-web/.env.local
agent-workspace-api/.env
agent-api/.env
```

`ISSUER`, `JWKS_URI` and `AUDIENCE` must be byte-identical in both APIs. If they drift, one app
returns 401 and the other does not — which is precisely the failure this scaffold exists to
surface.

**3. Generate the mock IdP signing keys**

```bash
cd mock-idp && npm run keys && cd ..
```

The keys are a throwaway localhost-only RSA keypair and are **not** committed — a private key in
a repository trips secret scanners and teaches the wrong habit. `generate-keys.js` is idempotent,
so re-running it is safe. The IdP refuses to start without them rather than starting keyless.

**4. Start the Python service** (terminal 1)

```bash
cd agent-api
python3 -m venv .venv && . .venv/bin/activate
pip install -r requirements.txt
uvicorn main:app --reload --port 8000
```

`npm run agent-api` at the root prints this same reminder.

**5. Start the five Node services** (terminal 2)

```bash
npm run dev
```

That runs `mock-idp`, `identity-gateway-api`, `identity-gateway-web`, `agent-workspace-api` and
`agent-workspace-web` together under `concurrently`, colour-coded and prefixed
`IDP`, `GW-API`, `GW-WEB`, `WS-API`, `WS-WEB`. Individual scripts are also available:
`npm run dev:idp`, `dev:gw-api`, `dev:gw-web`, `dev:ws-api`, `dev:ws-web`.

**6. Open** <http://localhost:3000> and log in as a fixture user.

## Acceptance tests

Run these in order. All eight must pass.

- [ ] **1.** GET http://localhost:5000/jwks.json returns a public key.

- [ ] **2.** Log in at :3000, choose a fixture user. Cookie is set.
      /api/auth/token returns a JWT whose decoded claims include
      tid, oid, aud, scp.

- [ ] **3.** GET :4000/conversations with that Bearer returns 200, and a row
      appears in gateway.db users table.   (JIT step 4 fired.)

- [ ] **4.** Navigate to /workspace. The iframe loads. The browser console shows
      TOKEN_REQUIRED followed by AUTH_TOKEN.

- [ ] **5.** **`*** THE CRITICAL TEST ***`**  &larr; this is the critical one
      The workspace calls :4001/analyses with the SAME token, returns 200,
      and a row appears in workspace.db users with the SAME tid + oid as the
      row in gateway.db.
      Two databases, two rows, one identity, one login.  (JIT step 7 fired.)

- [ ] **6.** Wait past the 120 second expiry, then click something. Expect:
      401 -> TOKEN_REQUIRED -> AUTH_TOKEN -> retry -> 200,
      with no visible interruption and no second login screen.

- [ ] **7.** Open http://localhost:3001 directly. Standalone login works, and :4001
      accepts it with ZERO backend changes.

- [ ] **8.** Log in as a second fixture user. They see none of the first user's
      conversations or analyses in either application.

Test 5 is the critical one: it is the single test that distinguishes this architecture from a
conventional shared-session monolith. Everything else can pass in a system that quietly shares a
database.

## Proving it — the harness

The eight tests above are not a manual checklist. `proof/` runs them against the real system:
it starts all six services, drives a real Chromium through the login and the iframe handshake,
reads both SQLite files directly, and waits out a genuine token expiry.

```bash
cd proof
npm install
node run-proof.mjs               # full run, 120s token TTL as specified
TOKEN_TTL_SECONDS=25 node run-proof.mjs   # same mechanism, quicker
```

It exits non-zero if any claim fails, so it works as a CI gate. Per-service logs land in
`proof/logs/`.

What it guards against, beyond the happy path:

- It refuses to start on top of a stale process. A leftover server answering on the right port
  is the worst failure mode for an acceptance harness — every probe passes while you test the
  wrong binary. Ports are cleared and verified before anything starts.
- It fails loudly if a service exits before becoming ready, instead of testing whatever else
  happens to answer.
- Each service runs in its own process group, so nothing is orphaned between runs.

## What this is not

This is a structural proof, not a production system. Specifically:

- **Not production.** It is the smallest code that makes the wiring provably correct. There is no
  error taxonomy, no rate limiting, no observability, no migrations, no tests beyond the eight
  acceptance checks above.
- **The IdP is a mock.** `mock-idp` is a ~200-line Express app standing in for Microsoft Entra ID.
  It serves real OIDC discovery and a real RS256 JWKS — the two APIs cannot tell it is a mock —
  but it does no password check, no consent, no PKCE, no refresh tokens. `/authorize` just renders
  a clickable list of three fixture users. In production this is replaced by a real Entra ID
  tenant and a real app registration, and nothing in the two APIs changes.
- **The signing keys are dev keys, generated per clone.** `mock-idp/keys/*.pem` is a throwaway
  RSA keypair produced by `npm run keys`. It is git-ignored on purpose: a private key in a
  repository trips secret scanners and normalises a bad habit, even when the key signs nothing
  real and belongs to no tenant. The cost is one setup command; the benefit is that this repo
  never teaches anyone to commit a private key.
- **Token lifetime is 120 seconds.** That is absurd for real use. It exists so the renewal
  handshake in acceptance test 6 is observable in under two minutes instead of an hour.
- **Persistence is SQLite with `synchronize: true`.** Two loose files, `gateway.db` and
  `workspace.db`, schema generated at boot from the entities. Genuinely two files — that is the
  point — but not a migration story, not concurrent-write-safe, and not a production database.
- **No HTTPS.** Everything is plain HTTP on localhost. Cookies are therefore not `Secure`, and
  the `SameSite=Lax` gateway cookie plus the in-memory workspace token are tuned for a local
  same-site setup. Real deployment needs TLS, `Secure` cookies, and a re-examination of the
  cross-origin cookie story.
- **The per-service `.env` / `.env.local` files are committed.** Unlike the
  signing key, they hold no secret — only localhost URLs, the shared audience,
  and the documented-fake `dev-secret`. They are committed (via `git add -f`, on
  top of the usual `.env` ignore rule) so the repo runs on a fresh clone with no
  copy step. `.env.example` remains the annotated reference. In a real project
  the `.env` files stay ignored and only `.env.example` is committed.
- **`INTERNAL_SECRET` is the literal string `dev-secret`.** A shared static header value is
  adequate to prove that `agent-api` refuses browser traffic and that the user JWT never crosses
  that boundary. It is not an authentication scheme.
