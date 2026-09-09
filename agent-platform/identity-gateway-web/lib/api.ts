/**
 * Browser-side fetch wrapper for identity-gateway-api (:4000) -- SPEC.txt 4.2.
 *
 * Three rules, all deliberate:
 *
 *  1. THE TOKEN LIVES IN MEMORY. A module-level variable, nothing else. Never
 *     localStorage, never sessionStorage (SPEC.txt Section 8). Reload the tab
 *     and it is gone; the httpOnly cookie, which script cannot read, is what
 *     survives.
 *
 *  2. THE BEARER GOES TO EXACTLY ONE ORIGIN. Authorization is attached only
 *     when the request target is GATEWAY_API. Any other origin gets the fetch
 *     without the header rather than a leaked token.
 *
 *  3. ON 401, RENEW ONCE AND RETRY ONCE. This is the same renewal loop the
 *     iframe child runs against :4001 -- here it is the parent's own copy,
 *     sourced from /api/auth/token instead of from a postMessage.
 */
import { GATEWAY_API } from './config';

/* ------------------------------------------------------------------ types */

export interface Me {
  id: number;
  tid: string;
  oid: string;
  displayName: string;
  createdAt: string;
  database: string;
}

export interface Conversation {
  id: number;
  userId: number;
  title: string;
  createdAt: string;
}

export interface TokenResponse {
  access_token: string;
  token_type?: string;
  expires_in?: number;
  expires_at?: number | null;
  renewed?: boolean;
}

/** Thrown when there is no usable session at all -- the caller must re-login. */
export class AuthRequiredError extends Error {
  readonly reason: string;
  constructor(message: string, reason = 'unauthenticated') {
    super(message);
    this.name = 'AuthRequiredError';
    this.reason = reason;
  }
}

/** Thrown for a non-2xx answer from identity-gateway-api. */
export class ApiError extends Error {
  readonly status: number;
  constructor(message: string, status: number) {
    super(message);
    this.name = 'ApiError';
    this.status = status;
  }
}

/* --------------------------------------------------- the in-memory token */

let cachedToken: string | null = null;
let inFlight: Promise<TokenResponse> | null = null;

/**
 * Ask our own server for the current access token. `force` bypasses the
 * in-memory copy, which is what a 401 from the API means: what we hold is
 * stale, go and get the live one.
 */
export async function fetchAccessToken(force = false): Promise<string> {
  if (!force && cachedToken) return cachedToken;

  // Collapse concurrent callers onto one request -- a page that loads /me and
  // /conversations at once should not trigger two renewals.
  if (!inFlight) {
    inFlight = (async () => {
      const response = await fetch('/api/auth/token', {
        method: 'GET',
        credentials: 'same-origin',
        cache: 'no-store',
        headers: { accept: 'application/json' },
      });

      if (response.status === 401) {
        const body = (await response.json().catch(() => null)) as
          | { error?: string; message?: string }
          | null;
        throw new AuthRequiredError(
          body?.message || 'No valid session.',
          body?.error || 'unauthenticated',
        );
      }
      if (!response.ok) {
        throw new ApiError(`/api/auth/token returned ${response.status}`, response.status);
      }
      return (await response.json()) as TokenResponse;
    })().finally(() => {
      inFlight = null;
    });
  }

  const payload = await inFlight;
  cachedToken = payload.access_token;
  return cachedToken;
}

/** Drop the in-memory copy (used on logout). */
export function forgetAccessToken(): void {
  cachedToken = null;
}

/* -------------------------------------------------------- the API wrapper */

function isGatewayApi(url: string): boolean {
  try {
    return new URL(url, window.location.origin).origin === GATEWAY_API;
  } catch {
    return false;
  }
}

function resolve(path: string): string {
  return /^https?:\/\//i.test(path) ? path : `${GATEWAY_API}${path.startsWith('/') ? path : `/${path}`}`;
}

/**
 * fetch + "Authorization: Bearer <jwt>" -- step (3) of SPEC.txt Section 2.
 * Retries exactly once, after renewing, when the API says 401.
 */
export async function gatewayFetch(path: string, init: RequestInit = {}): Promise<Response> {
  const url = resolve(path);

  const send = async (token: string | null): Promise<Response> => {
    const headers = new Headers(init.headers);
    // Rule 2: the Bearer is scoped to identity-gateway-api and nothing else.
    if (token && isGatewayApi(url)) {
      headers.set('authorization', `Bearer ${token}`);
    }
    return fetch(url, { ...init, headers, cache: 'no-store', credentials: 'omit' });
  };

  const token = await fetchAccessToken();
  const first = await send(token);
  if (first.status !== 401) return first;

  // 401: the token we sent is expired or was rejected. Renew and retry ONCE.
  const renewed = await fetchAccessToken(true);
  if (renewed === token) return first;
  return send(renewed);
}

async function asJson<T>(response: Response): Promise<T> {
  if (!response.ok) {
    const detail = (await response.text().catch(() => '')).slice(0, 300);
    throw new ApiError(
      `identity-gateway-api responded ${response.status}${detail ? `: ${detail}` : ''}`,
      response.status,
    );
  }
  return (await response.json()) as T;
}

/* ------------------------------------------------------- Database A calls */

/** GET :4000/me -- the LOCAL user row, JIT-provisioned from (tid, oid). */
export async function getMe(): Promise<Me> {
  return asJson<Me>(await gatewayFetch('/me'));
}

/** GET :4000/conversations -- scoped server-side to the local user id. */
export async function listConversations(): Promise<Conversation[]> {
  return asJson<Conversation[]>(await gatewayFetch('/conversations'));
}

/** POST :4000/conversations */
export async function createConversation(title: string): Promise<Conversation> {
  return asJson<Conversation>(
    await gatewayFetch('/conversations', {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ title }),
    }),
  );
}
