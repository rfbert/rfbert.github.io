import satori from 'satori';
import { Resvg } from '@resvg/resvg-js';
import { readFile } from 'node:fs/promises';
import path from 'node:path';

/** "Caught Bit", SEC-DED edition — see design/og-philosophy.md.
    Datasheet paper, epoxy ink, contact gold for the corrected bit,
    fault red only for the strike that records the hit. */
const C = {
  bg: '#f7f9f8',
  ink: '#16211b',
  muted: '#47564c',
  line: '#d5dcd6',
  gold: '#9a7b1c',
  red: '#c03a1f',
};

const FONT_DIR = path.resolve('src/assets/fonts');
const PORTRAIT = path.resolve('src/assets/portrait-og.png');

/** The same ink portrait the home hero carries, pre-inked for the card. */
async function portraitDataUri() {
  const png = await readFile(PORTRAIT);
  return `data:image/png;base64,${png.toString('base64')}`;
}

async function fonts() {
  const [sans, sansSemi, mono, display] = await Promise.all([
    readFile(path.join(FONT_DIR, 'ibm-plex-sans-latin-400-normal.woff')),
    readFile(path.join(FONT_DIR, 'ibm-plex-sans-latin-600-normal.woff')),
    readFile(path.join(FONT_DIR, 'ibm-plex-mono-latin-500-normal.woff')),
    readFile(path.join(FONT_DIR, 'archivo-latin-600-normal.woff')),
  ]);
  return [
    { name: 'IBM Plex Sans', data: sans, weight: 400 as const, style: 'normal' as const },
    { name: 'IBM Plex Sans', data: sansSemi, weight: 600 as const, style: 'normal' as const },
    { name: 'IBM Plex Mono', data: mono, weight: 500 as const, style: 'normal' as const },
    { name: 'Archivo', data: display, weight: 600 as const, style: 'normal' as const },
  ];
}

const BIT_W = 54;
const BIT_H = 76;
const BIT_SIZE = 62;

const bit = (ch: string, opts: { caught?: boolean } = {}) => ({
  type: 'div',
  props: {
    style: {
      display: 'flex',
      alignItems: 'center',
      justifyContent: 'center',
      position: 'relative',
      width: BIT_W,
      height: BIT_H,
      fontFamily: 'IBM Plex Mono',
      fontSize: BIT_SIZE,
      color: opts.caught ? C.gold : C.ink,
    },
    children: [
      { type: 'div', props: { children: ch } },
      ...(opts.caught
        ? [
            {
              type: 'div',
              props: {
                style: {
                  position: 'absolute',
                  left: -4,
                  right: -4,
                  top: 39,
                  height: 4,
                  backgroundColor: C.red,
                },
              },
            },
          ]
        : []),
    ],
  },
});

const text = (
  children: string,
  style: Record<string, string | number>
) => ({ type: 'div', props: { style, children } });

export async function renderOg(label: string): Promise<Buffer> {
  // The same ECC word the site's signature strip carries: 'R' = 0x52 =
  // 01010010, bit 3 caught and corrected. True data, not texture.
  const word = [
    ...['0', '1', '0'].map((b) => bit(b)),
    bit('1', { caught: true }),
    ...['0', '0', '1', '0'].map((b) => bit(b)),
    // the check bit, set apart in contact gold
    text('1', {
      display: 'flex',
      alignItems: 'center',
      justifyContent: 'center',
      width: BIT_W,
      height: BIT_H,
      marginLeft: 20,
      fontFamily: 'IBM Plex Mono',
      fontSize: BIT_SIZE,
      color: C.gold,
    }),
  ];

  // Header and the degree line run the full card width; the portrait shares
  // the middle band with the identity block.
  const header = {
    type: 'div',
    props: {
      style: { display: 'flex', justifyContent: 'space-between', alignItems: 'center' },
      children: [
        text(label, {
          fontFamily: 'IBM Plex Sans',
          fontSize: 24,
          color: C.muted,
          letterSpacing: 2,
        }),
        text('rfbert.me', { fontFamily: 'IBM Plex Mono', fontSize: 24, color: C.muted }),
      ],
    },
  };

  const identity = {
    type: 'div',
    props: {
      style: {
        // 1200 − 144 padding − 268 portrait − 44 gap. Fixed rather than grown,
        // so the portrait can never be squeezed by long text.
        width: 744,
        flexShrink: 0,
        display: 'flex',
        flexDirection: 'column',
        gap: 26,
      },
      children: [
        {
          type: 'div',
          props: { style: { display: 'flex', gap: 8, alignItems: 'center' }, children: word },
        },
        { type: 'div', props: { style: { width: 220, height: 3, backgroundColor: C.ink } } },
        text('Rodrigo Flores Bertolotti', {
          fontFamily: 'Archivo',
          fontWeight: 600,
          fontSize: 58,
          color: C.ink,
          lineHeight: 1.15,
        }),
        text(
          'Building AI systems — speech-to-text at Mibanco (Credicorp) · LLM-reliability research at OSU',
          { fontFamily: 'IBM Plex Sans', fontSize: 26, color: C.muted, lineHeight: 1.4 }
        ),
      ],
    },
  };

  const band = {
    type: 'div',
    props: {
      style: { display: 'flex', flexDirection: 'row', alignItems: 'center' },
      children: [
        identity,
        {
          type: 'img',
          props: {
            src: await portraitDataUri(),
            width: 268,
            height: 311,
            style: { marginLeft: 44, flexShrink: 0 },
          },
        },
      ],
    },
  };

  const element = {
    type: 'div',
    props: {
      style: {
        width: 1200,
        height: 630,
        display: 'flex',
        flexDirection: 'column',
        justifyContent: 'space-between',
        backgroundColor: C.bg,
        padding: '56px 72px',
        borderTop: `10px solid ${C.ink}`,
      },
      children: [
        header,
        band,
        text(
          'B.S. Computer Science, Oregon State University — expected June 2028 · GPA 4.0, Honors College',
          { fontFamily: 'IBM Plex Mono', fontSize: 22, color: C.muted }
        ),
      ],
    },
  };

  const svg = await satori(element as Parameters<typeof satori>[0], {
    width: 1200,
    height: 630,
    fonts: await fonts(),
  });

  const png = new Resvg(svg, { fitTo: { mode: 'width', value: 1200 } }).render().asPng();
  return Buffer.from(png);
}
