/**
 * /api/auth/logout  --  clear the cookies, land back on "/".
 *
 * GET and POST both work: POST for the form in the UI, GET so the flow can be
 * driven from the address bar while proving the scaffold by hand.
 *
 * This ends the session in THIS application only. agent-workspace-api has its
 * own row in its own database and knows nothing about it -- two independent
 * applications, by design. What logout does remove is the ability to answer
 * the next TOKEN_REQUIRED, so the iframe stops being fed.
 */
import { NextRequest, NextResponse } from 'next/server';

import { clearSession } from '@/lib/session';

export const dynamic = 'force-dynamic';

function signOut(request: NextRequest, status: 302 | 303): NextResponse {
  const response = NextResponse.redirect(new URL('/', request.nextUrl.origin), status);
  clearSession(response);
  response.headers.set('cache-control', 'no-store');
  return response;
}

export async function GET(request: NextRequest): Promise<NextResponse> {
  return signOut(request, 302);
}

export async function POST(request: NextRequest): Promise<NextResponse> {
  // 303 so the browser follows up with a GET rather than re-POSTing.
  return signOut(request, 303);
}
