'use client';

/**
 * The workspace UI (SPEC.txt 4.4: "On mount: await getToken(), then list and
 * create analyses").
 *
 * It is also the visible evidence for acceptance tests 4, 5, 6 and 7, so five
 * things are rendered with stable test ids and are never hidden behind a
 * collapsed panel:
 *
 *   data-testid="mode"      iframe vs standalone -- the mode the ONE codebase
 *                           resolved at runtime. Rendered only after mount, so
 *                           whatever a reader (or the harness) sees is the
 *                           decided value and never a placeholder.
 *   data-testid="identity"  tid + oid as resolved by :4001 from the token,
 *                           alongside the LOCAL Database B row id. Same tid and
 *                           oid as gateway.db, different row: test 5.
 *   data-testid="status"    token acquisition and renewal, in words. A silent
 *                           renewal proves nothing; this line is the proof.
 *   data-testid="refresh"   an authenticated round trip on demand. After the
 *                           120s expiry this is what drives
 *                           401 -> TOKEN_REQUIRED -> AUTH_TOKEN -> retry -> 200.
 *   data-testid="db-row"    the Database B primary key on its own.
 *
 * WHAT IS DELIBERATELY ABSENT: any branch that reads a cookie, any storage
 * call, and any second code path for the framed case. The page fetches the
 * same way in both modes; only lib/token.ts knows where the token came from.
 */

import { FormEvent, useCallback, useEffect, useState } from 'react';

import { Analysis, ApiError, Me, createAnalysis, fetchAnalyses, fetchMe } from '../lib/api';
import { GATEWAY_ORIGIN, WORKSPACE_API, WORKSPACE_ORIGIN } from '../lib/config';
import {
  LoginRequiredError,
  Mode,
  TokenEvent,
  getMode,
  getToken,
  primeBridge,
  subscribeToTokenEvents,
  tokenFingerprint,
} from '../lib/token';

const clock = (at: number): string => new Date(at).toLocaleTimeString();

export default function WorkspacePage() {
  // `mounted` gates everything that differs between server and client. The
  // server cannot know whether it is framed, so it renders none of it.
  const [mounted, setMounted] = useState(false);
  const [mode, setMode] = useState<Mode>('standalone');

  const [identity, setIdentity] = useState<Me | null>(null);
  const [analyses, setAnalyses] = useState<Analysis[]>([]);
  const [events, setEvents] = useState<TokenEvent[]>([]);

  const [status, setStatus] = useState('starting up');
  const [failed, setFailed] = useState(false);
  const [needsLogin, setNeedsLogin] = useState(false);
  const [busy, setBusy] = useState(false);
  const [text, setText] = useState('');
  const [authError, setAuthError] = useState<string | null>(null);

  /** One place where every failure is turned into something readable. */
  const report = useCallback((error: unknown, what: string) => {
    if (error instanceof LoginRequiredError) {
      // Standalone, no session yet. Not a fault -- the user's move.
      setNeedsLogin(true);
      setFailed(false);
      setStatus('standalone mode: no session yet -- sign in to continue');
      return;
    }
    const detail =
      error instanceof ApiError
        ? `${what} failed -- ${error.message}`
        : `${what} failed -- ${error instanceof Error ? error.message : String(error)}`;
    setFailed(true);
    // NOTE: identity and analyses are left untouched on purpose. A failed
    // refresh must not erase what the last successful call established.
    setStatus(detail);
  }, []);

  /**
   * Acquire a token if needed, then load identity + analyses.
   *
   * getToken() is awaited explicitly first so the status line can narrate the
   * handshake before any HTTP happens; the two fetches then share the token
   * already in memory. If it has expired, lib/api.ts turns the resulting 401
   * into a forced re-acquisition and one retry -- and both fetches share the
   * single re-acquisition, so one expiry produces one TOKEN_REQUIRED.
   */
  const load = useCallback(
    async (reason: string) => {
      setBusy(true);
      setFailed(false);
      setStatus(`${reason}: acquiring token...`);
      try {
        await getToken();
        setStatus(`${reason}: token held in memory (${tokenFingerprint() ?? 'n/a'}) -- calling :4001`);

        const [me, list] = await Promise.all([fetchMe(), fetchAnalyses()]);
        setIdentity(me);
        setAnalyses(list);
        setNeedsLogin(false);
        setStatus(
          `${reason}: OK -- Database ${me.database} row #${me.id} for oid ${me.oid} ` +
            `(token ${tokenFingerprint() ?? 'n/a'}, ${list.length} analys${list.length === 1 ? 'is' : 'es'})`,
        );
      } catch (error) {
        report(error, reason);
      } finally {
        setBusy(false);
      }
    },
    [report],
  );

  useEffect(() => {
    setMounted(true);
    primeBridge(); // start listening before asking, so a pushed token is never missed
    setMode(getMode());

    const unsubscribe = subscribeToTokenEvents(setEvents);

    const params = new URLSearchParams(window.location.search);
    const failure = params.get('auth_error');
    if (failure) setAuthError(failure);

    void load('initial load');
    return unsubscribe;
  }, [load]);

  async function onCreate(event: FormEvent<HTMLFormElement>): Promise<void> {
    event.preventDefault();
    const inputText = text.trim();
    if (!inputText || busy) return;

    setBusy(true);
    setFailed(false);
    setStatus(`creating analysis: POST /analyses`);
    try {
      const created = await createAnalysis(inputText);
      setAnalyses((current) => [created, ...current]);
      setText('');
      setStatus(`created analysis #${created.id} -- stored against Database B row #${created.userId}`);
    } catch (error) {
      report(error, 'POST /analyses');
    } finally {
      setBusy(false);
    }
  }

  const acquisitions = events.filter((event) => event.kind === 'received').length;
  const framed = mode === 'iframe';
  const latest = events.length > 0 ? events[events.length - 1] : null;

  return (
    <main>
      <h1>Agent Workspace</h1>
      <p className="lede">
        Next.js 2 on {WORKSPACE_ORIGIN}. One codebase, two modes: embedded in the identity gateway,
        or standing on its own. The backend it talks to ({WORKSPACE_API}) cannot tell the difference.
      </p>

      {/* ------------------------------------------------------------- mode */}
      <section className="panel">
        <h2>Mode</h2>
        <div className="row">
          {mounted ? (
            <span className={`badge${framed ? '' : ' standalone'}`} data-testid="mode">
              {framed
                ? `iframe mode - embedded child of ${GATEWAY_ORIGIN}`
                : 'standalone mode - independent, own login'}
            </span>
          ) : (
            <span className="small">detecting mode (window.self !== window.top)...</span>
          )}
        </div>
        {mounted && (
          <p className="small" style={{ marginBottom: 0 }}>
            {framed ? (
              <>
                The token arrives over postMessage from {GATEWAY_ORIGIN} and is held in memory only.
                No cookie is read here, and there is no second login.
              </>
            ) : (
              <>
                Nothing is above this window, so it runs its own OIDC login through its own
                /api/auth/* routes -- same app registration, same audience, unchanged backend.
              </>
            )}
          </p>
        )}
      </section>

      {/* ----------------------------------------------------------- status */}
      <section className="panel">
        <h2>Status</h2>
        <p className={`status${failed ? ' err' : ''}`} data-testid="status">
          {status}
          {latest ? ` | last bridge event: ${latest.message}` : ''}
          {` | token acquisitions: ${acquisitions}`}
        </p>

        <div className="row" style={{ marginTop: '.65rem' }}>
          <button
            type="button"
            data-testid="refresh"
            onClick={() => void load('refresh')}
            disabled={busy}
          >
            {busy ? 'working...' : 'Refresh (authenticated call)'}
          </button>

          {mounted && !framed && needsLogin && (
            <a className="button" href="/api/auth/login" data-testid="login">
              Login with Microsoft
            </a>
          )}
          {mounted && !framed && !needsLogin && (
            <a className="small" href="/api/auth/logout" data-testid="logout">
              Sign out
            </a>
          )}
        </div>

        {authError && (
          <p className="small" style={{ marginBottom: 0 }}>
            Last login attempt failed: <span className="mono">{authError}</span>
          </p>
        )}
      </section>

      {/* --------------------------------------------------------- identity */}
      <section className="panel">
        <h2>Identity, as resolved by agent-workspace-api (Database B)</h2>
        {identity ? (
          <>
            <dl className="kv" data-testid="identity">
              <dt>name</dt>
              <dd>{identity.displayName}</dd>
              <dt>tid</dt>
              <dd data-testid="tid">{identity.tid}</dd>
              <dt>oid</dt>
              <dd data-testid="oid">{identity.oid}</dd>
              <dt>database</dt>
              <dd>{identity.database} (workspace.db)</dd>
              <dt>local row id</dt>
              <dd data-testid="db-row">#{identity.id}</dd>
            </dl>
            <p className="small" style={{ marginBottom: 0 }}>
              tid + oid came from the token. Row #{identity.id} is this database&apos;s own,
              JIT-created on first call -- identity-gateway-api holds a different row, with a
              different id, for the same person. Two databases, one identity, one login.
            </p>
          </>
        ) : (
          <p className="small" style={{ margin: 0 }}>
            {needsLogin ? 'Not signed in.' : 'Resolving identity from the token...'}
          </p>
        )}
      </section>

      {/* --------------------------------------------------------- analyses */}
      <section className="panel">
        <h2>Document analyses (Database B, scoped to this user)</h2>
        <form className="analyse" onSubmit={onCreate} data-testid="analysis-form">
          <input
            type="text"
            value={text}
            placeholder="Text to analyse..."
            onChange={(event) => setText(event.target.value)}
            data-testid="analysis-input"
            aria-label="Text to analyse"
          />
          <button type="submit" data-testid="analysis-submit" disabled={busy || text.trim() === ''}>
            Analyse
          </button>
        </form>

        <ul className="list" data-testid="analyses" style={{ marginTop: '.75rem' }}>
          {analyses.length === 0 && (
            <li className="small">No analyses yet for this user.</li>
          )}
          {analyses.map((analysis) => (
            <li key={analysis.id} data-testid="analysis">
              <div>
                <strong>#{analysis.id}</strong> {analysis.inputText}
              </div>
              <div className="small mono">
                {analysis.result?.summary} | sentiment {analysis.result?.sentiment} | tokens{' '}
                {analysis.result?.tokens}
              </div>
            </li>
          ))}
        </ul>
      </section>

      {/* -------------------------------------------------------------- log */}
      <section className="panel">
        <h2>Token bridge log (child side)</h2>
        <ul className="log">
          {events.length === 0 && <li>no events yet</li>}
          {events.map((event) => (
            <li key={event.id} className={event.kind} data-testid="log-entry">
              <time>{clock(event.at)}</time>
              {event.message}
            </li>
          ))}
        </ul>
        <p className="small" style={{ marginBottom: 0 }}>
          The token is held in a module variable and nowhere else -- no localStorage, no
          sessionStorage, and while framed, no cookie.
        </p>
      </section>
    </main>
  );
}
