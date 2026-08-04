# rfbert.github.io

Personal website + portfolio of Rodrigo Flores Bertolotti. Astro 5 · Tailwind v4 · static ·
deployed to GitHub Pages (user site — served at the domain root, `site` set, no `base`).

## Develop

```bash
npm install
npm run dev        # localhost:4321
npm run build      # → dist/ (also generates /og/*.png at build time)
npm run preview    # serve the built dist/
npm run check      # astro check (types)
```

## Structure

- `src/data/site.ts` — name, contacts (the only four), education lines, awards, nav
- `src/content/{experience,projects,research}/` — content collections (schemas in `src/content.config.ts`)
- `src/styles/global.css` — Silicon Ochre tokens (`THEME.md`), light + dark via `.dark`
- `src/components/BitSignature.astro` — the site signature ("a flipped bit, caught")
- `src/lib/og.ts` + `src/pages/og/[slug].png.ts` — build-time OG images (`design/og-philosophy.md`)
- `public/resume.pdf` — copied from `~/Repositories/resume/resume.pdf`; re-copy after resume updates
- `PRODUCT.md` / `DESIGN.md` — design-system context (impeccable)

## Deploy (first time)

```bash
gh repo create rfbert/rfbert.github.io --public --source . --push
```

Then on github.com: **Settings → Pages → Source: GitHub Actions.** The included
`.github/workflows/deploy.yml` (withastro/action) builds and deploys on every push to `main`.
Site: https://rfbert.me

## Content maintenance

- New project/research/experience → add a `.md` under `src/content/…` (schema-typed).
- Updated resume → `cp ~/Repositories/resume/resume.pdf public/resume.pdf`.
- Mibanco quantified-results bullet: placeholder comment in `src/content/experience/mibanco.md`.
- Blog later: add a `posts` collection + nav item (nav is data-driven in `site.ts`).
