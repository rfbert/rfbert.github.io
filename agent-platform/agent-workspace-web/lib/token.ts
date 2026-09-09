'use client';

/**
 * ============================================================================
 * THE CHILD HALF OF THE BRIDGE          SPEC.txt 4.4 / 5.3, runtime step (5)
 * ============================================================================
 *
 * One codebase, two modes, decided by one line:
 *
 *     const framed = window.self !== window.top
 *
 *   IFRAME MODE      the parent (identity-gateway-web, :3000) already holds a
 *                    session. This app asks for the token and is given it:
 *
 *                        child  -> parent : { type: "TOKEN_REQUIRED" }
 *                        parent -> child  : { type: "AUTH_TOKEN", token }
 *
 *                    No cookie. No second login. No third message type: the
 *                    same pair serves both first acquisition and renewal.
 *
 *   STANDALONE MODE  nobody is above us, so this app runs its own OIDC login
 *                    through its own app/api/auth/* routes -- against the SAME
 *                    app registration and the SAME audience, which is why
 *                    agent-workspace-api needs no change to accept the result
 *                    (acceptance test 7).
 *
 * THE FOUR NON-NEGOTIABLE RULES (SPEC.txt 5.3 and Section 8), and where each
 * one is enforced below:
 *
 *   1. Sender always passes an explicit targetOrigin, NEVER "*".
 *      -> postMessage(..., GATEWAY_ORIGIN) in requestTokenFromParent().
 *
 *   2. Receiver always checks event.origin BEFORE reading event.data.
 *      -> the first statement in the message handler is the origin test, and
 *         it returns early. event.data is not touched until it passes.
 *
 *   3. The token is held IN MEMORY ONLY. No localStorage, no sessionStorage,
 *      and in iframe mode no cookie either.
 *      -> `tokenInMemory`, a module-level variable, is the only storage in
 *         this file. Search it: the strings "localStorage" and
 *         "sessionStorage" appear nowhere below except in this comment.
 *
 *   4. A broken handshake must fail LOUDLY, not hang.
 *      -> HANDSHAKE_TIMEOUT_MS rejects with a diagnostic naming the likely
 *         causes. A silent hang here would look identical to a CSP failure,
 *         and the two need different fixes.
 */

import { GATEWAY_ORIGIN } from './config';

/* -------------------------------------------------------------------- mode */

export type Mode = 'iframe' | 'standalone';

/**
 * The mode detection, verbatim from the spec.
 *
 * The try/catch is not decoration: `window.top` is a cross-origin WindowProxy
 * when framed by another origin. Reading it is permitted, but a hardened
 * browser or an unusual sandbox can throw -- and a throw means there IS
 * something above us, so the honest answer is "iframe".
 *
 * On the server (prerender) there is no window at all. "standalone" is the
 * correct SSR answer because it is what an unframed first paint looks like;
 * the client corrects it on mount before anything is fetched.
 */
export function detectMode(): Mode {
  if (typeof window === 'undefined') return 'standalone';
  try {
    return window.self !== window.top ? 'iframe' : 'standalone';
  } catch {
    return 'iframe';
  }
}

let resolvedMode: Mode | null = null;

/** The current mode, memoised. Exported so the UI can display it. */
export function getMode(): Mode {
  if (resolvedMode === null) resolvedMode = detectMode();
  return resolvedMode;
}

/* ------------------------------------------------------------- the storage */

/**
 * THE ENTIRE TOKEN STORE.
 *
 * A module-level variable in a browser tab: gone on reload, gone on navigation,
 * invisible to every other origin, and never serialised anywhere. SPEC.txt
 * Section 8: "Do not store the token in localStorage or sessionStorage."
 */
let tokenInMemory: string | null = null;

/** Is a token currently held? (For display only -- never returns the token.) */
export function hasToken(): boolean {
  return tokenInMemory !== null;
}

/** Drop the in-memory token. The next getToken() re-acquires from scratch. */
export function clearToken(): void {
  tokenInMemory = null;
}

/**
 * A redacted fingerprint of the held token, so the UI can SHOW that a renewal
 * produced a genuinely different token without ever printing the token.
 */
export function tokenFingerprint(): string | null {
  if (tokenInMemory === null) return null;
  const signature = tokenInMemory.split('.')[2] ?? tokenInMemory;
  return `...${signature.slice(-8)}`;
}

/* -------------------------------------------------------------- event feed */

export type TokenEventKind = 'sent' | 'received' | 'info' | 'error';

export interface TokenEvent {
  id: number;
  at: number;
  kind: TokenEventKind;
  message: string;
}

const MAX_EVENTS = 40;
const eventLog: TokenEvent[] = [];
const subscribers = new Set<(events: TokenEvent[]) => void>();
let nextEventId = 1;

/**
 * Record something the user (and the acceptance harness) should be able to
 * SEE. Token acquisition is otherwise invisible, and "invisible" is how a
 * renewal loop that silently never fires passes review.
 */
export function emit(kind: TokenEventKind, message: string): void {
  const event: TokenEvent = { id: nextEventId++, at: Date.now(), kind, message };
  eventLog.push(event);
  if (eventLog.length > MAX_EVENTS) eventLog.shift();

  // Also to the console: acceptance test 4 reads the browser console for the
  // TOKEN_REQUIRED / AUTH_TOKEN pair.
  const line = `[workspace:${getMode()}] ${message}`;
  if (kind === 'error') console.error(line);
  else console.log(line);

  const snapshot = [...eventLog];
  subscribers.forEach((fn) => fn(snapshot));
}

/** Subscribe to the event feed. Returns an unsubscribe function. */
export function subscribeToTokenEvents(fn: (events: TokenEvent[]) => void): () => void {
  subscribers.add(fn);
  fn([...eventLog]);
  return () => {
    subscribers.delete(fn);
  };
}

/* ------------------------------------------------------------------ errors */

/**
 * Standalone mode has no session yet, so the UI must offer a login link.
 * Distinct from a transport failure: this one is the user's move, not a bug.
 */
export class LoginRequiredError extends Error {
  constructor(message = 'No standalone session yet. Sign in to continue.') {
    super(message);
    this.name = 'LoginRequiredError';
  }
}

/** The parent never answered, or answered with something unusable. */
export class HandshakeError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'HandshakeError';
  }
}

/* ------------------------------------------------- the postMessage listener */

interface Waiter {
  resolve: (token: string) => void;
  reject: (error: Error) => void;
}

const waiters = new Set<Waiter>();
let listenerAttached = false;

/**
 * Attach the AUTH_TOKEN listener exactly once, for the life of the page.
 *
 * It is deliberately NOT scoped to a single in-flight request: the parent is
 * allowed to PUSH a renewed token at any moment ("AUTH_TOKEN renovado" in the
 * source diagram) without the child having just asked. A persistent listener
 * accepts that; a per-request listener would drop it on the floor.
 */
function ensureBridgeListener(): void {
  if (listenerAttached || typeof window === 'undefined') return;
  listenerAttached = true;

  window.addEventListener('message', (event: MessageEvent) => {
    // ---------------------------------------------------------------------
    // RULE 2, AND IT IS THE FIRST LINE ON PURPOSE.
    // Any window on the page can postMessage into this frame. Until the origin
    // is confirmed to be the gateway, event.data is hostile input and is not
    // read -- not to log it, not to sniff its type, not at all.
    // ---------------------------------------------------------------------
    if (event.origin !== GATEWAY_ORIGIN) return;

    const data = event.data as { type?: unknown; token?: unknown } | null | undefined;
    if (!data || typeof data !== 'object') return;
    if (data.type !== 'AUTH_TOKEN') return;

    const token = data.token;
    if (typeof token !== 'string' || token.length === 0) {
      emit('error', 'AUTH_TOKEN arrived from the gateway with no usable token');
      return;
    }

    // The renewal path and the first-acquisition path are the same path.
    const renewal = tokenInMemory !== null && tokenInMemory !== token;
    tokenInMemory = token;
    emit(
      'received',
      renewal
        ? `AUTH_TOKEN (renewed) received from ${GATEWAY_ORIGIN} -- held in memory ${tokenFingerprint()}`
        : `AUTH_TOKEN received from ${GATEWAY_ORIGIN} -- held in memory ${tokenFingerprint()}`,
    );

    const pending = [...waiters];
    waiters.clear();
    pending.forEach((waiter) => waiter.resolve(token));
  });
}

/* --------------------------------------------------- iframe-mode acquisition */

/** A stuck handshake must fail within a human attention span, with a reason. */
const HANDSHAKE_TIMEOUT_MS = 10_000;

/**
 * The parent may still be mounting its own message listener when this frame
 * finishes loading -- a genuine race on a cold start. TOKEN_REQUIRED is
 * idempotent by design, so it is simply re-sent a couple of times inside the
 * timeout window rather than being made into a fragile ordering assumption.
 */
const RETRY_AFTER_MS = [1_200, 3_500, 6_500];

function requestTokenFromParent(): Promise<string> {
  ensureBridgeListener();

  return new Promise<string>((resolve, reject) => {
    const timers: ReturnType<typeof setTimeout>[] = [];

    const waiter: Waiter = {
      resolve: (token) => {
        cleanup();
        resolve(token);
      },
      reject: (error) => {
        cleanup();
        reject(error);
      },
    };

    function cleanup(): void {
      waiters.delete(waiter);
      timers.forEach(clearTimeout);
      timers.length = 0;
    }

    waiters.add(waiter);

    const send = (attempt: number): void => {
      // ---------------------------------------------------------------------
      // RULE 1. An explicit targetOrigin, and it is a constant.
      // postMessage(msg, "*") would broadcast the request -- and, worse, teach
      // the next reader that "*" is acceptable here. It is not: the browser
      // must refuse to deliver this if the parent is not the gateway.
      // ---------------------------------------------------------------------
      window.parent.postMessage({ type: 'TOKEN_REQUIRED' }, GATEWAY_ORIGIN);
      emit(
        'sent',
        attempt === 0
          ? `TOKEN_REQUIRED -> ${GATEWAY_ORIGIN}`
          : `TOKEN_REQUIRED -> ${GATEWAY_ORIGIN} (retry ${attempt})`,
      );
    };

    send(0);
    RETRY_AFTER_MS.forEach((delay, index) => {
      timers.push(setTimeout(() => send(index + 1), delay));
    });

    timers.push(
      setTimeout(() => {
        waiter.reject(
          new HandshakeError(
            `No AUTH_TOKEN from ${GATEWAY_ORIGIN} within ${HANDSHAKE_TIMEOUT_MS}ms. ` +
              'The parent did not answer TOKEN_REQUIRED. Likely causes: the gateway is not ' +
              'listening for message events, it posted to a different targetOrigin, it has no ' +
              'session cookie to hand out, or this frame is embedded by an origin other than ' +
              `${GATEWAY_ORIGIN}.`,
          ),
        );
      }, HANDSHAKE_TIMEOUT_MS),
    );
  });
}

/* ----------------------------------------------- standalone-mode acquisition */

/**
 * Standalone mode: this app's own /api/auth/token hands out the access token
 * from its own httpOnly cookie session, minting a fresh one from the IdP when
 * the current one has expired.
 *
 * The token still ends up ONLY in `tokenInMemory` on the client. The cookie is
 * httpOnly and stays on the server side of the boundary; JavaScript here never
 * sees it and never stores what it receives.
 *
 * THIS FUNCTION IS UNREACHABLE IN IFRAME MODE. getToken() branches on the mode
 * before calling it, which is what makes "the workspace never depends on
 * cookies while framed" a structural property rather than a promise.
 */
async function fetchTokenFromOwnSession(): Promise<string> {
  const response = await fetch('/api/auth/token', {
    credentials: 'same-origin',
    cache: 'no-store',
    headers: { accept: 'application/json' },
  });

  if (response.status === 401) {
    emit('info', 'no standalone session -- login required');
    throw new LoginRequiredError();
  }
  if (!response.ok) {
    const message = `/api/auth/token returned ${response.status}`;
    emit('error', message);
    throw new Error(message);
  }

  const body: unknown = await response.json();
  const token =
    body && typeof body === 'object' ? (body as { access_token?: unknown }).access_token : undefined;

  if (typeof token !== 'string' || token.length === 0) {
    const message = '/api/auth/token returned no access_token';
    emit('error', message);
    throw new Error(message);
  }

  const renewal = tokenInMemory !== null && tokenInMemory !== token;
  tokenInMemory = token;
  emit(
    'received',
    renewal
      ? `token (renewed) issued by own session -- held in memory ${tokenFingerprint()}`
      : `token issued by own session -- held in memory ${tokenFingerprint()}`,
  );
  return token;
}

/* ---------------------------------------------------------------- getToken */

let inFlight: Promise<string> | null = null;

export interface GetTokenOptions {
  /**
   * Discard the held token and acquire a new one.
   *
   * This is what lib/api.ts passes on an HTTP 401, and it is the trigger for
   * the renewal half of the handshake. Without it a 401 retry would replay the
   * SAME expired token and fail identically -- a retry loop that proves
   * nothing.
   */
  force?: boolean;
}

/**
 * Get a usable access token, acquiring one if necessary.
 *
 * Concurrent callers share one acquisition: a page that fires /me and
 * /analyses together must produce ONE TOKEN_REQUIRED, not two. The shared
 * promise is safe for forced calls too, because every acquisition asks the
 * source for a token fresh -- there is no path that resolves a forced request
 * with a cached value.
 */
export async function getToken(options: GetTokenOptions = {}): Promise<string> {
  const force = options.force === true;

  if (force && tokenInMemory !== null) {
    emit('info', `discarding rejected token ${tokenFingerprint()} -- forcing re-acquisition`);
    tokenInMemory = null;
  }

  if (!force && tokenInMemory !== null) return tokenInMemory;
  if (inFlight !== null) return inFlight;

  const mode = getMode();
  emit(
    'info',
    mode === 'iframe'
      ? 'acquiring token from parent frame (iframe mode -- no cookie, no second login)'
      : 'acquiring token from own session (standalone mode)',
  );

  inFlight = (mode === 'iframe' ? requestTokenFromParent() : fetchTokenFromOwnSession()).finally(
    () => {
      inFlight = null;
    },
  );

  return inFlight;
}

/**
 * Renew a token that agent-workspace-api has just rejected.
 *
 * This is what lib/api.ts calls on a 401, and it exists because
 * getToken({ force: true }) is slightly too blunt when several requests are in
 * flight at once. The page loads /me and /analyses together; both were sent
 * with the same token; both come back 401. The first one renews. By the time
 * the second one is handled there is already a NEW, working token in memory --
 * and forcing again would throw that good token away and run a second, pointless
 * handshake, which is exactly what the first version of this file did.
 *
 * So: force only if the token being complained about is still the current one.
 * Otherwise the complaint is stale and the renewal already happened.
 *
 *   N parallel 401s on one expiry  ->  ONE TOKEN_REQUIRED, N retries.
 */
export async function renewToken(rejected: string): Promise<string> {
  if (tokenInMemory !== null && tokenInMemory !== rejected) {
    emit('info', 'token was already renewed by a concurrent request -- reusing it');
    return tokenInMemory;
  }
  return getToken({ force: true });
}

/**
 * Start the bridge listener as early as possible in iframe mode, so a token
 * the parent pushes unprompted is never missed.
 */
export function primeBridge(): void {
  if (getMode() === 'iframe') ensureBridgeListener();
}
