/**
 * /workspace -- the integration column of the architecture, on one screen.
 *
 * Renders <WorkspaceFrame />: the iframe holding agent-workspace-web (:3001)
 * and the live log of every postMessage that crosses between them.
 *
 * Nothing about the child's backend changes because it is framed. It validates
 * the same token, against the same issuer, audience and JWKS, and writes to its
 * own database. The iframe only changes where the token comes from.
 */
import { cookies } from 'next/headers';

import WorkspaceFrame from '@/components/WorkspaceFrame';
import { SESSION_COOKIE, WORKSPACE_ORIGIN } from '@/lib/config';
import { readClaims } from '@/lib/session';

export const dynamic = 'force-dynamic';

export default async function WorkspacePage() {
  const jar = await cookies();
  const token = jar.get(SESSION_COOKIE)?.value;
  const claims = token ? readClaims(token) : null;

  if (!claims) {
    return (
      <div className="stack">
        <div>
          <h1>Workspace</h1>
          <p className="lede">
            There is no session on this browser, so there is no token to hand to the embedded
            application. Sign in first &mdash; the iframe is fed from the cookie this login sets,
            and from nothing else.
          </p>
          <p>
            <a className="primary" href="/api/auth/login?returnTo=%2Fworkspace">
              Login with Microsoft
            </a>
          </p>
        </div>
      </div>
    );
  }

  return (
    <div className="stack">
      <div>
        <h1>Workspace</h1>
        <p className="lede">
          The panel on the left is <code>agent-workspace-web</code>, served from{' '}
          <code>{WORKSPACE_ORIGIN}</code> &mdash; a different origin, a different backend, a
          different database. It has no cookie of its own here: it asks for a token, this page
          answers, and the same JWT is validated a second time by an API that has never heard of
          this one.
        </p>
      </div>

      <WorkspaceFrame />

      <section className="card">
        <h2>What to watch for</h2>
        <ol className="muted" style={{ paddingLeft: '1.1rem', lineHeight: 1.75 }}>
          <li>
            <code>TOKEN_REQUIRED</code> arrives from <code>{WORKSPACE_ORIGIN}</code> and is accepted
            only because <code>event.origin</code> matches exactly.
          </li>
          <li>
            <code>AUTH_TOKEN</code> goes back with an explicit <code>targetOrigin</code>. Never{' '}
            <code>&quot;*&quot;</code>.
          </li>
          <li>
            When the token expires, the child&rsquo;s API call 401s and the same two messages run
            again. No second login screen, no third message type.
          </li>
        </ol>
      </section>
    </div>
  );
}
