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

const bit = (ch: string, opts: { caught?: boolean } = {}) => ({
  type: 'div',
  props: {
    style: {
      display: 'flex',
      alignItems: 'center',
      justifyContent: 'center',
      position: 'relative',
      width: 64,
      height: 88,
      fontFamily: 'IBM Plex Mono',
      fontSize: 72,
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
                  top: 46,
                  height: 5,
                  backgroundColor: C.red,
                },
              },
            },
          ]
        : []),
    ],
  },
});

export async function renderOg(label: string): Promise<Buffer> {
  // The same ECC word the site's signature strip carries: 'R' = 0x52 =
  // 01010010, bit 3 caught and corrected. True data, not texture.
  const bits = ['0', '1', '0'].map((b) => bit(b));
  const caught = bit('1', { caught: true });
  const rest = ['0', '0', '1', '0'].map((b) => bit(b));

  const element = {
    type: 'div',
    props: {
      style: {
        width: 1200,
        height: 630,
        display: 'flex',
        flexDirection: 'column',
        backgroundColor: C.bg,
        padding: '64px 72px',
        justifyContent: 'space-between',
        borderTop: `10px solid ${C.ink}`,
      },
      children: [
        {
          type: 'div',
          props: {
            style: { display: 'flex', justifyContent: 'space-between', alignItems: 'center' },
            children: [
              {
                type: 'div',
                props: {
                  style: {
                    fontFamily: 'IBM Plex Sans',
                    fontSize: 26,
                    color: C.muted,
                    letterSpacing: 2,
                  },
                  children: label,
                },
              },
              {
                type: 'div',
                props: {
                  style: { fontFamily: 'IBM Plex Mono', fontSize: 24, color: C.muted },
                  children: 'rfbert.me',
                },
              },
            ],
          },
        },
        {
          type: 'div',
          props: {
            style: { display: 'flex', flexDirection: 'column', gap: 36 },
            children: [
              {
                type: 'div',
                props: {
                  style: { display: 'flex', gap: 10, alignItems: 'center' },
                  children: [
                    ...bits,
                    caught,
                    ...rest,
                    // the check bit, set apart in contact gold
                    {
                      type: 'div',
                      props: {
                        style: {
                          display: 'flex',
                          alignItems: 'center',
                          justifyContent: 'center',
                          width: 64,
                          height: 88,
                          marginLeft: 22,
                          fontFamily: 'IBM Plex Mono',
                          fontSize: 72,
                          color: C.gold,
                        },
                        children: '1',
                      },
                    },
                  ],
                },
              },
              {
                type: 'div',
                props: {
                  style: {
                    width: 220,
                    height: 3,
                    backgroundColor: C.ink,
                  },
                },
              },
              {
                type: 'div',
                props: {
                  style: {
                    fontFamily: 'Archivo',
                    fontWeight: 600,
                    fontSize: 64,
                    color: C.ink,
                    lineHeight: 1.15,
                  },
                  children: 'Rodrigo Flores Bertolotti',
                },
              },
              {
                type: 'div',
                props: {
                  style: {
                    fontFamily: 'IBM Plex Sans',
                    fontSize: 30,
                    color: C.muted,
                    lineHeight: 1.4,
                  },
                  children:
                    'Building production AI — speech-to-text at Mibanco (Credicorp) · LLM-reliability research at OSU',
                },
              },
            ],
          },
        },
        {
          type: 'div',
          props: {
            style: {
              fontFamily: 'IBM Plex Mono',
              fontSize: 22,
              color: C.muted,
            },
            children: 'B.S. Computer Science, Oregon State University — expected June 2028 · GPA 4.0, Honors College',
          },
        },
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
