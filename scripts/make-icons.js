// Generates the app icons as real PNGs, with no image libraries.
// Run with: npm run icons
import zlib from 'node:zlib';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const OUT = path.join(path.dirname(fileURLToPath(import.meta.url)), '..', 'public', 'icons');
fs.mkdirSync(OUT, { recursive: true });

/* ---- tiny PNG encoder (8-bit RGBA) ---- */

const CRC_TABLE = (() => {
  const t = new Int32Array(256);
  for (let n = 0; n < 256; n++) {
    let c = n;
    for (let k = 0; k < 8; k++) c = c & 1 ? 0xedb88320 ^ (c >>> 1) : c >>> 1;
    t[n] = c;
  }
  return t;
})();

function crc32(buf) {
  let c = -1;
  for (let i = 0; i < buf.length; i++) c = CRC_TABLE[(c ^ buf[i]) & 0xff] ^ (c >>> 8);
  return (c ^ -1) >>> 0;
}

function chunk(type, data) {
  const len = Buffer.alloc(4);
  len.writeUInt32BE(data.length, 0);
  const body = Buffer.concat([Buffer.from(type, 'latin1'), data]);
  const crc = Buffer.alloc(4);
  crc.writeUInt32BE(crc32(body), 0);
  return Buffer.concat([len, body, crc]);
}

function encodePNG(width, height, rgba) {
  const ihdr = Buffer.alloc(13);
  ihdr.writeUInt32BE(width, 0);
  ihdr.writeUInt32BE(height, 4);
  ihdr[8] = 8; // bit depth
  ihdr[9] = 6; // truecolour + alpha
  ihdr[10] = 0;
  ihdr[11] = 0;
  ihdr[12] = 0;

  const stride = width * 4;
  const raw = Buffer.alloc((stride + 1) * height);
  for (let y = 0; y < height; y++) {
    raw[y * (stride + 1)] = 0; // filter: none
    rgba.copy(raw, y * (stride + 1) + 1, y * stride, (y + 1) * stride);
  }

  return Buffer.concat([
    Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]),
    chunk('IHDR', ihdr),
    chunk('IDAT', zlib.deflateSync(raw, { level: 9 })),
    chunk('IEND', Buffer.alloc(0))
  ]);
}

/* ---- artwork ---- */

const STOPS = [
  { at: 0.0, c: [0x5b, 0x4d, 0xf0] },
  { at: 0.5, c: [0xa8, 0x63, 0xf0] },
  { at: 1.0, c: [0xf0, 0x6c, 0x9b] }
];

function gradientAt(t) {
  const x = Math.min(1, Math.max(0, t));
  for (let i = 1; i < STOPS.length; i++) {
    if (x <= STOPS[i].at) {
      const a = STOPS[i - 1];
      const b = STOPS[i];
      const k = (x - a.at) / (b.at - a.at);
      return [
        Math.round(a.c[0] + (b.c[0] - a.c[0]) * k),
        Math.round(a.c[1] + (b.c[1] - a.c[1]) * k),
        Math.round(a.c[2] + (b.c[2] - a.c[2]) * k)
      ];
    }
  }
  return STOPS[STOPS.length - 1].c;
}

/** Coverage of a rounded rectangle at a pixel, anti-aliased by supersampling. */
function roundedRectCoverage(px, py, x, y, w, h, r) {
  let hits = 0;
  const S = 3;
  for (let sy = 0; sy < S; sy++) {
    for (let sx = 0; sx < S; sx++) {
      const cx = px + (sx + 0.5) / S;
      const cy = py + (sy + 0.5) / S;
      if (cx < x || cx > x + w || cy < y || cy > y + h) continue;
      const dx = Math.max(x + r - cx, 0, cx - (x + w - r));
      const dy = Math.max(y + r - cy, 0, cy - (y + h - r));
      if (dx * dx + dy * dy <= r * r) hits++;
    }
  }
  return hits / (S * S);
}

function drawIcon(size) {
  const buf = Buffer.alloc(size * size * 4);

  // Bars: a stylised stack of headlines.
  const barX = size * 0.215;
  const barW = [0.57, 0.44, 0.3].map((f) => size * f);
  const barH = size * 0.072;
  const gap = size * 0.108;
  const firstY = size * 0.315;
  const barR = barH / 2;

  for (let y = 0; y < size; y++) {
    for (let x = 0; x < size; x++) {
      const i = (y * size + x) * 4;

      // Diagonal gradient background, full bleed so it works as a maskable icon.
      const t = (x / size) * 0.62 + (y / size) * 0.38;
      let [r, g, b] = gradientAt(t);

      // Soft highlight in the upper-left for a little depth.
      const dx = (x - size * 0.28) / (size * 0.75);
      const dy = (y - size * 0.2) / (size * 0.75);
      const glow = Math.max(0, 1 - Math.sqrt(dx * dx + dy * dy)) * 0.16;
      r = Math.min(255, r + 255 * glow);
      g = Math.min(255, g + 255 * glow);
      b = Math.min(255, b + 255 * glow);

      // White headline bars.
      let cover = 0;
      for (let k = 0; k < 3; k++) {
        cover = Math.max(
          cover,
          roundedRectCoverage(x, y, barX, firstY + k * gap, barW[k], barH, barR)
        );
      }
      if (cover > 0) {
        r = r + (255 - r) * cover;
        g = g + (255 - g) * cover;
        b = b + (255 - b) * cover;
      }

      buf[i] = Math.round(r);
      buf[i + 1] = Math.round(g);
      buf[i + 2] = Math.round(b);
      buf[i + 3] = 255;
    }
  }
  return encodePNG(size, size, buf);
}

const SIZES = [
  [1024, 'icon-1024.png'],
  [512, 'icon-512.png'],
  [384, 'icon-384.png'],
  [192, 'icon-192.png'],
  [180, 'apple-touch-icon.png'],
  [167, 'icon-167.png'],
  [152, 'icon-152.png'],
  [120, 'icon-120.png']
];

for (const [size, name] of SIZES) {
  fs.writeFileSync(path.join(OUT, name), drawIcon(size));
  console.log(`  ${name.padEnd(22)} ${size}x${size}`);
}

// Scalable favicon for desktop browsers.
const svg = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 512 512">
  <defs><linearGradient id="g" x1="0" y1="0" x2="1" y2="1">
    <stop offset="0" stop-color="#5b4df0"/><stop offset=".5" stop-color="#a863f0"/><stop offset="1" stop-color="#f06c9b"/>
  </linearGradient></defs>
  <rect width="512" height="512" rx="112" fill="url(#g)"/>
  <g fill="#fff">
    <rect x="110" y="161" width="292" height="37" rx="18.5"/>
    <rect x="110" y="216" width="225" height="37" rx="18.5"/>
    <rect x="110" y="271" width="154" height="37" rx="18.5"/>
  </g>
</svg>
`;
fs.writeFileSync(path.join(OUT, 'favicon.svg'), svg);
console.log('  favicon.svg');
console.log(`\nIcons written to ${OUT}`);
