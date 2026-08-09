// @ts-check
import { defineConfig } from 'astro/config';
import sitemap from '@astrojs/sitemap';
import tailwindcss from '@tailwindcss/vite';
import { updatedISO } from './src/lib/updated';

// GitHub Pages USER site → served at the domain root. `site` set, no `base`.
export default defineConfig({
  site: 'https://rfbert.me',
  output: 'static',
  integrations: [
    sitemap({
      // <lastmod> = the site-wide last-change date, same source the footer's
      // "Updated" stamp reads. The config runs in Node at build time, where
      // the git checkout is available.
      serialize: (item) => ({ ...item, lastmod: updatedISO }),
    }),
  ],
  vite: {
    plugins: [tailwindcss()],
  },
});
