# DESIGN.md

Theme: **SEC-DED (Syndrome Zero)** (see THEME.md). The site behaves like ECC-protected memory:
datasheet-clean scan, semantic gold/red (verified/fault), a parity rail that monitors the page,
and one visible bit-flip caught and corrected per page view. Light = datasheet paper (default),
dark = solder-mask board.

## Tokens

Semantic vars in `src/styles/global.css` (`:root` + `.dark`), mapped to Tailwind v4 utilities
via `@theme inline`: `bg / surface / ink / muted / line / gold / gold-text / red / red-text`.
Gold is split: `gold` for graphics (≥3:1), `gold-text` for text (AA). Never body text in `gold`.

## Type

- `font-display` **Archivo Variable** (width axis) — nameplate wdth 120/800, titles wdth 106/600.
- `font-sans` **IBM Plex Sans** — body, wayfinding. `font-serif` **IBM Plex Serif** — research
  abstracts only. `font-mono` **IBM Plex Mono** — true data only (dates, coords, CRCs, stamps).
- Scale ×1.25 modular; fluid clamp() headings ≤4.25rem; body 1.0625rem/1.65; prose ≤66ch.

## Mechanisms (all real, none decorative)

- `SiteShell.astro` — parity rail (desktop): live hex scroll
  offset, fault ledger mirrored in the footer. One-shot SEU engine: a single XOR bit flip in
  `[data-seu]` prose per page view, corrected in ~420ms, ledger ticks. Scan path never eligible.
- `EccWord.astro` — operable signature strip (click replays flip-and-correct; static frame under
  no-JS/reduced-motion tells the same story).
- `BitExhibit.astro` — IEEE-754 "one weight, thirty-two switches" (Research page): real
  Float32 decode, roving-tabindex toolbar, honest illustration caption.
- `PinContacts.astro` — the 4-contact pinout; real build-time CRC-8 (`src/lib/crc8.ts`) on
  every verified link, revealed on hover/focus.
- `StatusStamp` / `Led` — status as data; LEDs always paired with text labels.

## Hard rules

- Structural safety net: every page complete, styled, and scannable with JS disabled;
  scripts are additive layers. Reduced motion: designed static final frames, zero flips.
- Red never in the static state of any page except 404 — with one carve-out: the strike that
  *records* a corrected hit (ECC strip, favicon, OG mark), always paired with a gold corrected
  bit. Red-as-record is allowed; red-as-live-fault is 404-only. Statuses stay gold/neutral.
- Motion: one pass, then still. steps() for digital state, ≤420ms ease-out for sweeps.
  Only loop: the 2s active LED.
- Section labels stay plain English ("Selected work", "Contact") — metaphor lives in chrome,
  never in words a screener must decode.

## Bans honored

No side-stripe borders, no gradient text, no glassmorphism, no hero-metric template, no
identical card grids, no uppercase tracked eyebrows as section grammar, no numbered section
scaffolding, no cream body background, no monospace-as-costume (mono carries only true data,
including genuine CRC-8 checksums).
