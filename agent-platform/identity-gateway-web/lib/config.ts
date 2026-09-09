/**
 * The shared contract values (SPEC.txt 5.1), in one place.
 *
 * ORIGINS ARE COMPARED AS STRINGS at runtime -- by the postMessage receiver
 * (event.origin ===) and by the sender (explicit targetOrigin). A stray
 * trailing slash would silently break both, so every value is normalised to a
 * bare scheme://host:port here, once.
 */

/** "http://localhost:3001/" -> "http://localhost:3001" */
function normaliseOrigin(value: string, fallback: string): string {
  const raw = (value || '').trim() || fallback;
  try {
    return new URL(raw).origin;
  } catch {
    return fallback;
  }
}

/** This app. Also the redirect_uri host and the child's expected parent. */
export const GATEWAY_ORIGIN = 'http://localhost:3000';

/**
 * agent-workspace-web. Used for THREE things that must all agree:
 *   1. the <iframe src>
 *   2. the postMessage targetOrigin  (never "*")
 *   3. the event.origin check on inbound messages
 */
export const WORKSPACE_ORIGIN = normaliseOrigin(
  process.env.NEXT_PUBLIC_WORKSPACE_ORIGIN as string,
  'http://localhost:3001',
);

/** identity-gateway-api. The ONLY origin this app attaches a Bearer token to. */
export const GATEWAY_API = normaliseOrigin(
  process.env.NEXT_PUBLIC_GATEWAY_API as string,
  'http://localhost:4000',
);

/* -------------------------------------------------------------------------
 * The postMessage protocol -- SPEC.txt 5.3. Two messages, no third type.
 * ---------------------------------------------------------------------- */

/** child -> parent */
export const TOKEN_REQUIRED = 'TOKEN_REQUIRED';
/** parent -> child (initial acquisition AND renewal) */
export const AUTH_TOKEN = 'AUTH_TOKEN';

export interface TokenRequiredMessage {
  type: typeof TOKEN_REQUIRED;
}

export interface AuthTokenMessage {
  type: typeof AUTH_TOKEN;
  token: string;
}

/* -------------------------------------------------------------------------
 * Cookies. All httpOnly: the browser never reads these from script, and the
 * token is NEVER written to localStorage or sessionStorage (SPEC.txt 8).
 * ---------------------------------------------------------------------- */

/** Holds the raw JWT. httpOnly + SameSite=Lax. */
export const SESSION_COOKIE = 'gw_session';
/**
 * Holds the IdP authorization grant, which is what lets /api/auth/token mint a
 * REPLACEMENT access token when the current one has expired. It stands in for
 * the refresh token / IdP session an Entra deployment would have. Scoped to
 * /api/auth so it is not sent with page requests.
 */
export const GRANT_COOKIE = 'gw_grant';
/** Single-use CSRF state for the authorization code flow. */
export const STATE_COOKIE = 'gw_oauth_state';

export const GRANT_COOKIE_PATH = '/api/auth';
