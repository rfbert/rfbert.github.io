/**
 * The contract values this app shares with the rest of the platform
 * (SPEC.txt 5.1), in one place so nothing can drift.
 *
 * Both constants are NEXT_PUBLIC_ and therefore inlined into the browser
 * bundle at build time. Neither is a secret: an origin and a URL. The secret --
 * the token -- never appears in this file, in the bundle, or in any storage
 * the browser persists.
 *
 * The fallbacks are the spec's literal values. They exist so a missing
 * .env.local produces a working build rather than `undefined` silently
 * becoming a postMessage target origin.
 */

/**
 * GATEWAY_ORIGIN -- identity-gateway-web.
 *
 * This single constant is used in three places, and it MUST be the same value
 * in all three or the bridge is broken in a way that is hard to see:
 *
 *   1. next.config.js  -> Content-Security-Policy: frame-ancestors <this>
 *   2. lib/token.ts    -> postMessage targetOrigin for TOKEN_REQUIRED
 *   3. lib/token.ts    -> the event.origin an AUTH_TOKEN must arrive from
 */
export const GATEWAY_ORIGIN: string =
  process.env.NEXT_PUBLIC_GATEWAY_ORIGIN || 'http://localhost:3000';

/** agent-workspace-api -- NestJS 2, DATABASE B. */
export const WORKSPACE_API: string =
  process.env.NEXT_PUBLIC_WORKSPACE_API || 'http://localhost:4001';

/** This app's own origin. Used only for display; the browser knows the rest. */
export const WORKSPACE_ORIGIN = 'http://localhost:3001';
