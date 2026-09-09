/**
 * agent-workspace-web -- Next.js 2, port 3001.
 *
 * ===========================================================================
 * THE ONE HEADER THIS WHOLE SERVICE HANGS ON
 * ===========================================================================
 *
 *     Content-Security-Policy: frame-ancestors http://localhost:3000
 *
 * SPEC.txt Section 8, "KNOWN LOCAL PITFALLS":
 *     "CSP: without 'frame-ancestors http://localhost:3000' on :3001, the
 *      iframe renders blank with a console error and nothing else looks
 *      wrong."
 *
 * That is the whole reason this header is declared here rather than being left
 * to a default. It is a two-sided statement:
 *
 *   - PERMISSIVE, deliberately: it grants http://localhost:3000
 *     (identity-gateway-web) permission to frame this app. Without the header
 *     nothing forbids framing either -- but the moment anyone adds a default
 *     X-Frame-Options or a stricter CSP, acceptance test 4 dies silently. This
 *     line makes the grant explicit and reviewable.
 *
 *   - RESTRICTIVE, equally deliberately: frame-ancestors names exactly ONE
 *     origin. No 'self', no '*', no second origin. Any other page that tries
 *     to embed the workspace -- and therefore any page that tries to farm the
 *     postMessage bridge -- is refused by the browser.
 *
 * The origin is read from NEXT_PUBLIC_GATEWAY_ORIGIN so that this value and the
 * postMessage targetOrigin in lib/token.ts can never drift apart: they are the
 * same constant, and they must be, or the frame loads and the handshake still
 * fails (or vice versa).
 *
 * NOTE: no X-Frame-Options header is emitted. X-Frame-Options has no
 * allow-list form -- SAMEORIGIN would block :3000 outright -- and where both
 * headers are present browsers give CSP precedence unevenly. frame-ancestors
 * is the modern, single source of truth.
 */

/** SPEC.txt 5.1: GATEWAY_ORIGIN. Identical to the value used in lib/config.ts. */
const GATEWAY_ORIGIN = process.env.NEXT_PUBLIC_GATEWAY_ORIGIN || 'http://localhost:3000';

/** @type {import('next').NextConfig} */
const nextConfig = {
  reactStrictMode: true,

  // This service lives inside a monorepo that has its own root package-lock.
  // Pinning the tracing root keeps Next from guessing (and warning) about which
  // directory it is building from.
  outputFileTracingRoot: __dirname,

  async headers() {
    return [
      {
        // Every response, page and route handler alike.
        source: '/:path*',
        headers: [
          {
            key: 'Content-Security-Policy',
            value: `frame-ancestors ${GATEWAY_ORIGIN}`,
          },
          { key: 'X-Content-Type-Options', value: 'nosniff' },
          // The token never travels in a URL, so a referrer can never leak it;
          // this keeps it that way if a future page ever links out.
          { key: 'Referrer-Policy', value: 'no-referrer' },
        ],
      },
    ];
  },
};

module.exports = nextConfig;
