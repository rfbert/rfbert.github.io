/**
 * GET|POST /api/auth/logout -- STANDALONE MODE ONLY.
 *
 * Clears the standalone session cookies and returns to the app. There is
 * nothing else to clear: the access token on the client lives in a module
 * variable that dies with the page, and no storage API was ever written to.
 *
 * In iframe mode there is nothing here to log out OF -- the session belongs to
 * the gateway, and logging out is the gateway's business.
 */
import { NextRequest, NextResponse } from 'next/server';

import { CODE_COOKIE, SESSION_COOKIE, STATE_COOKIE } from '../../../../lib/auth-config';

export const dynamic = 'force-dynamic';

function clear(request: NextRequest): NextResponse {
  const origin = new URL(request.url).origin;
  const response = NextResponse.redirect(new URL('/', origin).toString(), 302);
  response.cookies.delete(SESSION_COOKIE);
  response.cookies.delete(CODE_COOKIE);
  response.cookies.delete(STATE_COOKIE);
  return response;
}

export async function GET(request: NextRequest): Promise<NextResponse> {
  return clear(request);
}

export async function POST(request: NextRequest): Promise<NextResponse> {
  return clear(request);
}
