/**
 * GET /api/auth/login -- STANDALONE MODE ONLY.
 *
 * 302 to the IdP's authorization endpoint. Identical in shape to
 * identity-gateway-web's route of the same name, and pointed at the SAME app
 * registration and the SAME audience -- SPEC.txt Section 8: "Do not create a
 * second App Registration or second audience. One only."
 *
 * NEVER REACHED IN IFRAME MODE. lib/token.ts branches on the mode before any
 * /api/auth/* call, so a framed workspace performs no login of its own: it
 * asks the parent for the token that the single login already produced.
 */
import { NextRequest, NextResponse } from 'next/server';

import {
  API_AUDIENCE,
  CLIENT_ID,
  COOKIE_OPTIONS,
  IDP_ISSUER,
  REQUIRED_SCOPE,
  STATE_COOKIE,
} from '../../../../lib/auth-config';

export const dynamic = 'force-dynamic';

export async function GET(request: NextRequest): Promise<NextResponse> {
  const origin = new URL(request.url).origin;
  const redirectUri = `${origin}/api/auth/callback`;

  // CSRF: a fresh state, remembered in an httpOnly cookie and required to come
  // back unchanged from the IdP.
  const state = crypto.randomUUID();

  const authorize = new URL('/authorize', IDP_ISSUER);
  authorize.searchParams.set('client_id', CLIENT_ID);
  authorize.searchParams.set('response_type', 'code');
  authorize.searchParams.set('redirect_uri', redirectUri);
  authorize.searchParams.set('scope', `openid profile ${REQUIRED_SCOPE}`);
  authorize.searchParams.set('audience', API_AUDIENCE);
  authorize.searchParams.set('state', state);

  const response = NextResponse.redirect(authorize.toString(), 302);
  response.cookies.set(STATE_COOKIE, state, { ...COOKIE_OPTIONS, maxAge: 600 });
  return response;
}
