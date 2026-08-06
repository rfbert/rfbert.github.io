import opentype from 'opentype.js';
import { Resvg } from '@resvg/resvg-js';
import { readFileSync, writeFileSync } from 'node:fs';

const buf = readFileSync('src/assets/fonts/archivo-latin-600-normal.woff');
const font = opentype.parse(buf.buffer.slice(buf.byteOffset, buf.byteOffset + buf.byteLength));
const g = font.charToGlyph('R');
const BB = { x1: 76, y1: -686, x2: 687 };
const GW = BB.x2 - BB.x1, GH = -BB.y1;

const INK = '#16211B', SILK = '#E9F1EA', GOLD = '#E2B93B';
const H = 38, BIT = 9, GAP = 5;                 // chosen from the size-ladder review

const S = H * 1000 / GH;
const rw = GW * S / 1000;
const total = rw + GAP + BIT;
const x0 = (64 - total) / 2;
const y0 = (64 - H) / 2;
const rPath = g.getPath(x0 - BB.x1 * S / 1000, y0 + H, S).toPathData(2);

/** rx 0 for iOS/Android, which apply their own mask; rx 14 everywhere else. */
const svg = (rx) => `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 64 64" role="img" aria-label="Rodrigo Flores Bertolotti">
  <title>Rodrigo Flores Bertolotti</title>
  <!-- The nameplate's own R (Archivo 600), trailed by its check bit in verified
       gold - the ECC word's "byte, then parity" read as a monogram. One mark,
       identical on every page and every surface. -->
  <rect width="64" height="64"${rx ? ` rx="${rx}"` : ''} fill="${INK}"/>
  <path d="${rPath}" fill="${SILK}"/>
  <rect x="${(x0 + rw + GAP).toFixed(2)}" y="${(y0 + H - BIT).toFixed(2)}" width="${BIT}" height="${BIT}" rx="1" fill="${GOLD}"/>
</svg>
`;

const rounded = svg(14), square = svg(0);
writeFileSync('public/favicon.svg', rounded);

const png = (s, size) => new Resvg(s, { fitTo: { mode: 'width', value: size } }).render().asPng();
writeFileSync('public/apple-touch-icon.png', png(square, 180));

// ICO container: 6-byte header, 16 bytes per entry, then embedded PNGs.
const sizes = [16, 32, 48];
const blobs = sizes.map((n) => png(rounded, n));
const head = Buffer.alloc(6); head.writeUInt16LE(0, 0); head.writeUInt16LE(1, 2); head.writeUInt16LE(sizes.length, 4);
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
writeFileSync('/tmp/icon/final.svg', rounded);
console.log('favicon.svg', rounded.length, 'B | apple-touch-icon.png', png(square,180).length, 'B | favicon.ico', offset, 'B');
