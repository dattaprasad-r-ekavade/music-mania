// Shared composition helpers: chords, voice-leading, melodies, drum patterns.
// (Golden Hour keeps its own copies so its render stays bit-identical.)

import { TPB, midi } from './session.mjs';

const PCN = { C: 0, D: 2, E: 4, F: 5, G: 7, A: 9, B: 11 };
export const pc = s => (PCN[s[0]] + (s[1] === '#' ? 1 : s[1] === 'b' ? -1 : 0) + 12) % 12;

// Intervals above the root. The third and seventh are found from these for voicing rules.
const QUAL = {
  '': [0, 4, 7], m: [0, 3, 7], 5: [0, 7], dim: [0, 3, 6], aug: [0, 4, 8], sus2: [0, 2, 7], sus4: [0, 5, 7], sus: [0, 5, 7],
  6: [0, 4, 7, 9], m6: [0, 3, 7, 9], 7: [0, 4, 7, 10], m7: [0, 3, 7, 10], maj7: [0, 4, 7, 11], '7sus': [0, 5, 7, 10],
  m7b5: [0, 3, 6, 10], add9: [0, 4, 7, 2], madd9: [0, 3, 7, 2], 9: [0, 4, 10, 2], m9: [0, 3, 10, 2], maj9: [0, 4, 11, 2],
  13: [0, 4, 10, 9], '7#9': [0, 4, 10, 3], '7b9': [0, 4, 10, 1], mmaj7: [0, 3, 7, 11],
};
export function chord(sym) {
  const [main, slash] = sym.split('/');
  const m = /^([A-G][b#]?)(.*)$/.exec(main);
  const q = QUAL[m[2]];
  if (!q) throw new Error(`unknown chord ${sym}`);
  const root = pc(m[1]);
  const third = q.slice(1).find(i => i === 3 || i === 4) ?? null;
  const seventh = q.find(i => i === 10 || i === 11) ?? null;
  return { sym, root, tones: q.map(i => (root + i) % 12), third: third == null ? null : (root + third) % 12, seventh: seventh == null ? null : (root + seventh) % 12, bass: slash ? pc(slash) : root };
}
// A bar's harmony: 'Eb' (whole bar), 'Fm7 Bb7' (two beats each), 'C . . G' (beats; '.' holds).
export function barChords(s, beats = 4) {
  const p = s.split(' ');
  const out = [];
  p.forEach((c, i) => {
    const at = i * beats / p.length;
    if (c === '.') out[out.length - 1].beats += beats / p.length;
    else out.push({ ch: chord(c), at, beats: beats / p.length });
  });
  return out;
}

function* combos(a, n, start = 0, acc = []) {
  if (acc.length === n) { yield acc; return; }
  for (let i = start; i < a.length; i++) yield* combos(a, n, i + 1, [...acc, a[i]]);
}
// n chord tones in [lo, hi] moving as little as possible from prev; always the third, prefer the seventh.
export function voice(ch, n, lo, hi, prev) {
  const cands = [];
  for (let p = lo; p <= hi; p++) if (ch.tones.includes(p % 12)) cands.push(p);
  let best = null;
  for (const c of combos(cands, Math.min(n, cands.length))) {
    const pcs = new Set(c.map(p => p % 12));
    let cost = (c.length - pcs.size) * 2;
    if (ch.third != null && !pcs.has(ch.third)) cost += 8;
    if (ch.seventh != null && c.length >= 3 && !pcs.has(ch.seventh)) cost += 3;
    for (let i = 1; i < c.length; i++) if (c[i] - c[i - 1] < 3) cost += 1.5;
    cost += prev ? c.reduce((s, p, i) => s + Math.abs(p - prev[Math.min(i, prev.length - 1)]), 0) * 0.5
                 : Math.abs(c.reduce((s, p) => s + p, 0) / c.length - (lo + hi) / 2) * 0.3;
    if (!best || cost < best.cost) best = { c, cost };
  }
  return best.c;
}
export function bassNote(ch, lo, hi, prev) {
  let best = null;
  for (let p = lo; p <= hi; p++) if (p % 12 === ch.bass) {
    const d = prev == null ? Math.abs(p - (lo + hi) / 2) : Math.abs(p - prev);
    if (best == null || d < best.d) best = { p, d };
  }
  return best.p;
}

// Humanisation from a seeded rng.
export const human = r => ({ t: (amt = 12) => (r() - 0.5) * 2 * amt, v: (amt = 4) => (r() - 0.5) * 2 * amt });

// Melody: bars of [note|null, beats] (a note may be [note, grace] for a quick grace note before it).
// opts: shift (semitones), legato (ticks shaved off each note), lift (velocity per semitone above 70), maxVel, h (humaniser)
export function melody(inst, t0, bars, vel, { bar = 4 * TPB, shift = 0, legato = 25, lift = 0.5, maxVel = 127, h, grace = 70 } = {}) {
  bars.forEach((b, i) => {
    let beat = 0;
    for (const [n, d] of b) {
      if (n) {
        const [note, g] = Array.isArray(n) ? n : [n, null];
        const p = midi(note) + shift;
        const t = t0 + i * bar + beat * TPB + (h ? h.t(8) : 0);
        const v = Math.min(maxVel, vel + (p - 70) * lift + (h ? h.v(3) : 0));
        if (g) inst.note(midi(g) + shift, t - grace, grace + 10, v - 10);
        inst.note(p, t, d * TPB - legato, v);
      }
      beat += d;
    }
  });
}
export function checkBars(name, bars, beats = 4) {
  bars.forEach((b, i) => { const t = b.reduce((s, [, d]) => s + d, 0); if (b.length && Math.abs(t - beats) > 1e-6) throw new Error(`${name} bar ${i + 1} has ${t} beats`); });
}

// Drum pattern: { key: 'X..x..o.' } over steps of `step` ticks. X accent, x normal, o ghost, '.' rest.
// swing (0..0.5) delays every second step by that fraction of a step.
export function drums(inst, t0, pattern, { step = TPB / 4, vel = 100, swing = 0, h, len = TPB / 4 } = {}) {
  for (const [key, s] of Object.entries(pattern)) {
    [...s.replace(/ /g, '')].forEach((c, i) => {
      if (c === '.') return;
      const v = c === 'X' ? vel + 15 : c === 'x' ? vel : vel - 35;
      const t = t0 + i * step + (i % 2 ? swing * step : 0) + (h ? h.t(6) : 0);
      inst.note(+key, t, len, v + (h ? h.v(5) : 0));
    });
  }
}

// Scale helpers (pitch classes from a root), e.g. scale('C', [0,1,4,5,7,8,11]) for Bhairav.
export const SCALES = {
  major: [0, 2, 4, 5, 7, 9, 11], minor: [0, 2, 3, 5, 7, 8, 10], dorian: [0, 2, 3, 5, 7, 9, 10], lydian: [0, 2, 4, 6, 7, 9, 11],
  phrygianDominant: [0, 1, 4, 5, 7, 8, 10], bhairav: [0, 1, 4, 5, 7, 8, 11], pahadi: [0, 2, 4, 5, 7, 9, 10],
};
