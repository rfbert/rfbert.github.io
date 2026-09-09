/**
 * Home (SPEC.txt 4.2).
 *
 * Signed out: the "Login with Microsoft" button, and nothing else.
 * Signed in:  the claims that came back from the IdP, the LOCAL row those
 *             claims were resolved to in Database A, this user's
 *             conversations, a form to create one, a link to /workspace and
 *             logout.
 *
 * The token is read here on the SERVER, from the httpOnly cookie, and only the
 * claims are rendered. The token itself is never written into the HTML.
 */
import { cookies } from 'next/headers';

import HomeDashboard from '@/components/HomeDashboard';
import { SESSION_COOKIE } from '@/lib/config';
import { isExpired, readClaims, secondsRemaining } from '@/lib/session';

export const dynamic = 'force-dynamic';

function iso(seconds: number | undefined): string {
  if (typeof seconds !== 'number') return 'unknown';
  return `${new Date(seconds * 1000).toISOString().replace('T', ' ').slice(0, 19)}Z`;
}

export default async function HomePage({
  searchParams,
}: {
  searchParams: Promise<{ [key: string]: string | string[] | undefined }>;
}) {
  const params = await searchParams;
  const rawError = params.error;
  const error = Array.isArray(rawError) ? rawError[0] : rawError;

  const jar = await cookies();
  const token = jar.get(SESSION_COOKIE)?.value;
  const claims = token ? readClaims(token) : null;

  if (!claims) {
    return (
      <div className="stack">
        <div>
          <h1>One identity, two applications</h1>
          <p className="lede">
            Sign in once. The JWT that comes back is validated independently by two separate
            backends, each of which provisions you into its own database, keyed on the{' '}
            <code>tid</code> + <code>oid</code> claim pair. There is no token exchange, no shared
            session store and no second login.
          </p>
          <p>
            <a className="primary" href="/api/auth/login?returnTo=%2F">
              Login with Microsoft
            </a>
          </p>
        </div>

        {error ? <p className="alert">Sign-in failed &mdash; {error}</p> : null}

        <section className="card">
          <h2>What happens when you click</h2>
          <ol className="muted" style={{ paddingLeft: '1.1rem', lineHeight: 1.75 }}>
            <li>
              302 to <code>/authorize</code> on the identity provider, with a CSRF{' '}
              <code>state</code>.
            </li>
            <li>
              The code comes back to <code>/api/auth/callback</code> and is exchanged for an RS256
              JWT.
            </li>
            <li>
              That JWT is stored in an <strong>httpOnly, SameSite=Lax cookie</strong> &mdash; never
              in localStorage or sessionStorage.
            </li>
            <li>
              Pages read it back through <code>/api/auth/token</code>, which is also what feeds the
              iframe on <a href="/workspace">/workspace</a>.
            </li>
          </ol>
        </section>
      </div>
    );
  }

  const expired = isExpired(claims);

  return (
    <div className="stack">
      <div>
        <h1>Signed in as {claims.name ?? 'unknown user'}</h1>
        <p className="lede">
          One login has produced one token. Below is what that token asserts, and what{' '}
          <code>identity-gateway-api</code> made of it in Database A. Then open{' '}
          <a href="/workspace">/workspace</a> to watch the same token cross into a completely
          separate application.
        </p>
        <p className="row" style={{ alignItems: 'center' }}>
          <a className="primary" href="/workspace">
            Open the workspace &rarr;
          </a>
          <form action="/api/auth/logout" method="post">
            <button type="submit" className="ghost">
              Log out
            </button>
          </form>
        </p>
      </div>

      <section className="card">
        <header className="panel-head">
          <div>
            <h2>Token claims</h2>
            <p className="muted">
              Decoded from the httpOnly cookie on the server. The signature is not checked here on
              purpose &mdash; the two APIs verify it against the issuer&rsquo;s JWKS, and they are
              the only opinion that counts.
            </p>
          </div>
          <span className={`badge ${expired ? 'stale' : 'live'}`}>
            {expired ? 'expired - will renew' : `${secondsRemaining(claims)}s left`}
          </span>
        </header>

        <dl className="facts" data-testid="claims">
          <div>
            <dt>name</dt>
            <dd>{claims.name ?? '-'}</dd>
          </div>
          <div>
            <dt>preferred_username</dt>
            <dd>{claims.preferred_username ?? '-'}</dd>
          </div>
          <div>
            <dt>tid (join key)</dt>
            <dd>
              <code>{claims.tid ?? '-'}</code>
            </dd>
          </div>
          <div>
            <dt>oid (join key)</dt>
            <dd>
              <code>{claims.oid ?? '-'}</code>
            </dd>
          </div>
          <div>
            <dt>aud</dt>
            <dd>
              <code>{Array.isArray(claims.aud) ? claims.aud.join(', ') : claims.aud ?? '-'}</code>
            </dd>
          </div>
          <div>
            <dt>scp</dt>
            <dd>
              <code>{claims.scp ?? '-'}</code>
            </dd>
          </div>
          <div>
            <dt>iss</dt>
            <dd>
              <code>{claims.iss ?? '-'}</code>
            </dd>
          </div>
          <div>
            <dt>exp</dt>
            <dd>
              <code>{iso(claims.exp)}</code>
            </dd>
          </div>
        </dl>
      </section>

      <HomeDashboard />
    </div>
  );
}
