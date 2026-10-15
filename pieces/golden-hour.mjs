// Golden Hour: hotel-lobby piece for piano, strings, flute and harp (original composition).
// Render: node tools/render.mjs pieces/golden-hour.mjs
// 76 BPM, Eb major, 84 bars (about 4:25) plus 2 bars of ring-out.
// Form: Intro 4 | A1 16 piano alone | A2 16 strings and harp join | B 16 violins lead |
//       C 8 flute over the A harmony | A3 16 piano an octave up, full strings | Outro 8

import { Session, TPB, midi, rng } from '../tools/lib/session.mjs';

// ---------- Harmony helpers ----------
const PCN = { C: 0, D: 2, E: 4, F: 5, G: 7, A: 9, B: 11 };
const pc = s => (PCN[s[0]] + (s[1] === '#' ? 1 : s[1] === 'b' ? -1 : 0) + 12) % 12;
const QUAL = { '': [0, 4, 7], m: [0, 3, 7], 7: [0, 4, 7, 10], m7: [0, 3, 7, 10], maj7: [0, 4, 7, 11], '7sus': [0, 5, 7, 10] };
function chord(sym) {
  const [main, slash] = sym.split('/');
  const m = /^([A-G][b#]?)(.*)$/.exec(main);
  const q = QUAL[m[2]];
  if (!q) throw new Error(`unknown chord ${sym}`);
  const root = pc(m[1]);
  const third = q.find(i => i === 3 || i === 4);
  return { sym, tones: q.map(i => (root + i) % 12), third: third == null ? null : (root + third) % 12, seventh: q.length > 3 ? (root + q[3]) % 12 : null, bass: slash ? pc(slash) : root };
}
// A bar's harmony: 'Eb' (whole bar) or 'Fm7 Bb7' (two beats each).
const barChords = s => { const p = s.split(' '); return p.map((c, i) => ({ ch: chord(c), at: i * 4 / p.length, beats: 4 / p.length })); };

function* combos(a, n, start = 0, acc = []) {
  if (acc.length === n) { yield acc; return; }
  for (let i = start; i < a.length; i++) yield* combos(a, n, i + 1, [...acc, a[i]]);
}
// n chord tones in [lo, hi], moving as little as possible from the previous voicing.
function voice(ch, n, lo, hi, prev) {
  const cands = [];
  for (let p = lo; p <= hi; p++) if (ch.tones.includes(p % 12)) cands.push(p);
  let best = null;
  for (const c of combos(cands, n)) {
    const pcs = new Set(c.map(p => p % 12));
    let cost = (n - pcs.size) * 2;
    if (ch.third != null && !pcs.has(ch.third)) cost += 8;
    if (ch.seventh != null && n >= 3 && !pcs.has(ch.seventh)) cost += 3;
    for (let i = 1; i < c.length; i++) if (c[i] - c[i - 1] < 3) cost += 1.5;
    cost += prev ? c.reduce((s, p, i) => s + Math.abs(p - prev[Math.min(i, prev.length - 1)]), 0) * 0.5
                 : Math.abs(c.reduce((s, p) => s + p, 0) / n - (lo + hi) / 2) * 0.3;
    if (!best || cost < best.cost) best = { c, cost };
  }
  return best.c;
}
function bassNote(ch, lo, hi, prev) {
  let best = null;
  for (let p = lo; p <= hi; p++) if (p % 12 === ch.bass) {
    const d = prev == null ? Math.abs(p - (lo + hi) / 2) : Math.abs(p - prev);
    if (best == null || d < best.d) best = { p, d };
  }
  return best.p;
}

// ---------- The music ----------
const H = {
  intro: ['Ebmaj7', 'Abmaj7', 'Ebmaj7', 'Bb7sus'],
  A: ['Eb', 'Bb/D', 'Cm', 'Ab', 'Eb/G', 'Ab', 'Fm7', 'Bb7', 'Eb', 'Bb/D', 'Cm', 'Gm/Bb', 'Ab', 'Eb/G', 'Fm7 Bb7', 'Eb'],
  B: ['Cm', 'Gm', 'Ab', 'Eb', 'Fm', 'Cm/Eb', 'Ab', 'Bb7', 'Ab', 'Bb', 'Gm', 'Cm', 'Fm7', 'Gm7', 'Abmaj7', 'Bb7sus Bb7'],
  outro: ['Ab', 'Eb/G', 'Fm7', 'Bb7sus', 'Ebmaj7', 'Abmaj7', 'Ebmaj7', 'Eb'],
};
// Melodies: one array per bar of [note or null, beats].
const M = {
  A: [
    [['Bb4', 2], ['G4', 1], ['Ab4', 1]], [['Bb4', 1.5], ['C5', 0.5], ['Bb4', 2]], [['G4', 2], ['Eb5', 1], ['D5', 1]], [['C5', 3], ['Bb4', 1]],
    [['Bb4', 2], ['G4', 1], ['Eb4', 1]], [['Ab4', 1.5], ['C5', 0.5], ['Eb5', 2]], [['Eb5', 1], ['C5', 1], ['Ab4', 1], ['F4', 1]], [['G4', 2], ['F4', 2]],
    [['Bb4', 2], ['G4', 1], ['Ab4', 1]], [['Bb4', 1.5], ['C5', 0.5], ['D5', 2]], [['Eb5', 2], ['G5', 1], ['F5', 1]], [['D5', 3], ['Bb4', 1]],
    [['C5', 2], ['Ab4', 1], ['C5', 1]], [['Bb4', 2], ['G4', 1], ['Bb4', 1]], [['Ab4', 1], ['G4', 1], ['F4', 1], ['D4', 1]], [['Eb4', 4]],
  ],
  B: [
    [['G4', 3], ['Ab4', 1]], [['Bb4', 2], ['D5', 2]], [['C5', 3], ['Bb4', 1]], [['G4', 4]],
    [['Ab4', 2], ['C5', 1], ['F5', 1]], [['Eb5', 2], ['D5', 1], ['C5', 1]], [['C5', 2], ['Bb4', 1], ['Ab4', 1]], [['Bb4', 4]],
    [['C5', 2], ['Eb5', 2]], [['D5', 2], ['F5', 2]], [['G5', 2], ['F5', 1], ['D5', 1]], [['Eb5', 4]],
    [['F5', 2], ['Eb5', 1], ['C5', 1]], [['D5', 2], ['Bb4', 2]], [['C5', 2], ['Eb5', 1], ['D5', 1]], [['D5', 4]],
  ],
  C: [ // flute, over the first 8 bars of A
    [['Eb5', 1], ['G5', 1], ['Bb5', 2]], [['Ab5', 1], ['G5', 1], ['F5', 2]], [['G5', 2], ['Eb5', 2]], [['C5', 3], ['Eb5', 1]],
    [['Bb5', 2], ['G5', 2]], [['Ab5', 1], ['C6', 1], ['Bb5', 1], ['Ab5', 1]], [['G5', 1], ['F5', 1], ['Eb5', 1], ['C5', 1]], [['D5', 2], ['F5', 2]],
  ],
  outro: [
    [['C5', 2], ['Bb4', 1], ['Ab4', 1]], [['G4', 2], ['Bb4', 2]], [['Ab4', 1.5], ['G4', 0.5], ['F4', 2]], [['Ab4', 2], ['F4', 2]],
    [['G4', 4]], [['C5', 2], ['Bb4', 2]], [['G4', 4]], [],
  ],
};
for (const [k, bars] of Object.entries(M))
  bars.forEach((b, i) => { const t = b.reduce((s, [, d]) => s + d, 0); if (b.length && t !== 4) throw new Error(`melody ${k} bar ${i + 1} has ${t} beats`); });

// Form: [name, harmony, first bar]
const FORM = [['Intro', H.intro], ['A1', H.A], ['A2', H.A], ['B', H.B], ['C', H.A.slice(0, 8)], ['A3', H.A], ['Outro', H.outro]];

export default function ({ transpose = 0 } = {}) {
  const s = new Session({ bpm: 76, transpose });
  const BAR = s.bar;
  const r = rng(20261015);
  const jit = (amt = 12) => (r() - 0.5) * 2 * amt;
  const vj = (amt = 4) => (r() - 0.5) * 2 * amt;

  // EQ types (measured): 0 bell, 1 low shelf, 2 high shelf, 3 high-pass, 4 low-pass, 5 notch, 6 band-pass.
  const eq = (type, freq, gain = 0, q = 0.7) => ({ plugin: 'eq_1band', params: { type, freq, gain, q } });
  // Levels: VSCO samples are recorded far quieter than Salamander, hence the sampler `level` boosts.
  s.reverb('Hall', 'plate_reverb', { decay: 2.8, pre_delay: 25, damping: 9000, size: 80, low_cut: 250 });
  const pno = s.instrument('Piano', { zones: 'piano', sampler: { attack: 0.5, release: 450, velocity: 35 }, sends: { Hall: -11 },
    inserts: [eq(3, 35), eq(0, 300, -3, 1), eq(2, 5000, 3.5)] });
  const vnOpts = { zones: 'violins', sampler: { attack: 260, release: 800, velocity: 40, level: 6 }, sends: { Hall: -6 }, pan: -0.25, inserts: [eq(3, 150)] };
  const vn = s.instrument('Violins', { ...vnOpts, volume: 10.5 });        // B melody: a little above the piano
  const vnPad = s.instrument('ViolinsPad', { ...vnOpts, volume: 3 });   // A3 countermelody: under the piano melody
  const va = s.instrument('Violas', { zones: 'violas', sampler: { attack: 350, release: 800, velocity: 40, level: 4 }, sends: { Hall: -6 }, volume: 0, pan: 0.15, inserts: [eq(3, 120)] });
  const vc = s.instrument('Cellos', { zones: 'cellos', sampler: { attack: 350, release: 800, velocity: 40, level: 3 }, sends: { Hall: -7 }, volume: -1, pan: 0.3, inserts: [eq(3, 45)] });
  const fl = s.instrument('Flute', { zones: 'flute', sampler: { attack: 70, release: 350, velocity: 40 }, sends: { Hall: -7 }, volume: -1, pan: -0.1 });
  const hp = s.instrument('Harp', { zones: 'harp', sampler: { attack: 0.5, release: 1500, velocity: 50, level: 3 }, sends: { Hall: -5 }, volume: 0, pan: 0.35 });
  s.master('eq_1band', { type: 0, freq: 500, gain: -2, q: 0.8 }); // tame a boxy 500 Hz build-up (measured +4 dB)
  s.master('maximizer', { threshold: -4, ceiling: -1 });

  // Notes held "with pedal": each lasts until the same pitch is struck again or the segment ends.
  const pedal = (inst, events, segEnd) => events.forEach((e, i) => {
    const next = events.slice(i + 1).find(f => f.p === e.p);
    inst.note(e.p, e.t + jit(), (next ? next.t : segEnd) - e.t - 15, e.v + vj());
  });

  const state = { bass: null, pv: null, va: null, vn: null };
  const pianoArp = (t0, bar, vel) => {
    for (const { ch, at, beats } of barChords(bar)) {
      const t = t0 + at * TPB, end = t + beats * TPB;
      state.bass = bassNote(ch, 34, 50, state.bass);
      state.pv = voice(ch, 4, 48, 68, state.pv);
      const v = state.pv;
      const order = beats === 4 ? [v[0], v[1], v[2], v[3], v[2], v[1], v[0]] : [v[1], v[2], v[3]];
      pedal(pno, [{ p: state.bass, t, v: vel + 6 }, ...order.map((p, i) => ({ p, t: t + (i + 1) * TPB / 2, v: vel - (i % 2) * 4 }))], end);
    }
  };
  const pianoPulse = (t0, bar, vel) => { // rolled chord on 1, softer repeat on 3: room for a melody above
    for (const { ch, at, beats } of barChords(bar)) {
      const t = t0 + at * TPB, end = t + beats * TPB;
      state.bass = bassNote(ch, 34, 50, state.bass);
      state.pv = voice(ch, 3, 50, 65, state.pv);
      const ev = [{ p: state.bass, t, v: vel + 6 }, ...state.pv.map((p, i) => ({ p, t: t + 40 + i * 35, v: vel }))];
      if (beats === 4) ev.push(...state.pv.map((p, i) => ({ p, t: t + 2 * TPB + i * 30, v: vel - 8 })));
      pedal(pno, ev, end);
    }
  };
  const strings = (t0, bar, vel, { violins = false, violas = true } = {}) => {
    for (const { ch, at, beats } of barChords(bar)) {
      const t = t0 + at * TPB, len = beats * TPB - 30;
      let b = bassNote(ch, 36, 50, state.bass);
      vc.note(b, t, len, vel);
      state.va = voice(ch, 2, 55, 67, state.va);
      if (violas) state.va.forEach(p => va.note(p, t + 20, len, vel - 4));
      if (violins) { state.vn = voice(ch, 1, 67, 79, state.vn); vnPad.note(state.vn[0], t + 10, len, vel - 10); }
    }
  };
  // Melody notes: higher notes slightly louder, small timing and velocity variation.
  const sing = (inst, t0, bars, vel, { shift = 0, legato = 25, maxVel = 127 } = {}) => bars.forEach((bar, i) => {
    let beat = 0;
    for (const [n, d] of bar) {
      if (n) {
        const p = midi(n) + shift;
        inst.note(p, t0 + i * BAR + beat * TPB + jit(8), d * TPB - legato, Math.min(maxVel, vel + (p - 70) * 0.5 + vj(3)));
      }
      beat += d;
    }
  });
  const harpRoll = (t, bar, vel, notes = 8) => {
    const { ch } = barChords(bar)[0];
    const ps = []; for (let p = 51; ps.length < notes; p++) if (ch.tones.includes(p % 12)) ps.push(p);
    ps.forEach((p, i) => hp.note(p, t + i * TPB / 4, BAR, vel + i * 2 + vj(3)));
  };

  const sections = {};
  let barNo = 0;
  for (const [name, harmony] of FORM) {
    const first = barNo;
    sections[name] = [first + 1, first + harmony.length];
    harmony.forEach((bar, i) => {
      const t0 = (barNo + i) * BAR;
      switch (name) {
        case 'Intro': pianoArp(t0, bar, 36 + i * 2); break;
        case 'A1': pianoArp(t0, bar, 42); if (i === 15) strings(t0, bar, 30, { violas: false }); break; // soft cello swell bridges into A2
        case 'A2': // strings enter in stages: cellos alone, violas from bar 3, full level by bar 5; first harp sweep at bar 5
          pianoArp(t0, bar, 42);
          strings(t0, bar, i < 4 ? 36 + i * 5 : 52 + Math.min(i, 8), { violas: i >= 2 });
          if (i % 4 === 0 && i > 0) harpRoll(t0, bar, 48);
          break;
        case 'B': pianoPulse(t0, bar, 34); strings(t0, bar, 58); break;
        case 'C': pianoArp(t0, bar, 40); strings(t0, bar, 50); break;
        case 'A3': pianoArp(t0, bar, 46); strings(t0, bar, 62, { violins: true }); if (i % 4 === 0) harpRoll(t0, bar, 64); break;
        case 'Outro':
          if (i < 7) { pianoArp(t0, bar, 40 - i * 2); strings(t0, bar, 54 - i * 4); }
          if (i === 4) harpRoll(t0, bar, 56, 10);
          break;
      }
    });
    const t0 = first * BAR;
    if (name === 'A1' || name === 'A2') sing(pno, t0, M.A, 74);
    if (name === 'B') sing(vn, t0, M.B, 74, { legato: 0, maxVel: 80 }); // stay in the soft sample layer (81+ switches to forte)
    if (name === 'C') sing(fl, t0, M.C, 76, { legato: 10 });
    if (name === 'A3') sing(pno, t0, M.A, 72, { shift: 12 });
    if (name === 'Outro') sing(pno, t0, M.outro, 66);
    barNo += harmony.length;
  }

  // Final bar: a slow rolled Eb chord left to ring, with a harp sweep.
  const tEnd = (barNo - 1) * BAR;
  ['Eb2', 'Bb2', 'G3', 'Eb4', 'G4', 'Bb4'].forEach((n, i) => pno.note(midi(n), tEnd + i * 70, 2 * BAR, 44 - i * 2));
  harpRoll(tEnd + TPB, 'Eb', 50, 10);
  vc.note(midi('Eb2') + 12, tEnd, BAR + TPB * 2, 40);
  va.note(midi('G3'), tEnd + 20, BAR + TPB * 2, 36);

  return { session: s, endTicks: (barNo + 2) * BAR, sections };
}

