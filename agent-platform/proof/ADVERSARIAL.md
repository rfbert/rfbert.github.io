# Adversarial probe log

These are live-system attacks run against the running stack, on top of the
eight acceptance tests in `run-proof.mjs`. They exist because a green
happy-path suite does not prove the *security* claims — only that the wiring
is connected. Each row was executed with `curl`/`node` against the six live
services; re-run them with the stack up (`node proof/serve.mjs`).

## Internal boundary — `agent-api` must be unreachable from a browser

| attack | result | want |
|---|---|---|
| `POST /analyze` with no secret header | 403 | 403 |
| `POST /analyze` with a wrong secret | 403 | 403 |
| `POST /analyze` with the correct secret | 200 | 200 |
| `POST /analyze` presenting a **user JWT** as the secret | 403 | 403 |
| `OPTIONS /analyze` with a browser `Origin` | no `Access-Control-*` headers | none |

The user JWT is not accepted at this boundary, and no CORS headers are emitted,
so a browser cannot reach the service even if it obtained a valid user token.

## Token validation — both APIs, identical verdicts

Every token below was built with `jose` and thrown at **both** `:4000` and `:4001`.

| token | :4000 | :4001 | want |
|---|---|---|---|
| valid, right iss+aud+scope (control) | 200 | 200 | 200 |
| signature tampered | 401 | 401 | 401 |
| signed by an **attacker's** RSA key (kid not in JWKS) | 401 | — | 401 |
| `alg: none`, no signature | 400* | — | reject |
| wrong issuer (validly signed) | 401 | 401 | 401 |
| wrong audience (validly signed) | 401 | 401 | 401 |
| already expired (validly signed) | 401 | 401 | 401 |
| no `scp` claim | 401 | — | 401 |
| `scp` present but wrong (`User.Read`) | 401 | — | 401 |
| `scp` substring trick (`no_access_as_user`) | 401 | — | 401 |

\* **The one nuance.** An `alg: none` token is refused with **400** rather than
401. It is still a hard rejection — the identity is never honored, no data is
returned — but it is categorised as a malformed request by the JWT layer before
the strategy runs, rather than as an authentication failure. A structurally
invalid token arguably *is* a bad request, so this is defensible; it is recorded
here rather than "fixed" so the behaviour is documented, not hidden. If exact
401 parity is wanted, it would live in an exception filter, not in the auth
strategy.

## Identity model

| attack | result |
|---|---|
| same valid token → `/me` on both APIs | same `tid`+`oid`, `database: A` vs `B` |
| Alan (tenant 2) lists conversations after Ada (tenant 1) created one | Alan sees 0 — isolated |
| scope-strip / wrong-scope / substring tricks | all 401 |

The stable identity is the `(tid, oid)` pair; a token carrying only one half is
refused (`jwt.strategy.ts`), so no half-identity row is ever provisioned.
