/**
 * Generates the site mark: public/favicon.svg, favicon.ico and apple-touch-icon.png.
 *
 * The mark is an impossible triangle — three bars that cannot coexist, drawn in
 * the site's own colours: solder-mask green ground, silkscreen and contact gold
 * for the bars. Nudged 2 units down the tile so it sits optically centred.
 *
 * Run: npm run icons
 */
import { Resvg } from '@resvg/resvg-js';
import { writeFileSync } from 'node:fs';

const MASK = '#0F231B';   // solder mask — the dark theme's ground
const SILK = '#E9F1EA';   // silkscreen
const GOLD = '#E2B93B';   // contact gold
const GREY = '#A9BAAE';   // silkscreen in shadow
const DY = 2;             // optical centring: a triangle reads high in its box

/** Shift a path's y coordinates so the whole figure can be nudged as one. */
const at = (d) => d.replace(/(\d+(?:\.\d+)?) (\d+(?:\.\d+)?)/g, (_, x, y) => `${x} ${(+y + DY).toFixed(1)}`);

const bars = `  <path d="${at('M32 8 L57 52 L45 52 L26 18 Z')}" fill="${SILK}"/>
  <path d="${at('M57 52 L7 52 L13 41 L51 41 Z')}" fill="${GREY}"/>
  <path d="${at('M7 52 L32 8 L38 19 L19 52 Z')}" fill="${GOLD}"/>
  <path d="${at('M32 8 L38 19 L32 30 L26 18 Z')}" fill="${SILK}"/>`;

/** rx 0 for iOS/Android, which apply their own mask; rx 13 everywhere else. */
const svg = (rx) => `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 64 64" role="img" aria-label="Rodrigo Flores Bertolotti">
  <title>Rodrigo Flores Bertolotti</title>
  <rect width="64" height="64"${rx ? ` rx="${rx}"` : ''} fill="${MASK}"/>
${bars}
</svg>
`;

const rounded = svg(13), square = svg(0);
writeFileSync('public/favicon.svg', rounded);

const png = (s, size) => new Resvg(s, { fitTo: { mode: 'width', value: size } }).render().asPng();
writeFileSync('public/apple-touch-icon.png', png(square, 180));

// ICO container: 6-byte header, 16 bytes per entry, then embedded PNGs.
const sizes = [16, 32, 48];
const blobs = sizes.map((n) => png(rounded, n));
const head = Buffer.alloc(6);
head.writeUInt16LE(0, 0); head.writeUInt16LE(1, 2); head.writeUInt16LE(sizes.length, 4);
let offset = 6 + 16 * sizes.length;
const dir = sizes.map((n, i) => {
  const e = Buffer.alloc(16);
  e.writeUInt8(n % 256, 0); e.writeUInt8(n % 256, 1);
  e.writeUInt16LE(1, 4); e.writeUInt16LE(32, 6);
  e.writeUInt32LE(blobs[i].length, 8); e.writeUInt32LE(offset, 12);
  offset += blobs[i].length;
  return e;
});
writeFileSync('public/favicon.ico', Buffer.concat([head, ...dir, ...blobs]));
console.log(`favicon.svg ${rounded.length}B · apple-touch-icon.png ${png(square,180).length}B · favicon.ico ${offset}B`);
