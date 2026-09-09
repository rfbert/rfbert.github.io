'use client';

/**
 * The Database A surface: steps (3) and (4) of SPEC.txt Section 2, driven from
 * the browser.
 *
 *   GET  :4000/me             -> the LOCAL user row this API provisioned
 *   GET  :4000/conversations  -> scoped server-side to that local row's id
 *   POST :4000/conversations
 *
 * Every call goes through lib/api.ts, which attaches the Bearer, and which
 * renews and retries once if :4000 says 401. Nothing here ever sees a cookie
 * and nothing here writes to storage.
 */
import { useCallback, useEffect, useState } from 'react';

import {
  AuthRequiredError,
  type Conversation,
  type Me,
  createConversation,
  getMe,
  listConversations,
} from '@/lib/api';
import { GATEWAY_API } from '@/lib/config';

export default function HomeDashboard() {
  const [me, setMe] = useState<Me | null>(null);
  const [conversations, setConversations] = useState<Conversation[] | null>(null);
  const [title, setTitle] = useState('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [needsLogin, setNeedsLogin] = useState(false);

  const report = useCallback((cause: unknown) => {
    if (cause instanceof AuthRequiredError) {
      setNeedsLogin(true);
      setError(cause.message);
      return;
    }
    setError(String((cause as Error)?.message ?? cause));
  }, []);

  const load = useCallback(async () => {
    setError(null);
    try {
      const [identity, list] = await Promise.all([getMe(), listConversations()]);
      setMe(identity);
      setConversations(list);
      setNeedsLogin(false);
    } catch (cause) {
      report(cause);
    }
  }, [report]);

  useEffect(() => {
    void load();
  }, [load]);

  const submit = useCallback(
    async (event: React.FormEvent<HTMLFormElement>) => {
      event.preventDefault();
      const value = title.trim();
      if (!value || busy) return;

      setBusy(true);
      setError(null);
      try {
        await createConversation(value);
        setTitle('');
        setConversations(await listConversations());
      } catch (cause) {
        report(cause);
      } finally {
        setBusy(false);
      }
    },
    [busy, report, title],
  );

  return (
    <div className="stack">
      <section className="card">
        <header className="panel-head">
          <div>
            <h2>Database A &mdash; your row</h2>
            <p className="muted">
              from <code>GET {GATEWAY_API}/me</code>. This row was created just-in-time from the
              token&rsquo;s <code>tid</code> + <code>oid</code>, on first contact. It is local to
              this application.
            </p>
          </div>
          <button type="button" className="ghost" onClick={() => void load()}>
            Refresh
          </button>
        </header>

        {me ? (
          <dl className="facts" data-testid="local-user">
            <div>
              <dt>local id</dt>
              <dd>
                <code>{me.id}</code>
              </dd>
            </div>
            <div>
              <dt>display name</dt>
              <dd>{me.displayName}</dd>
            </div>
            <div>
              <dt>tid</dt>
              <dd>
                <code>{me.tid}</code>
              </dd>
            </div>
            <div>
              <dt>oid</dt>
              <dd>
                <code>{me.oid}</code>
              </dd>
            </div>
            <div>
              <dt>database</dt>
              <dd>
                <code>{me.database}</code> (gateway.db)
              </dd>
            </div>
          </dl>
        ) : (
          <p className="muted">{error ? 'not loaded' : 'loading…'}</p>
        )}
      </section>

      <section className="card">
        <header className="panel-head">
          <div>
            <h2>Conversations</h2>
            <p className="muted">
              <code>GET {GATEWAY_API}/conversations</code> &mdash; scoped by the API to your local
              user id, never by a claim from the token.
            </p>
          </div>
        </header>

        <form className="row" onSubmit={submit}>
          <label className="visually-hidden" htmlFor="new-conversation">
            New conversation title
          </label>
          <input
            id="new-conversation"
            name="title"
            value={title}
            placeholder="New conversation title"
            maxLength={200}
            onChange={(event) => setTitle(event.target.value)}
            disabled={busy}
          />
          <button type="submit" className="primary" disabled={busy || title.trim().length === 0}>
            {busy ? 'Creating…' : 'Create'}
          </button>
        </form>

        {conversations === null ? (
          <p className="muted">{error ? 'not loaded' : 'loading…'}</p>
        ) : conversations.length === 0 ? (
          <p className="muted">No conversations yet. Create one &mdash; it will be visible to you and to nobody else.</p>
        ) : (
          <ul className="list" data-testid="conversations">
            {conversations.map((conversation) => (
              <li key={conversation.id}>
                <span className="title">{conversation.title}</span>
                <span className="meta">
                  #{conversation.id} &middot; {new Date(conversation.createdAt).toLocaleString()}
                </span>
              </li>
            ))}
          </ul>
        )}
      </section>

      {error ? (
        <p className="alert">
          {error}
          {needsLogin ? (
            <>
              {' '}
              <a href="/api/auth/login?returnTo=%2F">Sign in again</a>.
            </>
          ) : (
            <>
              {' '}
              Is <code>identity-gateway-api</code> running on {GATEWAY_API}?
            </>
          )}
        </p>
      ) : null}
    </div>
  );
}
