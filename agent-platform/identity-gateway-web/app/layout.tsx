/**
 * Application shell (SPEC.txt 4.2).
 *
 * No next/font: it fetches font files at build time, and this scaffold has to
 * build offline. A plain system stack is declared in globals.css instead.
 */
import type { Metadata } from 'next';

import './globals.css';

export const metadata: Metadata = {
  title: 'Identity Gateway',
  description:
    'Next.js 1 - one Microsoft identity, one login, one JWT, handed to a second independent application through an origin-checked postMessage bridge.',
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en">
      <body>
        <header className="site-head">
          <a className="brand" href="/">
            <span className="dot" aria-hidden="true" />
            identity-gateway-web
          </a>
          <nav>
            <a href="/">Home</a>
            <a href="/workspace">Workspace</a>
            <span className="port">:3000</span>
          </nav>
        </header>

        <main className="site-main">{children}</main>

        <footer className="site-foot">
          <span>
            One identity (<code>tid</code> + <code>oid</code>) &middot; two applications &middot; two
            databases &middot; one login
          </span>
        </footer>
      </body>
    </html>
  );
}
