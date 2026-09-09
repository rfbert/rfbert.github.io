/**
 * GET /api/auth/callback?code=&state=
 *
 * Completes step (1): exchange the code for the JWT, put the JWT in an
 * httpOnly cookie, and land the user on /workspace.
 *
 * The token goes into a cookie the browser cannot read from script. The only
 * way anything in the page gets hold of it is /api/auth/token -- which is what
 * makes the postMessage relay the single, auditable path by which the child
 * application is fed (SPEC.txt 4.2, Section 8).
 */
import { NextRequest, NextResponse } from 'next/server';

import { STATE_COOKIE } from '@/lib/config';
import {
  TokenExchangeError,
  callbackUrl,
  clearStateCookie,
  decodeState,
  exchangeCodeForToken,
  safeReturnTo,
  setGrantCookie,
  setSessionCookie,
} from '@/lib/session';

export const dynamic = 'force-dynamic';

function failure(request: NextRequest, reason: string): NextResponse {
  const target = new URL('/', request.nextUrl.origin);
  target.searchParams.set('error', reason);
  const response = NextResponse.redirect(target, 302);
  clearStateCookie(response);
  return response;
}

export async function GET(request: NextRequest): Promise<NextResponse> {
  const params = request.nextUrl.searchParams;

  const idpError = params.get('error');
  if (idpError) {
    return failure(request, `identity provider returned "${idpError}"`);
  }

  const code = params.get('code');
  if (!code) {
    return failure(request, 'no authorization code in the callback');
  }

  // --- CSRF: the state we sent must be the state that came back ------------
  const expected = decodeState(request.cookies.get(STATE_COOKIE)?.value);
  const returned = params.get('state');
  if (!expected) {
    return failure(request, 'login state cookie is missing or unreadable - start again');
  }
  if (returned !== expected.state) {
    return failure(request, 'login state mismatch - possible CSRF, request rejected');
  }

  // --- the exchange --------------------------------------------------------
  let accessToken: string;
  let claims;
  try {
    const result = await exchangeCodeForToken(code, callbackUrl(request.nextUrl.origin));
    accessToken = result.accessToken;
    claims = result.claims;
  } catch (error) {
    const message =
      error instanceof TokenExchangeError ? error.message : 'token exchange failed';
    return failure(request, message);
  }

  const destination = new URL(safeReturnTo(expected.returnTo), request.nextUrl.origin);
  const response = NextResponse.redirect(destination, 302);

  setSessionCookie(response, accessToken, claims);
  // Keeps renewal possible without a second login screen (see /api/auth/token).
  setGrantCookie(response, code);
  clearStateCookie(response);

  return response;
}
