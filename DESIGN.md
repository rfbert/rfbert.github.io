# DESIGN.md

Theme: **Silicon Ochre** (see THEME.md). Strategy: Restrained — pure-white (light) /
near-black charcoal (dark) surfaces, precise ink, ONE considered ochre accent (≤10% of any
viewport), warmth carried by accent + serif, never by background tint.

## Tokens

Semantic vars in `src/styles/global.css` (`:root` + `.dark`), mapped to Tailwind v4 utilities
via `@theme inline`: `bg / surface / ink / muted / line / accent`. OKLCH everywhere.

## Type

- `font-serif` **STIX Two Text** — voice: prose, headlines (the scientific-publishing face).
- `font-sans` **Schibsted Grotesk** — wayfinding: nav, labels, buttons, captions.
- `font-mono` **Spline Sans Mono** — data: dates, stacks, bits.
- Scale ×1.30 modular; fluid clamp() headings (max ≤ 6rem); body 1.0625rem/1.7; prose ≤ 68ch.

## Signature

`BitSignature.astro` — a strip of bits where one flips to ochre, is struck, and corrected
("a flipped bit, caught"). The one memorable element; everything around it stays quiet.
Plays once on load; static under reduced motion. Do not add competing decorative motion.

## Bans honored

No side-stripe borders, no gradient text, no glassmorphism, no hero-metric template, no
identical card grids, no uppercase tracked eyebrows as section grammar, no numbered section
scaffolding, no cream body background, no monospace-as-costume.
