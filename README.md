# rfbert.github.io — [rfbert.me](https://rfbert.me)

[![Live site](https://img.shields.io/badge/live-rfbert.me-1f6feb)](https://rfbert.me)
![Astro 5](https://img.shields.io/badge/Astro-5-BC52EE?logo=astro&logoColor=white)
![Tailwind v4](https://img.shields.io/badge/Tailwind-v4-38BDF8?logo=tailwindcss&logoColor=white)
![Deploy](https://img.shields.io/badge/deploy-GitHub%20Actions-2088FF?logo=githubactions&logoColor=white)

Personal website and portfolio of **Rodrigo Flores Bertolotti** — CS undergraduate at
Oregon State University building production AI. Designed and built end to end: Astro 5,
Tailwind v4, a hand-rolled type system ("Silicon Ochre"), build-time Open Graph images,
and a static deploy to GitHub Pages on a custom domain.

The site signature — a single glyph flipping from a clean to a corrupted bit — is a nod
to the LLM fault-resilience research it links to: *a flipped bit, caught.*

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
Site: https://rfbert.github.io

## Content maintenance

- New project/research/experience → add a `.md` under `src/content/…` (schema-typed).
- Updated resume → `cp ~/Repositories/resume/resume.pdf public/resume.pdf`.
- Mibanco quantified-results bullet: placeholder comment in `src/content/experience/mibanco.md`.
- Blog later: add a `posts` collection + nav item (nav is data-driven in `site.ts`).
