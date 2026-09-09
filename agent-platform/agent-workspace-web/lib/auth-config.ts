/**
 * SERVER-ONLY configuration for STANDALONE MODE (SPEC.txt 4.4, last bullet:
 * "Same four routes as gateway-web. Used ONLY in standalone mode.").
 *
 * Imported exclusively by app/api/auth/* route handlers, which run on the
 * server. None of these values are NEXT_PUBLIC_, so none of them are inlined
 * into the browser bundle.
 *
 * IN IFRAME MODE NOTHING HERE IS EVER READ. The framed app gets its token from
 * the parent over postMessage and never calls /api/auth/*, never sets a cookie
 * and never contacts the IdP itself. That is the entire point of the bridge
 * (SPEC.txt Section 8: "make sure the workspace never depends on cookies while
 * framed - memory only").
 */

/** The IdP. Locally this is mock-idp; in Entra it would be the tenant host. */
export const IDP_ISSUER: string = process.env.IDP_ISSUER || 'http://localhost:5000';

/**
 * ONE app registration for the whole platform (SPEC.txt Section 8: "Do not
 * create a second App Registration or second audience. One only."). Standalone
 * mode logs in against the SAME registration and the SAME audience that
 * identity-gateway-web uses -- which is exactly why agent-workspace-api needs
 * zero changes to accept the resulting token (acceptance test 7).
 */
export const CLIENT_ID: string = process.env.CLIENT_ID || 'identity-gateway-api';
export const API_AUDIENCE: string = process.env.API_AUDIENCE || 'api://agent-platform';

/** The scope both APIs require in the `scp` claim. */
export const REQUIRED_SCOPE = 'access_as_user';

/**
 * The standalone session cookie: httpOnly, SameSite=Lax, and deliberately
 * useless inside an iframe -- a Lax cookie is not sent on a cross-site framed
 * request, which is precisely why the postMessage relay exists rather than
 * this cookie being "shared".
 */
export const SESSION_COOKIE = 'ws_session';

/**
 * The authorization code from the last standalone login.
 *
 * WHY IT IS KEPT: tokens live 120 seconds on purpose (SPEC.txt 4.1), and a
 * real Entra flow would silently renew with a refresh token. mock-idp issues
 * no refresh token, and its authorization code is replayable, so the code
 * stands in for one: /api/auth/token mints a fresh access token from it when
 * the current one has expired. Standalone mode therefore self-heals exactly
 * the way iframe mode does -- 401, re-acquire, retry -- instead of dead-ending
 * at a second login screen after two minutes.
 *
 * This is a local-mock affordance, and it is confined to this one cookie: no
 * other part of the system knows or cares how the token was obtained.
 */
export const CODE_COOKIE = 'ws_auth_code';

/** CSRF: the state parameter is echoed back by the IdP and must match. */
export const STATE_COOKIE = 'ws_oauth_state';

/** Standalone sessions last an hour; the ACCESS TOKEN inside still expires in 120s. */
export const SESSION_MAX_AGE_SECONDS = 60 * 60;

/** Shared cookie options. `secure` is off because local dev is plain http. */
export const COOKIE_OPTIONS = {
  httpOnly: true,
  sameSite: 'lax',
  path: '/',
  secure: false,
} as const;

/** Decode a JWT payload WITHOUT verifying it. */
export function decodeJwtPayload(token: string): Record<string, unknown> | null {
  const parts = token.split('.');
  if (parts.length !== 3) return null;
  try {
    const json = Buffer.from(parts[1].replace(/-/g, '+').replace(/_/g, '/'), 'base64').toString('utf8');
    const parsed: unknown = JSON.parse(json);
    return parsed && typeof parsed === 'object' ? (parsed as Record<string, unknown>) : null;
  } catch {
    return null;
  }
}

/**
 * Is this token expired (or about to be)?
 *
 * NOTE ON TRUST: this is a LIVENESS check, not a security check. It decides
 * whether to hand the browser a token or mint a fresh one. The only place a
 * token is actually trusted is agent-workspace-api, which verifies the RS256
 * signature against the JWKS, the issuer, the audience and the scope. Nothing
 * here grants access to anything.
 */
export function isExpired(token: string, skewSeconds = 10): boolean {
  const payload = decodeJwtPayload(token);
  const exp = payload && typeof payload.exp === 'number' ? payload.exp : null;
  if (exp === null) return true;
  return exp - skewSeconds <= Math.floor(Date.now() / 1000);
}

/** Exchange an authorization code for an access token at the IdP. */
export async function exchangeCodeForToken(
  code: string,
  redirectUri: string,
): Promise<{ access_token: string; expires_in?: number }> {
  const response = await fetch(`${IDP_ISSUER}/token`, {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify({
      grant_type: 'authorization_code',
      code,
      client_id: CLIENT_ID,
      redirect_uri: redirectUri,
      audience: API_AUDIENCE,
    }),
    cache: 'no-store',
  });

  if (!response.ok) {
    const detail = await response.text().catch(() => '');
    throw new Error(`token endpoint returned ${response.status}: ${detail.slice(0, 200)}`);
  }

  const body: unknown = await response.json();
  const token =
    body && typeof body === 'object' ? (body as { access_token?: unknown }).access_token : undefined;
  if (typeof token !== 'string' || token.length === 0) {
    throw new Error('token endpoint returned no access_token');
  }
  const expiresIn =
    body && typeof body === 'object' ? (body as { expires_in?: unknown }).expires_in : undefined;

  return {
    access_token: token,
    expires_in: typeof expiresIn === 'number' ? expiresIn : undefined,
  };
}
