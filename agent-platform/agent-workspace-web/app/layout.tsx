/**
 * agent-workspace-web shell (SPEC.txt 4.4, "app/layout.tsx -- Application
 * shell").
 *
 * Kept deliberately bare. This document is rendered BOTH as a top-level page
 * at http://localhost:3001 and inside an iframe hosted by
 * http://localhost:3000, so it carries no chrome that would look wrong when
 * embedded, and no font loader that would need the network at build time
 * (next/font is avoided on purpose -- a plain system stack lives in
 * globals.css).
 */
import type { Metadata } from 'next';
import type { ReactNode } from 'react';

import './globals.css';

export const metadata: Metadata = {
  title: 'Agent Workspace',
  description:
    'Next.js 2 -- runs embedded in identity-gateway-web via postMessage, or standalone with its own login.',
};

export default function RootLayout({ children }: { children: ReactNode }) {
  return (
    <html lang="en">
      <body>{children}</body>
    </html>
  );
}
