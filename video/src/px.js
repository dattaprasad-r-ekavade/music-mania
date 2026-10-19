// Pixel-art helpers. Scenes draw on a W x H canvas that is scaled up with nearest-neighbour.
// Everything that moves is periodic in the loop phase t (0..1): use osc() with integer k and wrap() with
// whole-period distances, so the last frame flows into the first and the loop is seamless.

export const W = 384, H = 216;

// Seeded RNG (same generator as tools/lib/session.mjs) so every render is identical.
export function rng(seed) {
  return () => {
    seed |= 0; seed = (seed + 0x6d2b79f5) | 0;
    let t = Math.imul(seed ^ (seed >>> 15), 1 | seed);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

export const hex = h => [1, 3, 5].map(i => parseInt(h.slice(i, i + 2), 16));
export const mix = (a, b, t) => a.map((v, i) => Math.round(v + (b[i] - v) * t));
export const css = (c, a = 1) => a === 1 ? `rgb(${c[0]},${c[1]},${c[2]})` : `rgba(${c[0]},${c[1]},${c[2]},${a})`;
export const wrap = (v, m) => ((v % m) + m) % m;
export const osc = (t, k, ph = 0) => Math.sin(2 * Math.PI * (k * t + ph)); // k integer: loops cleanly

export function rect(ctx, x, y, w, h, c) { ctx.fillStyle = c; ctx.fillRect(Math.round(x), Math.round(y), w, h); }
export function disc(ctx, cx, cy, r, c) {
  ctx.fillStyle = c;
  for (let y = -r; y <= r; y++) { const w = Math.round(Math.sqrt(r * r - y * y)); ctx.fillRect(Math.round(cx - w), Math.round(cy + y), 2 * w + 1, 1); }
}

// Vertical gradient with ordered (Bayer) dithering between `levels` steps per stop: the pixel-art sky look.
const BAYER = [[0, 8, 2, 10], [12, 4, 14, 6], [3, 11, 1, 9], [15, 7, 13, 5]];
export function gradient(img, y0, y1, stops, levels = 6, x0 = 0, x1 = W) {
  const cs = stops.map(([p, h]) => [p, hex(h)]);
  const at = u => {
    let i = 0;
    while (i < cs.length - 2 && u > cs[i + 1][0]) i++;
    const [p0, c0] = cs[i], [p1, c1] = cs[i + 1];
    return mix(c0, c1, Math.min(1, Math.max(0, (u - p0) / (p1 - p0 || 1))));
  };
  for (let y = Math.max(0, y0); y < Math.min(H, y1); y++) {
    const u = (y - y0) / (y1 - y0) * levels * (cs.length - 1);
    for (let x = x0; x < x1; x++) {
      const base = Math.floor(u), q = base + ((u - base) > (BAYER[y % 4][x % 4] + 0.5) / 16 ? 1 : 0);
      const c = at(q / (levels * (cs.length - 1)));
      const o = (y * W + x) * 4;
      img.data[o] = c[0]; img.data[o + 1] = c[1]; img.data[o + 2] = c[2]; img.data[o + 3] = 255;
    }
  }
}

// Static layers are drawn once per browser tab and reused for every frame.
const cache = new Map();
export function layer(key, draw) {
  if (!cache.has(key)) {
    const c = document.createElement('canvas'); c.width = W; c.height = H;
    const ctx = c.getContext('2d'); ctx.imageSmoothingEnabled = false;
    draw(ctx); cache.set(key, c);
  }
  return cache.get(key);
}

// A 5 x 12 walker seen side-on. step 0..3 is the walk cycle; dir 1 faces right.
export function person(ctx, x, feetY, step, { skin = '#c98f6b', hair = '#2a1a14', top = '#8a4f7d', legs = '#2d2440', pack = null, h = 12 } = {}, dir = 1) {
  const X = Math.round(x), Y = Math.round(feetY) - h;
  const p = (dx, dy, w, hh, c) => rect(ctx, X + (dir > 0 ? dx : 4 - dx - w + 1), Y + dy, w, hh, c);
  p(1, 0, 3, 1, hair); p(1, 1, 3, 2, skin); p(dir > 0 ? 3 : 1, 1, 1, 1, hair === skin ? skin : skin);
  p(1, 3, 3, 5, top);
  if (pack) p(0, 3, 1, 4, pack);
  const swing = step % 2 === 0;
  p(swing ? 4 : 0, 4, 1, 3, top);                         // arm
  if (swing) { p(1, 8, 1, 4, legs); p(3, 8, 1, 4, legs); } else p(2, 8, 1, 4, legs);
  p(swing ? 4 : 1, 11, 1, 1, '#1a1220');                  // a foot forward
}
