// Neon Bhairav: a cyberpunk Indian city at night. Temple spires among towers, neon, rain, flying cars.
import { W, H, rng, gradient, layer, rect, disc, wrap, osc } from '../px.js';

const R0 = rng(23);
const NEON = ['#ff3fb4', '#2ff3ff', '#ffb02e', '#b46bff', '#46ff8a'];

function shikhara(ctx, cx, base, w, h, body, line) {
  // Curvilinear temple tower: rows narrowing with a bulge, ribbed edges, amalaka disc and kalash on top.
  for (let y = 0; y < h; y++) {
    const u = y / h, half = Math.round((w / 2) * Math.sin(Math.PI * 0.5 * (1 - u)) ** 0.7);
    rect(ctx, cx - half, base - y, 2 * half + 1, 1, body);
    if (y % 5 === 0) rect(ctx, cx - half, base - y, 2 * half + 1, 1, '#2b1640');
    rect(ctx, cx - half, base - y, 1, 1, line); rect(ctx, cx + half, base - y, 1, 1, line);
  }
  rect(ctx, cx - 4, base - h - 2, 9, 2, line); rect(ctx, cx - 1, base - h - 6, 3, 4, '#ffd27a'); rect(ctx, cx, base - h - 10, 1, 4, '#ffd27a');
  rect(ctx, cx + 1, base - h - 10, 4, 2, '#ff6a3c');
}

function dome(ctx, cx, base, r, body, line) {
  for (let y = -r; y <= r; y++) { const w = Math.round(Math.sqrt(r * r - y * y) * (y < 0 ? 1 - (-y / r) * 0.35 : 1)); rect(ctx, cx - w, base - r + y, 2 * w + 1, 1, body); }
  rect(ctx, cx, base - 2 * r - 4, 1, 4, line); rect(ctx, cx - r, base, 2 * r + 1, 6, body);
}

function background(ctx) {
  const img = ctx.createImageData(W, H);
  gradient(img, 0, 170, [[0, '#06031a'], [0.45, '#1b0838'], [0.8, '#4a1052'], [1, '#8a2068']], 5);
  gradient(img, 170, H, [[0, '#140a26'], [1, '#07040f']], 4);
  ctx.putImageData(img, 0, 0);
  disc(ctx, 62, 38, 13, '#efe0ff'); disc(ctx, 66, 35, 3, '#d8c4f0'); disc(ctx, 57, 43, 2, '#d8c4f0');
  const r = R0;
  // Far towers with tiny lit windows.
  for (let x = 0; x < W;) {
    const w = 8 + Math.floor(r() * 16), h = 50 + Math.floor(r() * 70);
    rect(ctx, x, 175 - h, w, h, '#1c1036');
    for (let i = 0; i < w * h / 30; i++) rect(ctx, x + 1 + Math.floor(r() * (w - 2)), 177 - h + Math.floor(r() * (h - 4)), 1, 1, NEON[Math.floor(r() * 3)] + '99');
    if (r() < 0.3) rect(ctx, x + Math.floor(w / 2), 170 - h, 1, 6, '#ff3f6a');
    x += w + Math.floor(r() * 4);
  }
  // Temple spires and a dome in the middle distance, outlined in saffron neon.
  shikhara(ctx, 206, 182, 34, 74, '#241038', '#ff9a3c');
  shikhara(ctx, 236, 182, 20, 46, '#241038', '#ff9a3c');
  dome(ctx, 120, 176, 12, '#22103a', '#2ff3ff');
  // Near buildings with neon signs and vertical strips.
  for (let x = -4; x < W;) {
    const w = 18 + Math.floor(r() * 26), h = 30 + Math.floor(r() * 46);
    if (x + w > 182 && x < 252) { x += 6; continue; }       // keep the temple clear
    rect(ctx, x, 200 - h, w, h, '#110822');
    rect(ctx, x, 200 - h, w, 1, '#2a1440');
    for (let i = 0; i < w * h / 24; i++) rect(ctx, x + 1 + Math.floor(r() * (w - 2)), 202 - h + Math.floor(r() * (h - 4)), 1, 1, '#ffd27a55');
    const c = NEON[Math.floor(r() * NEON.length)];
    if (r() < 0.6) { const sw = Math.min(w - 4, 8 + Math.floor(r() * 10)); rect(ctx, x + 2, 204 - h, sw, 5, c); rect(ctx, x + 3, 205 - h, sw - 2, 3, '#110822'); for (let i = 0; i < sw - 4; i += 2) rect(ctx, x + 4 + i, 206 - h, 1, 1, c); }
    else rect(ctx, x + w - 3, 206 - h, 1, Math.min(24, h - 8), c);
    x += w + 2;
  }
  // Wet street with smeared reflections.
  rect(ctx, 0, 200, W, 1, '#3a1c52');
  for (let x = 0; x < W; x += 3) if (r() < 0.6) rect(ctx, x, 202 + Math.floor(r() * 10), 1 + Math.floor(r() * 2), 1, NEON[Math.floor(r() * NEON.length)] + '66');
}

const R = rng(41);
const STARS = Array.from({ length: 50 }, () => ({ x: Math.floor(R() * W), y: Math.floor(R() * 80), k: 1 + Math.floor(R() * 5), ph: R() }));
const BLINK = Array.from({ length: 40 }, () => ({ x: Math.floor(R() * W), y: 60 + Math.floor(R() * 110), k: 2 + Math.floor(R() * 6), ph: R(), c: NEON[Math.floor(R() * NEON.length)] }));
const CARS = Array.from({ length: 9 }, (_, i) => ({ lane: [62, 84, 104][i % 3], dir: i % 2 ? -1 : 1, k: 1 + (i % 3), ph: R(), body: ['#d03a7a', '#3ad0e0', '#e0a03a', '#9a5ad8'][i % 4] }));
const RAIN = Array.from({ length: 140 }, () => ({ x: Math.floor(R() * (W + 60)), y: Math.floor(R() * H), n: 30 + Math.floor(R() * 20) }));

export function drawNeonBhairav(ctx, t, frame) {
  ctx.drawImage(layer('neon-bhairav', background), 0, 0);
  for (const s of STARS) if (osc(t, s.k * 3, s.ph) > -0.2) rect(ctx, s.x, s.y, 1, 1, '#cbb8ff');
  for (const b of BLINK) if (osc(t, b.k * 5, b.ph) > 0.3) rect(ctx, b.x, b.y, 1, 1, b.c);
  // Hologram billboard cycling colours with a rolling scanline.
  const hc = ['#ff3fb4', '#2ff3ff', '#b46bff', '#ffb02e'][Math.floor(wrap(t * 12, 4))];
  rect(ctx, 300, 70, 34, 20, hc + '55'); rect(ctx, 300, 70, 34, 1, hc); rect(ctx, 300, 89, 34, 1, hc);
  rect(ctx, 300, 70 + Math.floor(wrap(frame / 2, 20)), 34, 1, hc);
  rect(ctx, 308, 75, 18, 3, hc); rect(ctx, 312, 81, 10, 3, hc);
  // Flying cars with underglow and light trails.
  for (const c of CARS) {
    const L = W + 30, d = wrap((c.ph + t * c.k) * L, L) - 15, x = c.dir > 0 ? d : W - d, y = c.lane + osc(t, 4, c.ph) * 1.5;
    for (let i = 1; i <= 10; i++) rect(ctx, x - c.dir * (i + 4), y + 1, 1, 1, `rgba(255,${c.dir > 0 ? 80 : 220},${c.dir > 0 ? 120 : 255},${0.5 - i * 0.045})`);
    rect(ctx, x - 4, y, 9, 3, c.body); rect(ctx, x - 1, y - 1, 4, 1, '#9ef6ff');
    rect(ctx, x + (c.dir > 0 ? 4 : -4), y + 1, 1, 1, '#ffffff'); rect(ctx, x - 3, y + 3, 7, 1, '#ff3fb488');
  }
  // Rain: each drop falls a whole number of screen heights per loop.
  ctx.fillStyle = 'rgba(150,170,255,0.35)';
  for (const d of RAIN) {
    const y = wrap(d.y + t * d.n * H, H), x = wrap(d.x - (y * 0.3), W + 60) - 30;
    ctx.fillRect(Math.round(x), Math.round(y), 1, 3);
  }
  // A neon sign that sputters now and then.
  if (osc(t, 37, 0.1) > -0.92) { rect(ctx, 150, 128, 22, 1, '#46ff8a'); rect(ctx, 150, 134, 22, 1, '#46ff8a'); rect(ctx, 150, 128, 1, 7, '#46ff8a'); rect(ctx, 171, 128, 1, 7, '#46ff8a'); rect(ctx, 154, 131, 14, 1, '#46ff8a'); }
}
