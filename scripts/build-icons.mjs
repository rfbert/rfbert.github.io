/**
 * Generates the site mark: public/favicon.svg, favicon.ico and apple-touch-icon.png.
 *
 * The letterform is pulled straight from the woff the nameplate uses, so the mark
 * can never drift from the wordmark. Colours are the site's own: the solder-mask
 * green the dark theme is built on, and contact gold.
 *
 * Run: npm run icons
 */
import opentype from 'opentype.js';
import { Resvg } from '@resvg/resvg-js';
import { readFileSync, writeFileSync } from 'node:fs';

const buf = readFileSync('src/assets/fonts/archivo-latin-600-normal.woff');
const font = opentype.parse(buf.buffer.slice(buf.byteOffset, buf.byteOffset + buf.byteLength));
const glyph = font.charToGlyph('R');
const LSB = 76, ADV = 687, CAP = 686;          // measured from the glyph outline
const GW = ADV - LSB;

const MASK = '#0F231B';                         // solder mask — the dark theme's ground
const GOLD = '#E2B93B';                         // contact gold
const H = 44;                                   // cap height inside the 64-unit tile

const S = H * 1000 / CAP;
const rw = GW * S / 1000;
const x = (64 - rw) / 2 - LSB * S / 1000;
const baseline = (64 - H) / 2 + H;
const path = glyph.getPath(x, baseline, S).toPathData(2);

/** rx 0 for iOS/Android, which apply their own mask; rx 13 everywhere else. */
const svg = (rx) => `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 64 64" role="img" aria-label="Rodrigo Flores Bertolotti">
  <title>Rodrigo Flores Bertolotti</title>
  <rect width="64" height="64"${rx ? ` rx="${rx}"` : ''} fill="${MASK}"/>
  <path d="${path}" fill="${GOLD}"/>
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
