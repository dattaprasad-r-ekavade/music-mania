// Pahadi Winter: a Himalayan ridge at dawn. Snow peaks, drifting fog, hikers, prayer flags, falling snow.
import { W, H, rng, gradient, layer, rect, disc, wrap, osc, person } from '../px.js';

// Ridge the hikers walk on: gentle and periodic in x so the path wraps cleanly.
const ridge = x => 176 - 6 * Math.sin(2 * Math.PI * x / W) - 3 * Math.sin(4 * Math.PI * x / W + 1);

function range(seed, base, rough, n) {
  // Midpoint-displacement mountain profile across the width.
  const r = rng(seed), pts = new Array(n + 1).fill(0).map(() => base);
  const go = (a, b, d) => { if (b - a < 2) return; const m = (a + b) >> 1; pts[m] = (pts[a] + pts[b]) / 2 + (r() - 0.5) * d; go(a, m, d * 0.55); go(m, b, d * 0.55); };
  pts[0] = base + (r() - 0.5) * rough; pts[n] = base + (r() - 0.5) * rough; go(0, n, rough * 2);
  return x => { const u = Math.min(n, Math.max(0, x / W * n)), i = Math.min(n - 1, Math.floor(u)); return pts[i] + (pts[i + 1] - pts[i]) * (u - i); };
}

function mountains(ctx, prof, color, snow, snowDepth, peakAbove) {
  for (let x = 0; x < W; x++) {
    const top = Math.round(prof(x));
    rect(ctx, x, top, 1, H - top, color);
    if (top < peakAbove) rect(ctx, x, top, 1, Math.max(1, Math.round((peakAbove - top) * snowDepth)), snow);
  }
}

function pine(ctx, x, base, h, c, snow) {
  for (let y = 0; y < h; y++) { const w = Math.floor((y / h) * (h / 2.6)); rect(ctx, x - w, base - h + y, 2 * w + 1, 1, c); if (y % 3 === 1) rect(ctx, x - w, base - h + y, 1, 1, snow); }
  rect(ctx, x, base, 1, 2, '#3a2a2a');
}

function background(ctx) {
  const img = ctx.createImageData(W, H);
  gradient(img, 0, 140, [[0, '#2e3f72'], [0.45, '#6f86bb'], [0.8, '#d9b7b8'], [1, '#f6d6bd']], 5);
  ctx.putImageData(img, 0, 0);
  disc(ctx, 286, 104, 9, '#fff0d8'); disc(ctx, 286, 104, 6, '#ffffff');
  mountains(ctx, range(3, 92, 60, 64), '#9cb0d4', '#eef3ff', 0.45, 84);
  mountains(ctx, range(9, 112, 46, 48), '#7f93bd', '#e3eaf8', 0.4, 102);
  const mid = range(17, 138, 30, 40);
  mountains(ctx, mid, '#5e7099', '#d4ddef', 0.4, 132);
  const r = rng(29);
  for (let i = 0; i < 70; i++) { const x = Math.floor(r() * W); pine(ctx, x, Math.round(mid(x)) + 10 + Math.floor(r() * 18), 7 + Math.floor(r() * 7), '#33415f', '#c8d4ea'); }
  // Snowy foreground ridge with the trail.
  for (let x = 0; x < W; x++) { const y = Math.round(ridge(x)); rect(ctx, x, y, 1, H - y, '#e9eff9'); rect(ctx, x, y, 1, 1, '#ffffff'); rect(ctx, x, y + 3, 1, 1, '#cfd8ea'); }
  for (let i = 0; i < 14; i++) { const x = Math.floor(r() * W), y = Math.round(ridge(x)) + 6 + Math.floor(r() * 24); rect(ctx, x, y, 4, 2, '#7a8296'); rect(ctx, x + 1, y - 1, 2, 1, '#9aa2b6'); }
  for (let i = 0; i < 6; i++) { const x = 8 + Math.floor(r() * 368); pine(ctx, x, Math.round(ridge(x)) + 14 + Math.floor(r() * 12), 14 + Math.floor(r() * 8), '#24304a', '#ffffff'); }
  // Prayer flag poles.
  rect(ctx, 44, 150, 1, 28, '#4a3a30'); rect(ctx, 150, 140, 1, 34, '#4a3a30');
}

// Fog strip: horizontally periodic noise so it can scroll forever.
function fogLayer(ctx) {
  const img = ctx.createImageData(W, H), r = rng(77), ph = Array.from({ length: 6 }, () => r() * 6.28);
  for (const [cy, th, a] of [[128, 10, 0.55], [150, 8, 0.45], [196, 12, 0.5]]) {
    for (let x = 0; x < W; x++) {
      const n = ph.reduce((s, p, i) => s + Math.sin(2 * Math.PI * (i + 1) * x / W + p + cy) / (i + 1), 0);
      const top = cy + n * 3, bot = top + th + n * 2;
      for (let y = Math.floor(top); y < bot; y++) { const o = (y * W + x) * 4; const edge = Math.min(y - top, bot - y) / 3; img.data[o] = 236; img.data[o + 1] = 240; img.data[o + 2] = 250; img.data[o + 3] = Math.max(img.data[o + 3], 255 * a * Math.min(1, edge)); }
    }
  }
  ctx.putImageData(img, 0, 0);
}

const R = rng(53);
const SNOW = Array.from({ length: 160 }, () => ({ x: Math.floor(R() * W), y: Math.floor(R() * H), n: 2 + Math.floor(R() * 3), k: 1 + Math.floor(R() * 3), ph: R(), big: R() < 0.2 }));
const HIKERS = [
  { off: 0, look: { top: '#c8402e', pack: '#e8a03a', legs: '#2c2c3c', hair: '#3a2a20', skin: '#c49070' } },
  { off: 13, look: { top: '#2e6ac8', pack: '#4a4a5a', legs: '#2c2c3c', hair: '#1a1410', skin: '#a07050' } },
  { off: 27, look: { top: '#e8a03a', pack: '#c8402e', legs: '#3a3a4a', hair: '#d0b070', skin: '#d8b090' } },
];
const FLAGS = ['#2e6ac8', '#f2f2f2', '#d8382e', '#2e9a4a', '#f2c83a'];

export function drawPahadiWinter(ctx, t, frame) {
  ctx.drawImage(layer('pahadi-winter', background), 0, 0);
  // A bird circling high over the valley.
  const bx = 120 + 40 * Math.cos(2 * Math.PI * t * 2), by = 52 + 10 * Math.sin(2 * Math.PI * t * 2), up = Math.floor(frame / 10) % 2;
  rect(ctx, bx, by, 1, 1, '#3a3450'); rect(ctx, bx - 3, by - up, 3, 1, '#3a3450'); rect(ctx, bx + 1, by - up, 3, 1, '#3a3450');
  // Hikers trudging right along the ridge, one lap per loop.
  const step = Math.floor(frame / 9) % 4, L = W + 50;
  for (const h of HIKERS) {
    const x = wrap(t * L - h.off, L) - 20;
    person(ctx, x, ridge(x + 2) + 1, (step + h.off) % 4, { ...h.look, h: 12 }, 1);
    rect(ctx, x + 5, ridge(x + 2) - 7, 1, 8, '#6a5040');   // trekking pole
  }
  // Prayer flags fluttering on a sagging line.
  for (let i = 0; i < 18; i++) {
    const u = i / 17, x = 46 + u * 102, y = 152 + (140 - 152) * u + 10 * Math.sin(Math.PI * u) + osc(t, 15, i * 0.17) * 1.2;
    rect(ctx, x, y, 1, 1, '#6a5a50'); rect(ctx, x, y + 1, 4, 4 + Math.round(osc(t, 15, i * 0.17 + 0.25)), FLAGS[i % 5]);
  }
  // Fog drifting left, tiled.
  const fog = layer('pahadi-fog', fogLayer), dx = -wrap(t * W, W);
  ctx.drawImage(fog, Math.round(dx), 0); ctx.drawImage(fog, Math.round(dx) + W, 0);
  // Falling snow, swaying.
  for (const s of SNOW) {
    const y = wrap(s.y + t * s.n * H, H), x = wrap(s.x + osc(t, s.k * 4, s.ph) * 4, W);
    rect(ctx, x, y, s.big ? 2 : 1, s.big ? 2 : 1, '#ffffff');
  }
}
