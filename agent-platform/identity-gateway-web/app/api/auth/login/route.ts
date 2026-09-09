/**
 * GET /api/auth/login  ->  302 to the IdP authorize endpoint.
 *
 * Step (1) of SPEC.txt Section 2. Standard OAuth 2.0 authorization code flow:
 * we send response_type=code plus a CSRF `state` that we also stash in an
 * httpOnly cookie, and the IdP sends the user back to /api/auth/callback.
 *
 * There is ONE app registration and ONE audience in this system (SPEC.txt 8).
 * The token minted from this login is the same token agent-workspace-api will
 * later validate -- nothing is exchanged, re-issued or downgraded on the way.
 */
import { randomUUID } from 'node:crypto';

import { NextRequest, NextResponse } from 'next/server';

import { GATEWAY_ORIGIN } from '@/lib/config';
import {
  API_AUDIENCE,
  CLIENT_ID,
  IDP_ISSUER,
  REQUIRED_SCOPE,
  callbackUrl,
  encodeState,
  safeReturnTo,
  setStateCookie,
} from '@/lib/session';

export const dynamic = 'force-dynamic';

export async function GET(request: NextRequest): Promise<NextResponse> {
  const origin = request.nextUrl.origin || GATEWAY_ORIGIN;
  const redirectUri = callbackUrl(origin);

  // Where to land afterwards. Defaults to /workspace, per SPEC.txt 4.2.
  const returnTo = safeReturnTo(request.nextUrl.searchParams.get('returnTo'));
  const state = randomUUID();

  const authorize = new URL('/authorize', `${IDP_ISSUER}/`);
  authorize.searchParams.set('response_type', 'code');
  authorize.searchParams.set('client_id', CLIENT_ID);
  authorize.searchParams.set('redirect_uri', redirectUri);
  authorize.searchParams.set('scope', `openid profile ${REQUIRED_SCOPE}`);
  authorize.searchParams.set('state', state);
  // The audience both APIs check. One audience, shared (SPEC.txt 5.1).
  authorize.searchParams.set('resource', API_AUDIENCE);

  const response = NextResponse.redirect(authorize, 302);
  setStateCookie(response, encodeState({ state, returnTo }));
  return response;
}
