# Theme: SEC-DED (Syndrome Zero)

v2 direction, chosen by a 3-lens judge panel (distinctiveness / audience-fit / feasibility)
over three alternatives. Mood sentence: *ECC-protected memory as a document — a datasheet-clean
scan that takes one visible bit hit, repairs it in front of you, and keeps a ledger to prove
nothing stays corrupted.* v1 ("Silicon Ochre") is archived at
`~/Repositories/website-archive/rfbert.me-v1-silicon-ochre`.

## Color (hex, light / dark) — WCAG-verified, see contrast notes

| Role      | Light (datasheet paper)   | Dark (solder-mask board)  |
|-----------|---------------------------|---------------------------|
| bg        | #F7F9F8                   | #0F231B                   |
| surface   | #EEF2EF                   | #173326                   |
| ink       | #16211B (15.7:1)          | #E9F1EA (14.3:1)          |
| muted     | #47564C (7.4:1)           | #9DB3A4 (7.4:1)           |
| line      | #D5DCD6                   | #274536                   |
| gold      | #9A7B1C (graphic, 3.8:1)  | #E2B93B (8.8:1)           |
| gold-text | #806414 (5.3:1 AA)        | #E2B93B                   |
| red       | #C03A1F (graphic)         | #FF7A54                   |
| red-text  | #A32E15 (6.7:1)           | #FF7A54 (6.4:1)           |

Color is **semantic, never decorative**: gold = verified (links, pads, ticks, corrected states),
red = a fault is live. Red never appears in the static state of any page except the 404
(a double-bit error: detectable, not correctable). Light is default; dark is a *material swap*
(the board the datasheet describes), not an inversion.

Contrast note: the direction spec's gold failed AA as text (3.8:1 measured) — hence the
gold/gold-text split in light mode. Keep both tokens; never set body-size text in `--c-gold`.

## Type roles

- **Display (nameplate, page titles):** Archivo Variable, width axis in use — name at
  wdth 120 / wght 800, page titles wdth 106 / 600, wordmark wdth 118. Never uppercase.
- **Body (everything):** IBM Plex Sans 400/500/600 — the typeface of the company that shipped
  ECC memory. 1.0625rem/1.65, measure ≤66ch.
- **Manuscript register:** IBM Plex Serif 400 + italic, *only* for the two research abstracts.
- **Data:** IBM Plex Mono 400/500 strictly for true data — dates, coordinates, checksums,
  stacks, status stamps, the degree spec line. Never headings, never body prose.

Scale ×1.25 modular; fluid clamp() headings capped 4.25rem.

## Signature

**The single-event upset, corrected — and operable.** One glyph in long body prose (marked
`data-seu`; the recruiter scan path is never eligible) takes a real XOR single-bit flip once
per page view, is struck in red, and snaps back corrected as the parity ledger ticks. The
corruption is purely presentational (aria-hidden overlay; copy/find/screen readers always get
clean text). The home ECC-word strip is the operable version: click to replay a flip-and-correct.
Reduced motion: no flips ever fire; the strip's static frame (gold bit, red strike) tells the
story instead. Motion doctrine: one pass, then still.
