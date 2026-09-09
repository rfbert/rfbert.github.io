/**
 * SERVER-SIDE ONLY. Imported by app/api/auth/* and by the two server
 * components. Everything that touches the raw JWT lives here.
 *
 * The rule this file exists to enforce: the token is written to an httpOnly
 * cookie and handed out through exactly one endpoint (/api/auth/token). It is
 * never rendered into HTML, never put in a URL, and never stored in
 * localStorage or sessionStorage.
 */
import { decodeJwt } from 'jose';
import type { NextResponse } from 'next/server';

import {
  GATEWAY_ORIGIN,
  GRANT_COOKIE,
  GRANT_COOKIE_PATH,
  SESSION_COOKIE,
  STATE_COOKIE,
} from './config';

/* ----------------------------------------------------------------- config */

export const IDP_ISSUER = (process.env.IDP_ISSUER || 'http://localhost:5000').replace(/\/+$/, '');
export const CLIENT_ID = process.env.CLIENT_ID || 'identity-gateway-api';
export const API_AUDIENCE = process.env.API_AUDIENCE || 'api://agent-platform';

/** The scope both APIs require (SPEC.txt 5.2). */
export const REQUIRED_SCOPE = 'access_as_user';

/**
 * Cookies are NOT marked Secure. The whole scaffold is plain http on
 * localhost, and a Secure cookie is a footgun here: it would be dropped and
 * the failure would look like "login silently does nothing".
 */
const BASE_COOKIE = {
  httpOnly: true,
  sameSite: 'lax',
  secure: false,
  path: '/',
} as const;

/**
 * SameSite=Lax is deliberate and load-bearing (SPEC.txt 8, "KNOWN LOCAL
 * PITFALLS"): it survives the top-level redirect back from the IdP, and it is
 * NOT sent from inside the :3001 iframe. The child therefore cannot depend on
 * this cookie -- which is precisely why the postMessage relay exists.
 */

/* ------------------------------------------------------------------ claims */

/** SPEC.txt 5.2 -- the claim contract. */
export interface TokenClaims {
  iss?: string;
  aud?: string | string[];
  sub?: string;
  /** join key part 1 */
  tid?: string;
  /** join key part 2 */
  oid?: string;
  name?: string;
  preferred_username?: string;
  scp?: string;
  iat?: number;
  exp?: number;
}

/**
 * Decode WITHOUT verifying. That is correct here and nowhere else: this web
 * app is not a resource server. It reads `exp` only to decide whether to renew
 * before handing the token to the child. The two NestJS APIs are the ones that
 * verify the signature, issuer, audience and scope via JWKS -- and they are the
 * only opinion that counts.
 */
export function readClaims(token: string): TokenClaims | null {
  try {
    return decodeJwt(token) as TokenClaims;
  } catch {
    return null;
  }
}

/** Clock skew allowance, and the margin that makes a token "about to die". */
const SKEW_SECONDS = 5;

export function isExpired(claims: TokenClaims | null, skewSeconds = SKEW_SECONDS): boolean {
  if (!claims || typeof claims.exp !== 'number') return true;
  return claims.exp <= Math.floor(Date.now() / 1000) + skewSeconds;
}

export function secondsRemaining(claims: TokenClaims | null): number {
  if (!claims || typeof claims.exp !== 'number') return 0;
  return Math.max(0, claims.exp - Math.floor(Date.now() / 1000));
}

/* ------------------------------------------------------- the IdP exchange */

export class TokenExchangeError extends Error {
  readonly status: number;
  constructor(message: string, status = 502) {
    super(message);
    this.name = 'TokenExchangeError';
    this.status = status;
  }
}

export interface ExchangeResult {
  accessToken: string;
  claims: TokenClaims;
}

/**
 * POST ${IDP_ISSUER}/token -- the standard authorization_code exchange.
 *
 * Used twice:
 *   - once by /api/auth/callback, on the way back from the user picker;
 *   - again by /api/auth/token when the stored access token has expired.
 * The second use is the renewal in acceptance test 6.
 */
export async function exchangeCodeForToken(
  code: string,
  redirectUri: string,
): Promise<ExchangeResult> {
  let response: Response;
  try {
    response = await fetch(`${IDP_ISSUER}/token`, {
      method: 'POST',
      headers: { 'content-type': 'application/x-www-form-urlencoded' },
      body: new URLSearchParams({
        grant_type: 'authorization_code',
        code,
        redirect_uri: redirectUri,
        client_id: CLIENT_ID,
      }),
      cache: 'no-store',
    });
  } catch (cause) {
    throw new TokenExchangeError(
      `could not reach the identity provider at ${IDP_ISSUER}: ${String(
        (cause as Error)?.message ?? cause,
      )}`,
    );
  }

  if (!response.ok) {
    const detail = (await response.text().catch(() => '')).slice(0, 300);
    throw new TokenExchangeError(
      `identity provider rejected the code (${response.status}): ${detail}`,
      response.status === 400 ? 400 : 502,
    );
  }

  const body = (await response.json().catch(() => null)) as { access_token?: unknown } | null;
  const accessToken = typeof body?.access_token === 'string' ? body.access_token : '';
  if (!accessToken) {
    throw new TokenExchangeError('identity provider returned no access_token');
  }

  const claims = readClaims(accessToken);
  if (!claims) {
    throw new TokenExchangeError('identity provider returned a token that is not a JWT');
  }
  // The join key is the whole point of the architecture. A token without it is
  // useless to both APIs, so refuse it here rather than three services later.
  if (!claims.tid || !claims.oid) {
    throw new TokenExchangeError('token is missing the tid/oid claim pair');
  }

  return { accessToken, claims };
}

/* ----------------------------------------------------------- cookie writes */

export function setSessionCookie(response: NextResponse, token: string, claims: TokenClaims): void {
  response.cookies.set(SESSION_COOKIE, token, {
    ...BASE_COOKIE,
    // Outlive the token itself so an expired session is still renewable
    // instead of vanishing. Renewal is authorised by the grant cookie.
    maxAge: 60 * 60 * 8,
  });
  void claims;
}

export function setGrantCookie(response: NextResponse, code: string): void {
  response.cookies.set(GRANT_COOKIE, code, {
    ...BASE_COOKIE,
    path: GRANT_COOKIE_PATH,
    maxAge: 60 * 60 * 8,
  });
}

export function setStateCookie(response: NextResponse, value: string): void {
  response.cookies.set(STATE_COOKIE, value, { ...BASE_COOKIE, maxAge: 600 });
}

export function clearStateCookie(response: NextResponse): void {
  response.cookies.set(STATE_COOKIE, '', { ...BASE_COOKIE, maxAge: 0 });
}

export function clearSession(response: NextResponse): void {
  response.cookies.set(SESSION_COOKIE, '', { ...BASE_COOKIE, maxAge: 0 });
  response.cookies.set(GRANT_COOKIE, '', { ...BASE_COOKIE, path: GRANT_COOKIE_PATH, maxAge: 0 });
  clearStateCookie(response);
}

/* ------------------------------------------------------------ redirect_uri */

/** Absolute redirect_uri for the code flow, derived from the live request. */
export function callbackUrl(requestOrigin: string): string {
  const origin = requestOrigin || GATEWAY_ORIGIN;
  return `${origin.replace(/\/+$/, '')}/api/auth/callback`;
}

/**
 * Open-redirect guard: only same-site absolute paths may be returned to.
 * "//evil.example" is a protocol-relative URL, not a path -- reject it.
 */
export function safeReturnTo(value: string | null | undefined, fallback = '/workspace'): string {
  if (!value || typeof value !== 'string') return fallback;
  if (!value.startsWith('/') || value.startsWith('//')) return fallback;
  return value;
}

/* ------------------------------------------------------------------- state */

export interface OAuthState {
  state: string;
  returnTo: string;
}

export function encodeState(value: OAuthState): string {
  return Buffer.from(JSON.stringify(value), 'utf8').toString('base64url');
}

export function decodeState(raw: string | undefined): OAuthState | null {
  if (!raw) return null;
  try {
    const parsed = JSON.parse(Buffer.from(raw, 'base64url').toString('utf8')) as OAuthState;
    if (typeof parsed?.state !== 'string' || !parsed.state) return null;
    return { state: parsed.state, returnTo: safeReturnTo(parsed.returnTo) };
  } catch {
    return null;
  }
}
