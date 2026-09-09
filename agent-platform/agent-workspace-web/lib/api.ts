'use client';

/**
 * ============================================================================
 * THE RENEWAL LOOP                       SPEC.txt 4.4, runtime step (6) + (5)
 * ============================================================================
 *
 * "fetch wrapper: attach Bearer. ON HTTP 401 -> call getToken() again ->
 *  retry the request once. This is the renewal loop."
 *
 * Four lines of spec, and acceptance test 6 is entirely about them:
 *
 *     wait past the 120s expiry, click something, and expect
 *         401 -> TOKEN_REQUIRED -> AUTH_TOKEN -> retry -> 200
 *     with no visible interruption and no second login screen.
 *
 * Three properties make that work rather than merely look like it works:
 *
 *   FORCED RE-ACQUISITION. The retry calls renewToken(), which forces a fresh
 *   TOKEN_REQUIRED for the token that was rejected. A plain getToken() would
 *   hand back the very token that was just rejected and the retry would 401
 *   identically -- a loop that runs and proves nothing. Forcing is what turns a
 *   retry into a RENEWAL; renewToken() adds only the concurrency rule, so N
 *   requests failing on one expiry produce ONE handshake, not N.
 *
 *   EXACTLY ONE RETRY. Not a loop, not a backoff schedule. If a freshly minted
 *   token is also rejected, the problem is not expiry -- it is a broken issuer,
 *   audience or scope -- and retrying would bury the very failure this
 *   scaffold exists to surface (SPEC.txt 5.1).
 *
 *   IT IS VISIBLE. Every step emits into the shared event feed that the status
 *   line renders. A silent renewal is indistinguishable from a renewal that
 *   never happened.
 *
 * The token is attached as an Authorization header and nothing else: no cookie
 * (credentials: 'omit'), no query parameter, no custom header. :4001 allows
 * exactly this origin in CORS and requires exactly this header.
 */

import { WORKSPACE_API } from './config';
import { emit, getToken, renewToken } from './token';

/** A non-2xx answer from agent-workspace-api, with its body kept for display. */
export class ApiError extends Error {
  readonly status: number;
  readonly body: string;

  constructor(status: number, body: string, path: string) {
    super(`${path} -> HTTP ${status}${body ? `: ${body.slice(0, 200)}` : ''}`);
    this.name = 'ApiError';
    this.status = status;
    this.body = body;
  }
}

/** GET /me on :4001 -- the LOCAL DATABASE B row, JIT-provisioned from (tid, oid). */
export interface Me {
  id: number;
  tid: string;
  oid: string;
  displayName: string;
  createdAt: string;
  database: string;
}

/** The mock AI result agent-workspace-api got from agent-api and stored. */
export interface AnalysisResult {
  summary: string;
  sentiment: string;
  tokens: number;
}

/** A row in DATABASE B's document_analyses table. */
export interface Analysis {
  id: number;
  userId: number;
  inputText: string;
  result: AnalysisResult;
  createdAt: string;
}

/** One attempt: attach the Bearer token, send, return the raw Response. */
async function send(path: string, init: RequestInit, token: string): Promise<Response> {
  const headers = new Headers(init.headers);
  headers.set('authorization', `Bearer ${token}`);
  headers.set('accept', 'application/json');
  if (init.body !== undefined && !headers.has('content-type')) {
    headers.set('content-type', 'application/json');
  }

  return fetch(`${WORKSPACE_API}${path}`, {
    ...init,
    headers,
    // No cookies, in either mode. The Bearer token is the whole credential --
    // which is what lets the identical request work from inside the iframe,
    // where a cross-site cookie would not be sent anyway.
    credentials: 'omit',
    cache: 'no-store',
  });
}

/**
 * Call agent-workspace-api with the current token, renewing once on 401.
 */
export async function apiFetch<T>(path: string, init: RequestInit = {}): Promise<T> {
  const method = (init.method ?? 'GET').toUpperCase();

  let token = await getToken();
  let response = await send(path, init, token);

  if (response.status === 401) {
    // ------------------------------------------------------------------
    // THE RENEWAL LOOP. This is the branch acceptance test 6 observes.
    // ------------------------------------------------------------------
    emit('info', `401 from ${method} ${path} -- token rejected, re-acquiring`);

    // renewToken() forces a fresh TOKEN_REQUIRED for the token that was
    // actually rejected, and lets a request whose sibling already renewed
    // piggyback on that one handshake instead of starting another.
    token = await renewToken(token);
    response = await send(path, init, token);

    emit(
      response.ok ? 'info' : 'error',
      response.ok
        ? `retry of ${method} ${path} succeeded with the renewed token (HTTP ${response.status})`
        : `retry of ${method} ${path} STILL failed (HTTP ${response.status}) -- not an expiry problem`,
    );
  }

  if (!response.ok) {
    const body = await response.text().catch(() => '');
    throw new ApiError(response.status, body, `${method} ${path}`);
  }

  if (response.status === 204) return undefined as T;
  return (await response.json()) as T;
}

/**
 * Step (7) as seen from the browser: the local DATABASE B identity.
 *
 * `id` is workspace.db's own primary key. It has no relationship to the id
 * gateway.db assigned the same person -- two rows, two databases, correlated
 * only by (tid, oid).
 */
export function fetchMe(): Promise<Me> {
  return apiFetch<Me>('/me');
}

/** This user's analyses. Scoped server-side by local user id, never by a claim. */
export function fetchAnalyses(): Promise<Analysis[]> {
  return apiFetch<Analysis[]>('/analyses');
}

/** Create one. :4001 calls agent-api internally; the user's JWT does not follow. */
export function createAnalysis(text: string): Promise<Analysis> {
  return apiFetch<Analysis>('/analyses', {
    method: 'POST',
    body: JSON.stringify({ text }),
  });
}
