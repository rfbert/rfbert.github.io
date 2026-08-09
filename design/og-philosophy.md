# OG Image Philosophy — "Caught Bit", SEC-DED edition

*(expressed in code at `src/lib/og.ts`, rendered at build time by `src/pages/og/[slug].png.ts`
for five slugs — home, research, projects, experience, about — that share one composition and
differ only in the wayfinding label; the v1 "Silicon Ochre" rendition of this card is archived
with the rest of v1 at `~/Repositories/website-archive/rfbert.me-v1-silicon-ochre`)*

**The movement.** Caught Bit is the poster form of SEC-DED: one hardware fault, caught,
corrected, and recorded on the datasheet that describes the part. The card carries the site
signature's exact ECC word — 'R' = 0x52 = 01010010 with its even-parity check bit set apart in
contact gold — and one bit standing corrected: gold, struck through in red, the same recorded
hit the home strip ships as its static frame. True data, not texture; the research told without
a sentence of explanation.

**Space and form.** Datasheet paper, not a dark field. A thick ink rule caps the card — the
part-header rule the site's own chrome opens with — and one horizontal band holds everything:
the ECC word over a short ink rule over the name over the focus line, with the ink portrait
from the home hero on the right. The identity column is fixed-width so the portrait can never
be squeezed by long text; the degree line runs the full width beneath, an instrument reading
under the specimen.

**Color and material.** The SEC-DED light tokens, verbatim: datasheet paper (#f7f9f8), epoxy
ink (#16211b), muted (#47564c), contact gold (#9a7b1c), fault red (#c03a1f). Color stays
semantic — gold is spent on the corrected bit and the check bit that caught it; red on exactly
one element, the strike that records the hit. That is the theme's one sanctioned static red:
red-as-record, never red-as-live-fault.

**Scale and rhythm.** Bits at 62px mono — readable from a feed thumbnail (the poster test).
IBM Plex Mono for the machine's voice, IBM Plex Sans for the human's, Archivo — the nameplate
face — for the name itself. The subset woffs in `src/assets/fonts` are the site's own faces,
so satori renders the card in the same voice the page speaks.

**Hierarchy.** 1) the caught bit · 2) the name · 3) the portrait · 4) the focus line ·
5) page label, URL, and the mono degree line. The machine's reading first, then the human it
identifies — a datasheet header, not a poster.
