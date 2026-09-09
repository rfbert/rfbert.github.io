/**
 * GET /api/auth/callback -- STANDALONE MODE ONLY.
 *
 * code -> POST /token -> httpOnly cookie -> back to the app.
 *
 * TWO COOKIES ARE SET, AND THE SECOND ONE MATTERS:
 *
 *   ws_session    the access token. httpOnly, SameSite=Lax. The browser's
 *                 JavaScript never reads it; /api/auth/token hands the token
 *                 out on request, which is what keeps the client side
 *                 memory-only.
 *
 *   ws_auth_code  the authorization code, which mock-idp lets us replay. It
 *                 stands in for the refresh token a real Entra flow would
 *                 return, so /api/auth/token can mint a fresh access token
 *                 once the 120-second one expires. Without it, standalone mode
 *                 would dead-end at a second login two minutes in, while
 *                 iframe mode renewed silently -- the two modes must behave
 *                 the same or the "one codebase, both modes" claim is hollow.
 *
 * SameSite=Lax is deliberate (SPEC.txt Section 8, known pitfalls). A Lax
 * cookie is NOT sent with a cross-site framed request, so this session is
 * structurally unavailable to the iframe. The postMessage relay exists exactly
 * because of that, and the cookie is left honest rather than being loosened to
 * None to paper over it.
 */
import { NextRequest, NextResponse } from 'next/server';

import {
  CODE_COOKIE,
  COOKIE_OPTIONS,
  SESSION_COOKIE,
  SESSION_MAX_AGE_SECONDS,
  STATE_COOKIE,
  exchangeCodeForToken,
} from '../../../../lib/auth-config';

export const dynamic = 'force-dynamic';

function failure(origin: string, reason: string): NextResponse {
  const target = new URL('/', origin);
  target.searchParams.set('auth_error', reason);
  const response = NextResponse.redirect(target.toString(), 302);
  response.cookies.delete(STATE_COOKIE);
  return response;
}

export async function GET(request: NextRequest): Promise<NextResponse> {
  const url = new URL(request.url);
  const origin = url.origin;

  const idpError = url.searchParams.get('error');
  if (idpError) return failure(origin, idpError);

  const code = url.searchParams.get('code');
  if (!code) return failure(origin, 'missing_code');

  // CSRF check: the state must match the one this server issued.
  const expectedState = request.cookies.get(STATE_COOKIE)?.value;
  const state = url.searchParams.get('state');
  if (!expectedState || state !== expectedState) {
    return failure(origin, 'state_mismatch');
  }

  let accessToken: string;
  try {
    const token = await exchangeCodeForToken(code, `${origin}/api/auth/callback`);
    accessToken = token.access_token;
  } catch (error) {
    console.error('[workspace-web] token exchange failed:', error);
    return failure(origin, 'token_exchange_failed');
  }

  const response = NextResponse.redirect(new URL('/', origin).toString(), 302);
  response.cookies.set(SESSION_COOKIE, accessToken, {
    ...COOKIE_OPTIONS,
    maxAge: SESSION_MAX_AGE_SECONDS,
  });
  response.cookies.set(CODE_COOKIE, code, {
    ...COOKIE_OPTIONS,
    maxAge: SESSION_MAX_AGE_SECONDS,
  });
  response.cookies.delete(STATE_COOKIE);
  return response;
}
