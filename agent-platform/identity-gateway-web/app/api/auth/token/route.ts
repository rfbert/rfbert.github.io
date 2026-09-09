/**
 * GET /api/auth/token  ->  { access_token }
 *
 * THE RENEWAL SOURCE. Two callers, one endpoint:
 *   - this app's own pages, before calling identity-gateway-api (:4000);
 *   - components/WorkspaceFrame, every time the iframe sends TOKEN_REQUIRED.
 *
 * Contract:
 *   200  { access_token, token_type, expires_at, expires_in, renewed }
 *   401  { error, message, login_url }   -- always a clear, machine-readable
 *                                          body so the child can react rather
 *                                          than guess.
 *
 * WHY A 401 IS NOT THE ONLY ANSWER WHEN THE TOKEN HAS EXPIRED
 * -----------------------------------------------------------
 * Acceptance test 6 requires the sequence 401 -> TOKEN_REQUIRED -> AUTH_TOKEN
 * -> retry -> 200 "with no visible interruption and no second login screen".
 * The 401 in that sequence comes from the RESOURCE SERVER (:4001 rejecting an
 * expired token) -- that is the trigger. If this endpoint could only ever
 * repeat that 401, the handshake would have nothing to hand back and the user
 * would be bounced to a login screen, which the spec forbids.
 *
 * So: an expired access token is renewed here from the stored authorization
 * grant, which stands in for the refresh token / IdP session a real Entra
 * deployment would use. It is server-side, httpOnly and scoped to /api/auth.
 * A 401 is returned whenever there is genuinely nothing to serve -- no session
 * cookie, no grant, or the IdP refusing to re-issue.
 */
import { NextRequest, NextResponse } from 'next/server';

import { GRANT_COOKIE, SESSION_COOKIE } from '@/lib/config';
import {
  TokenClaims,
  TokenExchangeError,
  callbackUrl,
  exchangeCodeForToken,
  isExpired,
  readClaims,
  secondsRemaining,
  setSessionCookie,
} from '@/lib/session';

export const dynamic = 'force-dynamic';

/** Never cache a bearer token, anywhere, for any length of time. */
const NO_STORE = {
  'cache-control': 'no-store, no-cache, must-revalidate',
  pragma: 'no-cache',
} as const;

type Reason =
  | 'no_session'
  | 'invalid_session'
  | 'token_expired'
  | 'renewal_failed';

function unauthorized(error: Reason, message: string, status = 401): NextResponse {
  return NextResponse.json(
    { error, message, login_url: '/api/auth/login' },
    { status, headers: NO_STORE },
  );
}

function serve(
  token: string,
  claims: TokenClaims,
  renewed: boolean,
  onResponse?: (response: NextResponse) => void,
): NextResponse {
  const response = NextResponse.json(
    {
      access_token: token,
      token_type: 'Bearer',
      expires_in: secondsRemaining(claims),
      expires_at: claims.exp ?? null,
      // Purely informational, for the handshake log in the parent UI.
      renewed,
    },
    { headers: NO_STORE },
  );
  onResponse?.(response);
  return response;
}

export async function GET(request: NextRequest): Promise<NextResponse> {
  const token = request.cookies.get(SESSION_COOKIE)?.value;

  if (!token) {
    return unauthorized(
      'no_session',
      'No session cookie on this browser. The user has not signed in, or has signed out.',
    );
  }

  const claims = readClaims(token);
  if (!claims) {
    return unauthorized(
      'invalid_session',
      'The session cookie does not contain a decodable JWT. Sign in again.',
    );
  }

  // --- happy path: the token we hold is still good -------------------------
  if (!isExpired(claims)) {
    return serve(token, claims, false);
  }

  // --- expired: renew from the stored grant, or say why we cannot ----------
  const grant = request.cookies.get(GRANT_COOKIE)?.value;
  if (!grant) {
    return unauthorized(
      'token_expired',
      'The access token has expired and no renewal grant is held. A fresh sign-in is required.',
    );
  }

  try {
    const renewedResult = await exchangeCodeForToken(
      grant,
      callbackUrl(request.nextUrl.origin),
    );
    // Same identity, same audience, same issuer -- a NEW exp. Nothing about
    // the (tid, oid) join key changes across a renewal.
    return serve(renewedResult.accessToken, renewedResult.claims, true, (response) =>
      setSessionCookie(response, renewedResult.accessToken, renewedResult.claims),
    );
  } catch (error) {
    const detail =
      error instanceof TokenExchangeError ? error.message : 'renewal failed';
    return unauthorized(
      'renewal_failed',
      `The access token has expired and could not be renewed: ${detail}`,
    );
  }
}
