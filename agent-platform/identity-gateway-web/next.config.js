/**
 * identity-gateway-web -- Next.js 1, port 3000.
 *
 * This app is the TOP-LEVEL document: it frames agent-workspace-web (:3001),
 * and is itself never framed. The headers below say exactly that.
 *
 * The frame-src / frame-ancestors CSP is applied in production only. `next dev`
 * ships an error overlay whose internals are not worth fighting for a scaffold,
 * and `next start` is how the acceptance harness runs this service anyway.
 * Note the CSP deliberately declares NO default-src: it constrains framing and
 * nothing else, so Next's own inline hydration scripts keep working.
 */
const WORKSPACE_ORIGIN =
  process.env.NEXT_PUBLIC_WORKSPACE_ORIGIN || 'http://localhost:3001';

const isProduction = process.env.NODE_ENV === 'production';

/** @type {import('next').NextConfig} */
const nextConfig = {
  reactStrictMode: true,
  // This service sits in a monorepo with several lockfiles; pin the tracing
  // root to this package so the build does not guess the repository root.
  outputFileTracingRoot: __dirname,
  poweredByHeader: false,
  async headers() {
    const headers = [
      { key: 'X-Content-Type-Options', value: 'nosniff' },
      { key: 'Referrer-Policy', value: 'no-referrer' },
      // The parent must never itself be embedded.
      { key: 'X-Frame-Options', value: 'DENY' },
    ];

    if (isProduction) {
      headers.push({
        key: 'Content-Security-Policy',
        // frame-src: the ONLY origin this app may embed.
        // frame-ancestors: nobody may embed this app.
        value: `frame-src ${WORKSPACE_ORIGIN}; frame-ancestors 'none'`,
      });
    }

    return [{ source: '/:path*', headers }];
  },
};

module.exports = nextConfig;
