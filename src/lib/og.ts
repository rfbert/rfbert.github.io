import satori from 'satori';
import { Resvg } from '@resvg/resvg-js';
import { readFile } from 'node:fs/promises';
import path from 'node:path';

/** "Caught Bit" — see design/og-philosophy.md. */
const C = {
  bg: '#17181d',
  ink: '#ececea',
  muted: '#a2a4ab',
  line: '#34363c',
  accent: '#d59a4b',
};

const FONT_DIR = path.resolve('src/assets/fonts');

async function fonts() {
  const [stix, stixSemi, mono, sans] = await Promise.all([
    readFile(path.join(FONT_DIR, 'stix-two-text-400.ttf')),
    readFile(path.join(FONT_DIR, 'stix-two-text-600.ttf')),
    readFile(path.join(FONT_DIR, 'spline-sans-mono-500.ttf')),
    readFile(path.join(FONT_DIR, 'schibsted-grotesk-600.ttf')),
  ]);
  return [
    { name: 'STIX Two Text', data: stix, weight: 400 as const, style: 'normal' as const },
    { name: 'STIX Two Text', data: stixSemi, weight: 600 as const, style: 'normal' as const },
    { name: 'Spline Sans Mono', data: mono, weight: 500 as const, style: 'normal' as const },
    { name: 'Schibsted Grotesk', data: sans, weight: 600 as const, style: 'normal' as const },
  ];
}

const bit = (ch: string, opts: { accent?: boolean; struck?: boolean } = {}) => ({
  type: 'div',
  props: {
    style: {
      display: 'flex',
      alignItems: 'center',
      justifyContent: 'center',
      position: 'relative',
      width: 64,
      height: 88,
      fontFamily: 'Spline Sans Mono',
      fontSize: 72,
      color: opts.accent ? C.accent : C.ink,
    },
    children: [
      { type: 'div', props: { children: ch } },
      ...(opts.struck
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
                  backgroundColor: C.accent,
                },
              },
            },
          ]
        : []),
    ],
  },
});

export async function renderOg(label: string): Promise<Buffer> {
  const bits = ['1', '0', '1', '1'].map((b) => bit(b));
  const caught = bit('1', { accent: true, struck: true });
  const rest = ['0', '1', '0', '0'].map((b) => bit(b));

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
                    fontFamily: 'Schibsted Grotesk',
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
                  style: { fontFamily: 'Spline Sans Mono', fontSize: 24, color: C.muted },
                  children: 'rfbert.github.io',
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
                    {
                      type: 'div',
                      props: {
                        style: {
                          fontFamily: 'Schibsted Grotesk',
                          fontSize: 24,
                          color: C.muted,
                          marginLeft: 28,
                        },
                        children: '← a flipped bit, caught',
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
                    height: 2,
                    backgroundColor: C.line,
                  },
                },
              },
              {
                type: 'div',
                props: {
                  style: {
                    fontFamily: 'STIX Two Text',
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
                    fontFamily: 'STIX Two Text',
                    fontSize: 30,
                    color: C.muted,
                    lineHeight: 1.4,
                  },
                  children:
                    'LLM reliability — fault-resilient inference at OSU’s TRUE AI Lab · production speech AI at Mibanco (Credicorp)',
                },
              },
            ],
          },
        },
        {
          type: 'div',
          props: {
            style: {
              fontFamily: 'Schibsted Grotesk',
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
