# rfbert.github.io

Personal website + portfolio of Rodrigo Flores Bertolotti. Astro 5 · Tailwind v4 · static ·
deployed to GitHub Pages at https://rfbert.me (user site — served at the domain root, `site` set, no `base`).

## Develop

```bash
npm install
npm run dev        # localhost:4321
npm run build      # → dist/ (also generates /og/*.png at build time)
npm run preview    # serve the built dist/
npm run check      # astro check (types)
```

## Structure

- `src/data/site.ts` — name, contacts, education lines, awards, nav
- `src/content/{experience,projects,research}/` — content collections (schemas in `src/content.config.ts`)
- `src/styles/global.css` — Silicon Ochre tokens (`THEME.md`), light + dark via `.dark`
- `src/components/BitSignature.astro` — the site signature ("a flipped bit, caught")
- `src/lib/og.ts` + `src/pages/og/[slug].png.ts` — build-time OG images (`design/og-philosophy.md`)
- `public/resume.pdf` — the downloadable resume
- `PRODUCT.md` / `DESIGN.md` — product and design-system context

## Deploy

Every push to `main` triggers `.github/workflows/deploy.yml` (also runnable manually via
workflow dispatch): `withastro/action` builds the site, then `actions/deploy-pages`
publishes it to GitHub Pages. The custom domain `rfbert.me` is set by `public/CNAME`.

## Content maintenance

- New project/research/experience → add a `.md` under `src/content/…` (schema-typed).
- Updated resume → replace `public/resume.pdf`.
- Mibanco quantified-results bullet: placeholder comment in `src/content/experience/mibanco.md`.
- Blog later: add a `posts` collection + nav item (nav is data-driven in `site.ts`).
