// Spring Dream: light, floating spring morning (original composition).
// Render: node tools/render.mjs pieces/spring-dream.mjs --stems
// 72 BPM, F Lydian (F major with a raised 4th, B natural: the "floating" colour), triplet (12/8) harp motion.
// Form: Intro 4 harp + glock | A 16 flute, strings join in stages | B 16 clarinet, pizzicato + marimba, piano |
//       A2 16 violins lead, flute countermelody | Bridge 8 suspended, harp and glock | Outro 6, plus ring-out

import { Session, TPB, rng } from '../tools/lib/session.mjs';
import { barChords, voice, bassNote, human, melody, checkBars } from '../tools/lib/music.mjs';

const H = {
  intro: ['Fmaj7', 'G/F', 'Fmaj7', 'G/F'],
  A: ['Fmaj7', 'G/F', 'Fmaj7', 'G/F', 'Dm7', 'Em7', 'Fmaj7', 'Gsus4 G', 'Am7', 'Em7', 'Fmaj7', 'Cmaj7', 'Dm7', 'Em7', 'Fmaj7', 'G'],
  B: ['Dm7', 'G', 'Cmaj7', 'Am7', 'Dm7', 'G', 'Em7', 'Am7', 'Fmaj7', 'Em7', 'Dm7', 'Cmaj7', 'Bbmaj7', 'Am7', 'Gsus4', 'G'],
  bridge: ['Fmaj7', 'Fmaj7', 'Ebmaj7', 'Ebmaj7', 'Dbmaj7', 'Dbmaj7', 'Gsus4', 'G'],
  outro: ['Fmaj7', 'G/F', 'Fmaj7', 'G/F', 'Fmaj7', 'Fmaj7'],
};
const MA = [
  [['C5', 1.5], ['A4', .5], ['B4', 1], ['C5', 1]], [['D5', 2], ['B4', 1], ['G4', 1]], [['A4', 1.5], ['G4', .5], ['A4', 1], ['C5', 1]], [['B4', 3], [null, 1]],
  [['F5', 1.5], ['E5', .5], ['D5', 1], ['C5', 1]], [['B4', 1.5], ['C5', .5], ['D5', 1], ['E5', 1]], [['C5', 2], ['A4', 1], ['B4', 1]], [['C5', 1], ['B4', 1], ['A4', 1], ['G4', 1]],
  [['E5', 1.5], ['D5', .5], ['C5', 1], ['E5', 1]], [['G5', 2], ['E5', 1], ['D5', 1]], [['C5', 1.5], ['D5', .5], ['E5', 1], ['A5', 1]], [['G5', 3], [null, 1]],
  [['F5', 1.5], ['E5', .5], ['D5', 1], ['A4', 1]], [['B4', 1.5], ['C5', .5], ['D5', 1], ['G5', 1]], [['E5', 2], ['D5', 1], ['B4', 1]], [['D5', 4]],
];
const MB = [
  [['A4', .5], ['F4', .5], ['A4', .5], ['C5', .5], ['D5', 1], ['C5', 1]], [['B4', 1], ['G4', 1], ['D4', 2]],
  [['E4', .5], ['G4', .5], ['B4', .5], ['C5', .5], ['E5', 1], ['D5', 1]], [['C5', 3], [null, 1]],
  [['F4', .5], ['A4', .5], ['C5', .5], ['D5', .5], ['F5', 1], ['E5', 1]], [['D5', 1], ['B4', 1], ['G4', 2]],
  [['G4', .5], ['B4', .5], ['D5', .5], ['E5', .5], ['G5', 1], ['E5', 1]], [['C5', 4]],
  [['A4', 1], ['C5', 1], ['E5', 1], ['F5', 1]], [['E5', 1.5], ['D5', .5], ['B4', 2]],
  [['D5', 1], ['F5', 1], ['A5', 1], ['F5', 1]], [['E5', 3], [null, 1]],
  [['D5', 1.5], ['C5', .5], ['Bb4', 1], ['A4', 1]], [['C5', 1.5], ['B4', .5], ['A4', 1], ['E4', 1]],
  [['G4', 1], ['C5', 1], ['D5', 2]], [['B4', 4]],
];
const COUNTER = [ // flute, high and sparse, over A2
  [['A5', 4]], [['B5', 4]], [['C6', 2], ['A5', 2]], [['B5', 4]], [['A5', 2], ['F5', 2]], [['G5', 4]], [['A5', 2], ['C6', 2]], [['B5', 2], ['D6', 2]],
  [['C6', 4]], [['B5', 4]], [['A5', 2], ['E5', 2]], [['G5', 4]], [['A5', 4]], [['B5', 2], ['G5', 2]], [['C6', 4]], [['B5', 4]],
];
[['A', MA], ['B', MB], ['counter', COUNTER]].forEach(([n, b]) => checkBars(n, b));

const FORM = [['Intro', H.intro], ['A', H.A], ['B', H.B], ['A2', H.A], ['Bridge', H.bridge], ['Outro', H.outro]];

export default function () {
  const s = new Session({ bpm: 72 });
  const BAR = s.bar, T3 = TPB / 3; // triplet eighth
  const h = human(rng(2026));
  const eq = (type, freq, gain = 0, q = 0.7) => ({ plugin: 'eq_1band', params: { type, freq, gain, q } });

  s.reverb('Hall', 'plate_reverb', { decay: 3.4, pre_delay: 30, damping: 10000, size: 90, low_cut: 250 });
  const hp = s.instrument('Harp', { zones: 'harp', sampler: { attack: 0.5, release: 1500, velocity: 50, level: 6 }, sends: { Hall: -5 }, volume: 1, pan: 0.2 });
  const gl = s.instrument('Glock', { zones: 'glock', oneShot: true, sampler: { attack: 0.5, release: 1800, velocity: 50, level: 12 }, sends: { Hall: -4 }, volume: 6, pan: 0.35 });
  const fl = s.instrument('Flute', { zones: 'flute', sampler: { attack: 70, release: 400, velocity: 40, level: 4 }, sends: { Hall: -6 }, volume: 1, pan: -0.15 });
  const flC = s.instrument('FluteCounter', { zones: 'flute', sampler: { attack: 90, release: 400, velocity: 40, level: 4 }, sends: { Hall: -4 }, volume: -9, pan: 0.25 });
  const cl = s.instrument('Clarinet', { zones: 'clarinet', sampler: { attack: 50, release: 350, velocity: 40, level: 6 }, sends: { Hall: -7 }, volume: 0, pan: 0.1 });
  const pno = s.instrument('Piano', { zones: 'piano', sampler: { attack: 0.5, release: 500, velocity: 35 }, sends: { Hall: -9 }, volume: 6, inserts: [eq(3, 60), eq(0, 300, -3, 1), eq(2, 5000, 3)] });
  const vnOpts = { zones: 'violins', sampler: { attack: 300, release: 900, velocity: 40, level: 12 }, sends: { Hall: -5 }, pan: -0.3, inserts: [eq(3, 180)] };
  const vn = s.instrument('Violins', { ...vnOpts, volume: 12 });
  const vnPad = s.instrument('ViolinsPad', { ...vnOpts, volume: 0 });
  const va = s.instrument('Violas', { zones: 'violas', sampler: { attack: 450, release: 900, velocity: 40, level: 4 }, sends: { Hall: -5 }, volume: -3, pan: 0.15, inserts: [eq(3, 120)] });
  const vc = s.instrument('Cellos', { zones: 'cellos', sampler: { attack: 450, release: 900, velocity: 40, level: 6 }, sends: { Hall: -6 }, volume: 2, pan: 0.3, inserts: [eq(3, 45)] });
  const vnP = s.instrument('VlnPizz', { zones: 'violins_pizz', oneShot: true, sampler: { attack: 0.5, release: 400, velocity: 50, level: 8 }, sends: { Hall: -6 }, volume: -6, pan: -0.35 });
  const vcP = s.instrument('VcPizz', { zones: 'cellos_pizz', oneShot: true, sampler: { attack: 0.5, release: 500, velocity: 50, level: 6 }, sends: { Hall: -8 }, volume: -4, pan: 0.25 });
  const mar = s.instrument('Marimba', { zones: 'marimba', oneShot: true, maxShift: 7, sampler: { attack: 0.5, release: 900, velocity: 50, level: 8 }, sends: { Hall: -6 }, volume: -2, pan: 0.3 });
  s.master('eq_1band', { type: 0, freq: 500, gain: -3.5, q: 0.8 });
  s.master('eq_1band', { type: 1, freq: 140, gain: 2 });
  s.master('eq_1band', { type: 2, freq: 5000, gain: 3 }); // air: harp and flute measured dull (4 kHz at -16)
  s.master('maximizer', { threshold: -1.5, ceiling: -1 });

  const st = { hp: null, va: null, vn: null, pno: null, bass: null };
  // Harp: rising and falling triplet arpeggio over two octaves of chord tones (12 notes a bar).
  const harpFlow = (t0, chs, vel) => {
    for (const { ch, at, beats } of chs) {
      st.hp = voice(ch, 4, 53, 72, st.hp);
      const up = [...st.hp, ...st.hp.map(p => p + 12)];
      const seq = [...up.slice(0, 6), ...up.slice(1, 7).reverse()];
      const n = Math.round(beats * 3);
      for (let k = 0; k < n; k++) hp.note(seq[k % seq.length], t0 + at * TPB + k * T3 + h.t(6), T3 * 4, vel + (k % 3 === 0 ? 8 : 0) + h.v(3));
      hp.note(bassNote(ch, 41, 53), t0 + at * TPB, beats * TPB, vel + 6);
    }
  };
  const sparkle = (t0, ch, vel, beats = [2.5]) => beats.forEach((b, k) => {
    const ps = ch.tones.map(p => 84 + ((p - 84) % 12 + 12) % 12).sort((a, b) => a - b);
    gl.note(ps[(k * 2 + 1) % ps.length], t0 + b * TPB, TPB * 2, vel + h.v());
  });
  const strings = (t0, chs, vel, { violas = true, cellos = true, violins = false } = {}) => {
    for (const { ch, at, beats } of chs) {
      const t = t0 + at * TPB, len = beats * TPB - 30;
      st.bass = bassNote(ch, 41, 53, st.bass);
      if (cellos) vc.note(st.bass, t, len, vel);
      st.va = voice(ch, 2, 57, 69, st.va);
      if (violas) st.va.forEach(p => va.note(p, t + 20, len, vel - 4));
      if (violins) { st.vn = voice(ch, 2, 69, 81, st.vn); st.vn.forEach(p => vnPad.note(p, t + 10, len, vel - 8)); }
    }
  };
  const pizz = (t0, chs, vel) => {
    for (const { ch, at, beats } of chs) {
      const v = voice(ch, 3, 62, 76);
      const r = bassNote(ch, 41, 53);
      for (let b = 0; b < beats; b++) {
        const t = t0 + (at + b) * TPB;
        if (b % 2 === 0) vcP.note(r, t, TPB, vel + 6 + h.v());
        vnP.note(v[(b + 1) % v.length], t + TPB / 2 + h.t(8), TPB / 2, vel + h.v());
      }
    }
  };
  const marimba = (t0, chs, vel) => {
    for (const { ch, at, beats } of chs) {
      const v = voice(ch, 3, 67, 79);
      for (let k = 0; k < beats * 2; k++) if (k % 4 !== 3) mar.note(v[[0, 1, 2, 1][k % 4]], t0 + at * TPB + k * TPB / 2 + h.t(6), TPB / 2, vel + (k % 2 ? -6 : 0) + h.v());
    }
  };
  const pianoChords = (t0, chs, vel) => {
    for (const { ch, at, beats } of chs) {
      st.pno = voice(ch, 4, 55, 72, st.pno);
      st.pno.forEach((p, k) => pno.note(p, t0 + at * TPB + k * 30 + h.t(6), beats * TPB - 40, vel + h.v()));
    }
  };

  const sections = {};
  let bar = 0;
  for (const [name, harm] of FORM) {
    sections[name] = [bar + 1, bar + harm.length];
    harm.forEach((hs, i) => {
      const t0 = (bar + i) * BAR;
      const chs = barChords(hs);
      const ch = chs[0].ch;
      switch (name) {
        case 'Intro':
          harpFlow(t0, chs, 46 + i * 2);
          if (i % 2 === 1) sparkle(t0, ch, 52);
          break;
        case 'A':
          harpFlow(t0, chs, 48);
          // strings in stages: cellos from bar 5, violas from bar 7, full by bar 9
          if (i >= 4) strings(t0, chs, i < 8 ? 40 + (i - 4) * 4 : 56, { violas: i >= 6 });
          if (i === 3) vc.note(53, t0 + 2 * TPB, 2 * TPB, 34);
          if (i % 4 === 3) sparkle(t0, ch, 50);
          break;
        case 'B':
          pizz(t0, chs, 58);
          if (i >= 2) marimba(t0, chs, 52);
          if (i >= 8) pianoChords(t0, chs, 40);
          strings(t0, chs, 46, { cellos: false });
          break;
        case 'A2':
          harpFlow(t0, chs, 50);
          strings(t0, chs, 58);
          if (i % 2 === 1) sparkle(t0, ch, 54, [1.5, 3.5]);
          break;
        case 'Bridge':
          harpFlow(t0, chs, 44);
          strings(t0, chs, 50 - (i >= 6 ? 0 : 0), { violins: true });
          sparkle(t0, ch, 50, [0, 2]);
          break;
        case 'Outro':
          if (i < 5) harpFlow(t0, chs, 46 - i * 2);
          if (i < 4) strings(t0, chs, 50 - i * 4, { violas: i < 3 });
          if (i % 2 === 1) sparkle(t0, ch, 48);
          if (i === 5) { // final: a slow rolled Fmaj7 with the raised-4th colour on top
            ['F3', 'C4', 'E4', 'A4', 'B4', 'E5'].forEach((n, k) => hp.note(n, t0 + k * 110, 2 * BAR, 52 - k * 2));
            gl.note('E6', t0 + 600, 2 * BAR, 50);
            vc.note('F3', t0, BAR + TPB * 2, 40);
          }
          break;
      }
    });
    const t0 = bar * BAR;
    if (name === 'A') melody(fl, t0, MA, 70, { h, lift: 0.4, legato: 20 }); // enters gently over the harp
    if (name === 'B') melody(cl, t0, MB, 72, { h, lift: 0.3, legato: 20 });
    if (name === 'A2') { melody(vn, t0, MA, 74, { h, lift: 0.4, legato: 0, maxVel: 80 }); melody(flC, t0, COUNTER, 62, { h, lift: 0.2, legato: 20 }); }
    if (name === 'Bridge') melody(fl, t0, [[['E5', 4]], [['D5', 2], ['B4', 2]], [['G5', 4]], [['F5', 2], ['D5', 2]], [['F5', 4]], [['Eb5', 2], ['C5', 2]], [['C5', 4]], [['B4', 4]]], 64, { h, legato: 20 });
    if (name === 'Outro') melody(fl, t0, [[['C5', 1.5], ['A4', .5], ['B4', 1], ['C5', 1]], [['D5', 2], ['B4', 2]], [['A4', 4]], [['B4', 4]]], 62, { h, legato: 20 });
    bar += harm.length;
  }
  return { session: s, endTicks: (bar + 2) * BAR, sections };
}
