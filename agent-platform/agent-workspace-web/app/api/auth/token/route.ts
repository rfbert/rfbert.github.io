/**
 * GET /api/auth/token -- STANDALONE MODE ONLY.
 *
 * The standalone counterpart of the parent's AUTH_TOKEN message: it is the
 * renewal source for this app's own session, exactly as gateway-web's route of
 * the same name is the renewal source for the iframe relay.
 *
 * { "access_token": "<jwt>" }   200
 * { "error": "login_required" } 401
 *
 * WHY IT CAN MINT: the access token lives 120 seconds. When the held one has
 * expired, this route replays the stored authorization code against the IdP
 * and returns a fresh token, then re-stamps the cookie. That makes the 401 ->
 * re-acquire -> retry loop in lib/api.ts work identically in both modes: in
 * iframe mode the parent supplies the new token, here the app's own session
 * does. Same client code, same outcome, no second login screen.
 *
 * A real deployment would use the refresh token Entra returns. mock-idp issues
 * none, and its code is replayable, so the code plays that part locally. The
 * substitution is confined to this file.
 *
 * NEVER CALLED IN IFRAME MODE.
 */
import { NextRequest, NextResponse } from 'next/server';

import {
  CODE_COOKIE,
  COOKIE_OPTIONS,
  SESSION_COOKIE,
  SESSION_MAX_AGE_SECONDS,
  exchangeCodeForToken,
  isExpired,
} from '../../../../lib/auth-config';

export const dynamic = 'force-dynamic';

const NO_STORE = { 'cache-control': 'no-store' } as const;

export async function GET(request: NextRequest): Promise<NextResponse> {
  const held = request.cookies.get(SESSION_COOKIE)?.value;

  if (held && !isExpired(held)) {
    return NextResponse.json({ access_token: held, renewed: false }, { headers: NO_STORE });
  }

  const code = request.cookies.get(CODE_COOKIE)?.value;
  if (!code) {
    return NextResponse.json(
      {
        error: 'login_required',
        error_description: held
          ? 'the standalone session token has expired and cannot be renewed'
          : 'no standalone session',
      },
      { status: 401, headers: NO_STORE },
    );
  }

  const origin = new URL(request.url).origin;
  try {
    const token = await exchangeCodeForToken(code, `${origin}/api/auth/callback`);
    const response = NextResponse.json(
      { access_token: token.access_token, renewed: true },
      { headers: NO_STORE },
    );
    response.cookies.set(SESSION_COOKIE, token.access_token, {
      ...COOKIE_OPTIONS,
      maxAge: SESSION_MAX_AGE_SECONDS,
    });
    return response;
  } catch (error) {
    console.error('[workspace-web] standalone renewal failed:', error);
    return NextResponse.json(
      { error: 'login_required', error_description: 'renewal against the IdP failed' },
      { status: 401, headers: NO_STORE },
    );
  }
}
