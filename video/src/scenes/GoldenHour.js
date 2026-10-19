// Golden Hour: a riverside promenade at sunset, people strolling, birds heading home.
import { W, H, rng, gradient, layer, rect, disc, wrap, osc, person } from '../px.js';

const HZ = 120;           // horizon (far bank)
const SUN = [296, HZ - 3];
const WALK = 186;         // feet of the near lane; far lane at 181

function background(ctx) {
  const img = ctx.createImageData(W, H);
  gradient(img, 0, HZ, [[0, '#231c4d'], [0.42, '#6e3a6c'], [0.72, '#d9705c'], [1, '#ffc56a']], 5);
  gradient(img, HZ, 170, [[0, '#f0a060'], [0.18, '#a5566a'], [0.6, '#4a2c55'], [1, '#2a1f45']], 5);
  ctx.putImageData(img, 0, 0);
  ctx.save(); ctx.beginPath(); ctx.rect(0, 0, W, HZ); ctx.clip();   // the sun sets behind the far bank
  disc(ctx, SUN[0], SUN[1], 15, '#ffd98c');
  disc(ctx, SUN[0], SUN[1], 11, '#fff0c4');
  ctx.restore();
  // Far bank: low skyline and trees, a dark ribbon on the horizon.
  const r = rng(11);
  for (let x = 0; x < W;) {
    const w = 4 + Math.floor(r() * 12), h = r() < 0.4 ? 3 + Math.floor(r() * 4) : 5 + Math.floor(r() * 12);
    rect(ctx, x, HZ - h, w, h + 2, '#3a2140');
    if (h > 9 && r() < 0.5) for (let i = 0; i < 3; i++) rect(ctx, x + 1 + Math.floor(r() * (w - 2)), HZ - h + 2 + Math.floor(r() * (h - 3)), 1, 1, '#ffcf7a');
    x += w;
  }
  for (let x = 0; x < W; x += 1) if (r() < 0.25) rect(ctx, x, HZ - 2 - Math.floor(r() * 3), 2, 3, '#2e1b38');
  // Promenade wall, railing, walkway, lamps.
  rect(ctx, 0, 168, W, 6, '#3c2440'); rect(ctx, 0, 168, W, 1, '#7a4a5c');
  rect(ctx, 0, 174, W, 18, '#5a3c50');
  for (let x = 0; x < W; x += 8) rect(ctx, x, 174, 1, 18, '#4d3346');
  rect(ctx, 0, 174, W, 1, '#8a5b66');
  rect(ctx, 0, 160, W, 1, '#2a1830');
  for (let x = 4; x < W; x += 12) rect(ctx, x, 160, 1, 8, '#2a1830');
  for (const lx of [36, 132, 228, 324]) {
    rect(ctx, lx, 140, 2, 34, '#24152c'); rect(ctx, lx - 2, 138, 6, 3, '#24152c');
    rect(ctx, lx - 1, 141, 4, 2, '#ffe2a0');
  }
  // Foreground grass, a bench with someone watching the sun.
  rect(ctx, 0, 192, W, H - 192, '#26172c');
  for (let x = 0; x < W; x++) if (r() < 0.5) rect(ctx, x, 191 - Math.floor(r() * 3), 1, 3, '#2f1c35');
  for (let i = 0; i < 40; i++) rect(ctx, Math.floor(r() * W), 196 + Math.floor(r() * 18), 1, 1, ['#e8738a', '#f2c46c', '#c98ad8'][i % 3]);
  rect(ctx, 182, 182, 22, 2, '#3a2230'); rect(ctx, 182, 176, 22, 1, '#3a2230');
  rect(ctx, 184, 184, 1, 5, '#2a1822'); rect(ctx, 201, 184, 1, 5, '#2a1822');
  rect(ctx, 190, 172, 4, 2, '#1e1218'); rect(ctx, 190, 174, 4, 8, '#7a4d6a'); rect(ctx, 189, 171, 6, 2, '#1e1218');
}

const R = rng(5);
const CLOUDS = Array.from({ length: 5 }, (_, i) => ({ y: 18 + i * 13 + Math.floor(R() * 6), len: 40 + Math.floor(R() * 50), ph: R(), col: ['#a0507a', '#c86a74', '#e88c70', '#f4a874', '#ffd08a'][i] }));
const WALKERS = Array.from({ length: 8 }, (_, i) => ({
  dir: i % 2 ? -1 : 1, k: i % 3 === 0 ? 2 : 1, ph: R(), lane: i % 2 ? 181 : WALK,
  look: { skin: ['#c98f6b', '#8d5a3b', '#e0b08a', '#6b4330'][i % 4], hair: ['#1f140f', '#4a2a18', '#d8c070', '#1a1010'][(i + 1) % 4],
    top: ['#a84a5c', '#3d6a8a', '#d89a3c', '#5d8a5a', '#8a5aa8', '#c46a3a', '#3a3a6a', '#b0b0c0'][i], legs: ['#2d2440', '#3a3050', '#2a2a38'][i % 3] },
}));
const BIRDS = Array.from({ length: 4 }, (_, i) => ({ y: 34 + i * 9, ph: R(), k: 1 + (i % 2) }));
const SPARKS = Array.from({ length: 60 }, () => ({ x: Math.floor(R() * W), y: HZ + 4 + Math.floor(R() * 44), k: 1 + Math.floor(R() * 4), ph: R() }));

export function drawGoldenHour(ctx, t, frame) {
  ctx.drawImage(layer('golden-hour', background), 0, 0);
  // Clouds drift right, one full lap per loop.
  for (const c of CLOUDS) {
    const L = W + c.len, x = wrap((c.ph + t) * L, L) - c.len;
    rect(ctx, x, c.y, c.len, 2, c.col); rect(ctx, x + 6, c.y - 1, c.len - 14, 1, c.col); rect(ctx, x + 10, c.y + 2, c.len - 24, 1, c.col);
  }
  // Sun glitter on the water and soft sparkles.
  for (let y = HZ + 2; y < 166; y += 2) {
    const d = y - HZ, w = Math.max(1, (16 - d * 0.22) * (0.55 + 0.45 * osc(t, 3 + (y % 5), y * 0.37)));
    rect(ctx, SUN[0] - w / 2 + osc(t, 2, y * 0.11) * 2, y, Math.round(w), 1, d < 20 ? '#ffe7a8' : '#f2b07a');
  }
  for (const s of SPARKS) if (osc(t, s.k * 7, s.ph) > 0.75) rect(ctx, s.x, s.y, 2, 1, '#f6c08a');
  // Birds heading home, flapping.
  for (const b of BIRDS) {
    const L = W + 20, x = W + 10 - wrap((b.ph + t * b.k) * L, L), up = Math.floor(frame / 6) % 2;
    rect(ctx, x, b.y, 1, 1, '#2a1830'); rect(ctx, x - 2, b.y - up, 2, 1, '#2a1830'); rect(ctx, x + 1, b.y - up, 2, 1, '#2a1830');
  }
  // Strollers on two lanes (far lane first).
  const step = Math.floor(frame / 6) % 4;
  for (const w of [...WALKERS].sort((a, b) => a.lane - b.lane)) {
    const L = W + 16, d = wrap((w.ph + t * w.k) * L, L) - 8;
    person(ctx, w.dir > 0 ? d : W - d, w.lane, (step + Math.floor(w.ph * 4)) % 4, w.look, w.dir);
  }
  // Lamp glow breathing a little.
  for (const lx of [36, 132, 228, 324]) {
    const a = 0.16 + 0.05 * osc(t, 5, lx / 100);
    for (const [r, k] of [[7, 0.5], [4, 1]]) { ctx.fillStyle = `rgba(255,214,140,${a * k})`; for (let y = -r; y <= r; y++) { const w = Math.round(Math.sqrt(r * r - y * y)); ctx.fillRect(lx + 1 - w, 142 + y, 2 * w, 1); } }
  }
}
