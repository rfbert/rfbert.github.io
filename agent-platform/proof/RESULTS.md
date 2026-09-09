# Proof results

Recorded from a full run with the spec's real 120-second token TTL, on a quiet
machine (ports cleared, no stale processes). Reproduce with:

```bash
cd agent-platform && ./setup.sh
cd proof && node run-proof.mjs
```

## Acceptance tests — 8 / 8 passed

| # | Claim | Result |
|---|---|---|
| 1 | Mock IdP serves a JWKS public key (RSA, kid, RS256; discovery points at it) | PASS |
| 2 | Browser login at :3000 sets an httpOnly cookie; JWT carries tid/oid/aud/scp, 120s, never in localStorage | PASS |
| 3 | Gateway API accepts the Bearer token and JIT-provisions into Database A | PASS |
| 4 | Iframe loads (CSP allows it) and the TOKEN_REQUIRED → AUTH_TOKEN handshake completes | PASS |
| **5** | **ONE token, TWO APIs, TWO databases, ONE identity** (same tid+oid, DB A vs B, independent rows, no cross-refs) | **PASS** |
| 6 | Token expiry at 120s triggers a silent renewal round, no second login | PASS |
| 7 | Standalone mode resolves the same identity against the same backend, zero backend changes | PASS |
| 8 | A second user in a different tenant sees none of the first user's conversations or analyses | PASS |

Test 5 is the crux. Evidence captured in the run:

```
/me from :4000  {"id":1,"tid":"8f2a1c34-...","oid":"b1d4f0a2-...","displayName":"Ada Lovelace","database":"A"}
/me from :4001  {"id":1,"tid":"8f2a1c34-...","oid":"b1d4f0a2-...","displayName":"Ada Lovelace","database":"B"}
neither database references the other  A=[users,conversations] B=[users,document_analyses]
```

The harness also verified the run's own integrity: it refuses to start on a
busy port and fails loudly if a service dies before it is ready — so a green
result cannot come from accidentally testing a stale binary (a real bug found
and fixed while building this harness).

## Adversarial probes — all attacks refused

See `ADVERSARIAL.md`. Forged-key tokens, `alg:none`, wrong issuer, wrong
audience, expired tokens, missing/wrong/substring scope, a user JWT presented
as the internal secret, and cross-tenant reads are each rejected by both APIs.

## Source audit — 0 findings

Five independent auditors read the source hunting for faked or bypassable
claims across five classes (JWT leak to the internal service, data-isolation
bypass, hidden shared state between the two apps, browser token discipline,
guard coverage). Every candidate was adversarially re-verified. Zero confirmed
findings; 55 claims verified genuinely sound — including that the (tid, oid)
composite unique index physically exists in both committed database files, and
that isolation is not an artifact of the test inputs (two fixtures share a
tenant but differ by oid, so a tid-only bug would fail test 8).
