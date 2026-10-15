// Pahadi Winter: a cold morning in the northern hills (original composition).
// Render: node tools/render.mjs pieces/pahadi-winter.mjs --stems
// 62 BPM, raga Pahadi on D (Sa = D: D E F# A B, with G and the flat seventh C as colours).
// Harp plucks the tanpura cycle (Pa Sa Sa Sa), cellos hold the drone, flute plays bansuri lines with kan (grace) notes,
// high piano in double strokes stands in for the santoor, hand drums play a soft keherwa in Theme 2.
// Form: Alap 8 (free, drone) | Theme 16 | Bells 6 | Theme2 16 (clarinet, keherwa) | Alap2 8, plus ring-out

import { Session, TPB, rng } from '../tools/lib/session.mjs';
import { barChords, voice, human, melody, checkBars, drums } from '../tools/lib/music.mjs';

const THEME_H = ['D', 'D', 'Bm', 'A', 'G', 'D', 'A', 'A', 'Bm', 'D', 'G', 'D', 'C', 'G', 'Em A', 'D'];
// [note, grace] = kan swar: a quick touch of the grace note before the main note.
const ALAP = [
  [[null, 2], ['A4', 2]], [[['B4', 'C#5'], 1.5], ['A4', .5], ['F#4', 2]], [[['E4', 'F#4'], 3], ['F#4', 1]], [['D4', 4]],
  [[null, 1], ['F#4', 1], ['A4', 1], ['B4', 1]], [[['D5', 'E5'], 3], ['E5', 1]], [['D5', 1.5], ['B4', .5], [['A4', 'B4'], 2]], [['A4', 4]],
];
const THEME = [
  [['A4', 1], ['B4', .5], ['A4', .5], ['F#4', 1], ['E4', 1]], [[['D4', 'E4'], 2], ['E4', 1], ['F#4', 1]],
  [['A4', 1.5], ['B4', .5], ['D5', 1], ['B4', 1]], [[['A4', 'B4'], 4]],
  [['B4', 1], ['D5', .5], ['E5', .5], ['D5', 1], ['B4', 1]], [['A4', 1], ['F#4', 1], ['E4', 1], ['F#4', 1]],
  [['A4', 1], ['B4', .5], ['A4', .5], ['G4', 1], ['F#4', 1]], [[['E4', 'F#4'], 3], [null, 1]],
  [['D5', 1], ['E5', .5], ['D5', .5], ['B4', 1], ['A4', 1]], [['B4', 1], ['A4', .5], ['F#4', .5], ['A4', 2]],
  [['D5', 1.5], ['E5', .5], ['F#5', 1], ['E5', 1]], [[['D5', 'E5'], 4]],
  [['B4', 1], ['A4', .5], ['B4', .5], ['C5', 1], ['B4', 1]], [['A4', 1], ['F#4', 1], ['E4', 2]],
  [['F#4', 1], ['A4', .5], ['F#4', .5], ['E4', 1], ['F#4', 1]], [[['D4', 'E4'], 4]],
];
const HIGH = [ // flute, an octave up, answering in the second half of Theme 2
  [[null, 4]], [[null, 4]], [[null, 4]], [[null, 4]], [[null, 4]], [[null, 4]], [[null, 4]], [[null, 4]],
  [[null, 2], ['F#6', 2]], [['E6', 2], ['D6', 2]], [[null, 2], ['A6', 2]], [['F#6', 4]], [[null, 2], ['E6', 2]], [['D6', 2], ['B5', 2]], [['A5', 4]], [['D6', 4]],
];
[['alap', ALAP], ['theme', THEME], ['high', HIGH]].forEach(([n, b]) => checkBars(n, b));

const FORM = [['Alap', 8], ['Theme', 16], ['Bells', 6], ['Theme2', 16], ['Alap2', 8]];

export default function () {
  const s = new Session({ bpm: 62 });
  const BAR = s.bar, S16 = TPB / 4;
  const h = human(rng(62));
  const eq = (type, freq, gain = 0, q = 0.7) => ({ plugin: 'eq_1band', params: { type, freq, gain, q } });

  s.reverb('Hall', 'plate_reverb', { decay: 4.6, pre_delay: 45, damping: 8500, size: 95, low_cut: 220 });
  const tan = s.instrument('Tanpura', { zones: 'harp', sampler: { attack: 2, release: 2500, velocity: 40, level: 12 }, sends: { Hall: -6 }, volume: 8, pan: -0.2, inserts: [eq(2, 3000, 3)] });
  const vc = s.instrument('Cellos', { zones: 'cellos', sampler: { attack: 900, release: 1500, velocity: 40, level: 9 }, sends: { Hall: -6 }, volume: -6, pan: 0.2, inserts: [eq(3, 45)] });
  const va = s.instrument('Violas', { zones: 'violas', sampler: { attack: 900, release: 1500, velocity: 40, level: 8 }, sends: { Hall: -5 }, volume: -2, pan: 0.3, inserts: [eq(3, 120)] });
  const vn = s.instrument('Violins', { zones: 'violins', sampler: { attack: 1000, release: 1500, velocity: 40, level: 10 }, sends: { Hall: -4 }, volume: 0, pan: -0.3, inserts: [eq(3, 200)] });
  const fl = s.instrument('Bansuri', { zones: 'flute', sampler: { attack: 90, release: 600, velocity: 40, level: 6 }, sends: { Hall: -4 }, volume: -1, pan: -0.05 });
  const cl = s.instrument('Clarinet', { zones: 'clarinet', sampler: { attack: 70, release: 500, velocity: 40, level: 8 }, sends: { Hall: -5 }, volume: -5, pan: 0.1 });
  const san = s.instrument('Santoor', { zones: 'piano', sampler: { attack: 0.5, release: 900, velocity: 30 }, sends: { Hall: -6 }, volume: 4, pan: 0.15, inserts: [eq(3, 300), eq(2, 4000, 5)] });
  const bell = s.instrument('Bells', { zones: 'glock', oneShot: true, sampler: { attack: 0.5, release: 2500, velocity: 50, level: 12 }, sends: { Hall: -2 }, volume: 8, pan: 0.4 });
  const perc = s.instrument('Perc', { zones: 'perc', oneShot: true, sampler: { attack: 0.5, release: 500, velocity: 60 }, sends: { Hall: -10 }, volume: -6, pan: 0.1 });
  s.master('eq_1band', { type: 0, freq: 450, gain: -2, q: 0.8 });
  s.master('eq_1band', { type: 2, freq: 3000, gain: 4 }); // mellow instruments: 4 kHz measured -14 with a 5 kHz shelf
  s.master('maximizer', { threshold: -0.5, ceiling: -1 });

  // Tanpura cycle each bar: Pa (A2) then Sa Sa (D3) then low Sa (D2), every string left to ring.
  const tanpura = (t0, vel) => [['A2', 0], ['D3', 1], ['D3', 2], ['D2', 3]].forEach(([n, b], k) => tan.note(n, t0 + b * TPB + h.t(10), 2 * BAR, vel + (k === 0 ? 4 : 0) + h.v(3)));
  const drone = (t0, vel) => { vc.note('D2', t0, BAR - 40, vel); vc.note('A2', t0 + 40, BAR - 80, vel - 6); }; // one bar per bow: samples run 6-12 s
  let vaV = null, vnV = null;
  const pads = (t0, chs, vel, violins = false) => {
    for (const { ch, at, beats } of chs) {
      vaV = voice(ch, 2, 57, 69, vaV);
      vaV.forEach(p => va.note(p, t0 + at * TPB + 30, beats * TPB - 60, vel));
      if (violins) { vnV = voice(ch, 1, 74, 86, vnV); vn.note(vnV[0], t0 + at * TPB + 60, beats * TPB - 80, vel - 6); }
    }
  };
  // Santoor: each chord tone struck twice in quick succession, wandering up and down in the high register.
  const santoor = (t0, chs, vel) => {
    for (const { ch, at, beats } of chs) {
      const v = voice(ch, 4, 74, 93);
      const path = [0, 1, 2, 3, 2, 1, 2, 3];
      for (let k = 0; k < beats * 2; k++) {
        const p = v[path[k % path.length]], t = t0 + at * TPB + k * 2 * S16;
        san.note(p, t + h.t(5), S16, vel + (k % 2 ? -6 : 0) + h.v(3));
        san.note(p, t + S16 + h.t(5), S16 * 2, vel - 10 + h.v(3));
      }
    }
  };
  // Keherwa (8 matras: Dha Ge Na Ti Na Ka Dhi Na) on tumba / conga / quinto, one cycle per bar in eighths.
  const keherwa = (t0, vel) => drums(perc, t0, { 41: 'X.x.....X.......', 43: 'x.......x.......', 45: '....x...x...x..o', 46: '......x.....x...' }, { vel, h, step: TPB / 4 });

  const sections = {};
  let bar = 0;
  for (const [name, len] of FORM) {
    sections[name] = [bar + 1, bar + len];
    for (let i = 0; i < len; i++) {
      const t0 = (bar + i) * BAR;
      const harm = name === 'Theme' || name === 'Theme2' ? THEME_H[i] : name === 'Bells' ? ['G', 'D', 'C', 'G', 'A', 'D'][i] : 'D';
      const chs = barChords(harm);
      switch (name) {
        case 'Alap': case 'Alap2': {
          const fade = name === 'Alap2' ? Math.max(0, i - 3) * 4 : 0;
          tanpura(t0, (name === 'Alap' ? 36 + Math.min(i, 4) * 2 : 44) - fade);
          drone(t0, (name === 'Alap' ? 36 + i * 2 : 48) - fade);
          if (name === 'Alap2' && i < 6) pads(t0, chs, 46 - i * 3);
          if (i === 0 && name === 'Alap') bell.note('A6', t0 + 2 * TPB, 2 * BAR, 46);
          break;
        }
        case 'Theme':
          tanpura(t0, 44);
          drone(t0, 48);
          if (i >= 2) pads(t0, chs, 40 + Math.min(i - 2, 6) * 2);
          santoor(t0, chs, i < 4 ? 34 + i * 3 : 46);
          break;
        case 'Bells':
          tanpura(t0, 46);
          drone(t0, 52);
          pads(t0, chs, 60, true); // the interlude carries itself: fuller strings, bells over them
          [[0, 'D6'], [1.5, 'A6'], [3, 'F#6']].forEach(([b, n], k) => { if ((i + k) % 2 === 0) bell.note(n, t0 + b * TPB + h.t(10), 2 * BAR, 48 + h.v()); });
          if (i % 3 === 0) perc.note(61, t0 + TPB, BAR, 50);
          break;
        case 'Theme2':
          tanpura(t0, 44);
          drone(t0, 50);
          pads(t0, chs, 50, i >= 8);
          if (i >= 2) keherwa(t0, i < 4 ? 50 + (i - 2) * 8 : 66);
          if (i >= 8) santoor(t0, chs, 40);
          break;
      }
    }
    const t0 = bar * BAR;
    if (name === 'Alap') melody(fl, t0, ALAP, 66, { h, lift: 0.3, legato: 20, grace: 90 });
    if (name === 'Theme') melody(fl, t0, THEME, 70, { h, lift: 0.4, legato: 20, grace: 90 });
    if (name === 'Theme2') { melody(cl, t0, THEME, 70, { h, lift: 0.3, legato: 20, grace: 90 }); melody(fl, t0, HIGH, 58, { h, lift: 0.1, legato: 20 }); }
    if (name === 'Alap2') melody(fl, t0, ALAP.slice(0, 4).concat([[[null, 4]], [['A4', 4]], [[['D4', 'E4'], 4]], [[null, 4]]]), 56, { h, lift: 0.3, legato: 20, grace: 90 });
    bar += len;
  }
  return { session: s, endTicks: (bar + 2) * BAR, sections };
}
