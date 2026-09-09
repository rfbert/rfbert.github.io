'use client';

/**
 * WorkspaceFrame -- THE PARENT HALF OF THE BRIDGE (SPEC.txt 4.2 and 5.3).
 *
 * This component is the entire integration column of the architecture diagram.
 * It embeds agent-workspace-web (:3001) and answers its token requests. There
 * are exactly two messages and no third:
 *
 *     child  -> parent :  { type: "TOKEN_REQUIRED" }
 *     parent -> child  :  { type: "AUTH_TOKEN", token }
 *
 * The same pair serves the first acquisition and every renewal afterwards.
 *
 * NON-NEGOTIABLES, both implemented below:
 *   - the receiver checks event.origin BEFORE reading event.data;
 *   - the sender always passes an explicit targetOrigin. NEVER "*".
 *
 * The visible log is not decoration. The handshake is the claim this scaffold
 * exists to prove, so it is rendered where a human -- and the acceptance
 * harness -- can read it back in order.
 */
import { useCallback, useEffect, useRef, useState } from 'react';

import {
  AUTH_TOKEN,
  TOKEN_REQUIRED,
  WORKSPACE_ORIGIN,
  type AuthTokenMessage,
} from '@/lib/config';

type Direction = 'in' | 'out' | 'info' | 'error';

interface LogEntry {
  id: number;
  at: string;
  direction: Direction;
  text: string;
}

const MAX_ENTRIES = 200;

const LABEL: Record<Direction, string> = {
  in: 'child  -> parent',
  out: 'parent -> child ',
  info: 'bridge          ',
  error: 'bridge  !       ',
};

/** HH:MM:SS.mmm -- enough resolution to see the round trip. */
function stamp(): string {
  return new Date().toISOString().slice(11, 23);
}

export default function WorkspaceFrame() {
  const iframeRef = useRef<HTMLIFrameElement | null>(null);
  const counter = useRef(0);
  const mounted = useRef(true);
  const armed = useRef(false);

  const [entries, setEntries] = useState<LogEntry[]>([]);
  const [frameSrc, setFrameSrc] = useState<string | undefined>(undefined);
  const [problem, setProblem] = useState<string | null>(null);

  const log = useCallback((direction: Direction, text: string) => {
    if (!mounted.current) return;
    setEntries((previous) => {
      const next = [
        ...previous,
        { id: (counter.current += 1), at: stamp(), direction, text },
      ];
      // Oldest first: the order IS the evidence.
      return next.length > MAX_ENTRIES ? next.slice(next.length - MAX_ENTRIES) : next;
    });
  }, []);

  useEffect(() => {
    mounted.current = true;

    async function onMessage(event: MessageEvent) {
      // ---- 1. ORIGIN CHECK, before event.data is touched at all ------------
      if (event.origin !== WORKSPACE_ORIGIN) {
        // Anything else is either another app on this machine or an attack.
        // Either way it is not our child, and we do not read its payload.
        log('error', `ignored a message from ${event.origin || 'an opaque origin'} (expected ${WORKSPACE_ORIGIN})`);
        return;
      }

      const data = event.data as { type?: unknown } | null;
      if (!data || typeof data !== 'object' || data.type !== TOKEN_REQUIRED) {
        return;
      }

      log('in', `${TOKEN_REQUIRED} from ${event.origin}`);

      const frame = iframeRef.current;
      const target = frame?.contentWindow;
      if (!target) {
        log('error', 'the iframe has gone away - nothing to reply to');
        return;
      }
      if (event.source && event.source !== target) {
        log('info', 'note: sender is not this iframe’s window; replying to the iframe only');
      }

      // ---- 2. fetch the live token from OUR OWN server ---------------------
      // The cookie is httpOnly, so this is the only way to obtain it, and it
      // is a same-origin request: the child never sees the cookie itself.
      let payload: { access_token?: string; renewed?: boolean } | null = null;
      try {
        const response = await fetch('/api/auth/token', {
          method: 'GET',
          credentials: 'same-origin',
          cache: 'no-store',
          headers: { accept: 'application/json' },
        });

        if (!response.ok) {
          const body = (await response.json().catch(() => null)) as
            | { error?: string; message?: string }
            | null;
          const reason = body?.error ? `${body.error}: ${body.message ?? ''}` : `HTTP ${response.status}`;
          log('error', `/api/auth/token refused (${reason.trim()}) - no token to hand over`);
          if (mounted.current) setProblem(body?.message || `/api/auth/token returned ${response.status}`);
          return;
        }

        payload = (await response.json()) as { access_token?: string; renewed?: boolean };
      } catch (error) {
        log('error', `/api/auth/token unreachable: ${String((error as Error)?.message ?? error)}`);
        return;
      }

      const token = payload?.access_token;
      if (!token) {
        log('error', '/api/auth/token returned no access_token');
        return;
      }
      if (mounted.current) setProblem(null);

      // ---- 3. EXPLICIT targetOrigin. Never "*". ---------------------------
      const message: AuthTokenMessage = { type: AUTH_TOKEN, token };
      target.postMessage(message, WORKSPACE_ORIGIN);

      const renewed = payload?.renewed ? ' (renewed - a fresh exp, same tid+oid)' : '';
      log('out', `${AUTH_TOKEN} -> ${WORKSPACE_ORIGIN}${renewed}`);
    }

    window.addEventListener('message', onMessage);

    if (!armed.current) {
      armed.current = true;
      log('info', `listening for ${TOKEN_REQUIRED} from ${WORKSPACE_ORIGIN}`);
    }

    // The listener is attached BEFORE the child starts loading, so a request
    // sent the instant it boots cannot be missed.
    setFrameSrc(WORKSPACE_ORIGIN);

    return () => {
      mounted.current = false;
      window.removeEventListener('message', onMessage);
    };
  }, [log]);

  const reloadFrame = useCallback(() => {
    const frame = iframeRef.current;
    if (!frame) return;
    log('info', 'reloading the iframe');
    // Re-assigning src re-runs the child's own acquisition handshake.
    frame.src = WORKSPACE_ORIGIN;
  }, [log]);

  return (
    <section className="bridge">
      <div className="frame-panel">
        <header className="panel-head">
          <div>
            <h2>agent-workspace-web</h2>
            <p className="muted">
              embedded from <code>{WORKSPACE_ORIGIN}</code> &mdash; a second application, with its
              own backend and its own database, running on this one token
            </p>
          </div>
          <button type="button" className="ghost" onClick={reloadFrame}>
            Reload frame
          </button>
        </header>

        <iframe
          ref={iframeRef}
          src={frameSrc}
          title="agent-workspace-web"
          className="workspace-frame"
          // No sandbox attribute: the child needs its own origin and script
          // access. It is isolated by origin, and fed only through the relay.
        />
      </div>

      <div className="log-panel">
        <header className="panel-head">
          <div>
            <h2>postMessage handshake</h2>
            <p className="muted">
              every message across the iframe boundary, oldest first &mdash; origin-checked in,
              explicitly targeted out
            </p>
          </div>
        </header>

        {problem ? <p className="alert">{problem}</p> : null}

        <ol id="handshake-log" className="handshake-log">
          {entries.length === 0 ? (
            <li className="handshake-empty">waiting for the child application to boot&hellip;</li>
          ) : (
            entries.map((entry) => (
              <li
                key={entry.id}
                data-testid="handshake-entry"
                data-direction={entry.direction}
                className={`handshake-entry dir-${entry.direction}`}
              >
                {/* the literal spaces keep textContent readable when the log
                    is scraped as one string, not just when it is laid out */}
                <span className="ts">{entry.at}</span>{' '}
                <span className="dir">{LABEL[entry.direction]}</span>{' '}
                <span className="msg">{entry.text}</span>
              </li>
            ))
          )}
        </ol>
      </div>
    </section>
  );
}
