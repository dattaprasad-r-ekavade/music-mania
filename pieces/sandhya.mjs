// Sandhya (dusk): a Hindi-film-style instrumental ballad (original composition).
// Render: node tools/render.mjs pieces/sandhya.mjs --stems
// Brief from three reference profiles (refs/tum-hi-ho, kesariya, channa-mereya; RULES.md 4c): 89-96 BPM, minor key
// with bVI and bVII, a stepwise lead (~65 % steps) of about 6 notes a bar in 4-bar phrases with most notes off the
// beat, a 3-3-2 kick, a brighter and denser mix than our lobby pieces. Melodies and harmony are our own.
// 92 BPM, E minor. Flute as bansuri leads; tenor sax answers in the interlude; Dan Tranh plays santoor figures.
// Form: Intro 8 | Mukhda 8 | Antara 16 | Mukhda 8 | Interlude 8 | Antara2 16 | Mukhda2 16 (twice, fuller) | Outro 8

import { Session, TPB, rng, ZONES } from '../tools/lib/session.mjs';
import { barChords, voice, bassNote, human, melody, checkBars, drums } from '../tools/lib/music.mjs';

const MUKHDA_H = ['Em', 'Cmaj7', 'D', 'Bm7', 'Em', 'C', 'Am7 D', 'Em'];
const ANTARA_H = ['Am', 'Am', 'Em', 'Em', 'C', 'D', 'G', 'B7', 'Am', 'Am', 'Em', 'C', 'Am7', 'D', 'Bm7', 'B7'];
const MUKHDA = [ // the hook: starts off the beat, settles on long notes at bar ends
  [[null, .5], ['B4', .5], ['E5', .5], ['D5', .5], ['E5', 1], ['G5', 1]], [['F#5', 1.5], ['E5', .5], ['D5', .5], ['E5', .5], ['C5', 1]],
  [[null, .5], ['D5', .5], ['C5', .5], ['B4', .5], ['A4', 1], ['B4', 1]], [['F#4', 1.5], ['A4', .5], ['B4', 2]],
  [[null, .5], ['B4', .5], ['E5', .5], ['D5', .5], ['E5', 1], ['B5', 1]], [['A5', 1.5], ['G5', .5], ['F#5', .5], ['G5', .5], ['E5', 1]],
  [['C5', .5], ['D5', .5], ['E5', .5], ['D5', .5], ['C5', .5], ['B4', .5], ['A4', .5], ['F#4', .5]], [['G4', .5], ['F#4', .5], ['E4', 3]],
];
const ANTARA = [ // the verse sits higher and climbs to B7 twice
  [[null, 1], ['E5', .5], ['F#5', .5], ['G5', 1], ['F#5', 1]], [['E5', .5], ['C5', 1], ['C5', .5], ['B4', .5], ['A4', .5], ['B4', 1]],
  [[null, .5], ['G4', .5], ['B4', .5], ['E5', .5], ['D5', 1], ['B4', 1]], [['E5', 3], [null, 1]],
  [[null, 1], ['E5', .5], ['G5', .5], ['A5', 1], ['G5', 1]], [['F#5', .5], ['D5', 1], ['E5', .5], ['F#5', 1], ['A5', 1]],
  [['G5', 1.5], ['F#5', .5], ['D5', 1], ['B4', 1]], [['D#5', 2], ['F#5', 1], ['A5', 1]],
  [['G5', 1.5], ['A5', .5], ['G5', .5], ['F#5', .5], ['E5', 1]], [[null, .5], ['C5', .5], ['E5', .5], ['A5', .5], ['G5', 1], ['E5', 1]],
  [['B4', .5], ['E5', .5], ['G5', 1], ['F#5', .5], ['G5', .5], ['E5', 1]], [['C5', 3], [null, 1]],
  [[null, .5], ['C5', .5], ['E5', .5], ['G5', .5], ['A5', 1], ['B5', 1]], [['A5', .5], ['F#5', 1], ['D5', .5], ['E5', .5], ['F#5', .5], ['A5', 1]],
  [['B5', 1.5], ['A5', .5], ['F#5', 1], ['D5', 1]], [['D#5', 2], ['F#5', 1], ['B5', 1]],
];
const SAX = [ // interlude answer over the mukhda chords, an octave under the flute
  [['E4', 1], ['G4', .5], ['A4', .5], ['B4', 2]], [[null, .5], ['C5', .5], ['B4', .5], ['A4', .5], ['G4', 2]],
  [['A4', 1], ['F#4', .5], ['G4', .5], ['A4', 1], ['D4', 1]], [['F#4', 4]],
  [['B4', 1], ['D5', .5], ['E5', .5], ['D5', 1], ['B4', 1]], [['C5', 1.5], ['B4', .5], ['A4', 1], ['G4', 1]],
  [['A4', .5], ['B4', .5], ['C5', .5], ['A4', .5], ['D5', 1], ['F#4', 1]], [['E4', 4]],
];
const COUNTER = [ // violins over the last mukhda: long notes a sixth above the tune's resting points
  [['G5', 4]], [['E5', 4]], [['F#5', 4]], [['D5', 4]], [['G5', 4]], [['E5', 4]], [['C5', 2], ['D5', 2]], [['B4', 4]],
];
[['mukhda', MUKHDA], ['antara', ANTARA], ['sax', SAX], ['counter', COUNTER]].forEach(([n, b]) => checkBars(n, b));

// Bansuri evening-out (owner review: "check for random volume increases"). Per-note RMS on the flute stem: velocity
// barely moves the level (0.03 dB per step at sampler velocity 40 %); the jumps were the samples. The E4 sample
// (root 64, plays E4 and F#4) sat 3.5 dB under the G4/A4 sample (root 69): sampler level 8 + level_trim 6 = 14 clamps
// at the sampler's +12 maximum, so its trim could not lift it, and every F#4 -> G4 step jumped 3.5-4 dB. Each zone's
// sampler level is set here instead (fitted on the stem, with 4 dB moved to the group fader so none exceeds +12).
const FLUTE_LEVEL = { 64: 11.5, 69: 8.5, 72: 8.3, 76: 3.9, 81: 2.9, 84: -2.1 };
ZONES.flute_even ??= ZONES.flute.map(z => ({ ...z, level_trim: FLUTE_LEVEL[z.root] ?? Math.min(12, 8 + (z.level_trim ?? 0)) - 4 }));

const FORM = [['Intro', 8], ['Mukhda', 8], ['Antara', 16], ['Mukhda1b', 8], ['Interlude', 8], ['Antara2', 16], ['Mukhda2', 16], ['Outro', 8]];

export default function () {
  const s = new Session({ bpm: 92 });
  const BAR = s.bar, S16 = TPB / 4;
  const h = human(rng(1792));
  const hf = human(rng(66)); // own jitter for the frame-drum layer, so the other parts keep their seeded timing
  const eq = (type, freq, gain = 0, q = 0.7) => ({ plugin: 'eq_1band', params: { type, freq, gain, q } });

  s.reverb('Hall', 'plate_reverb', { decay: 2.8, pre_delay: 30, damping: 9500, size: 80, low_cut: 250 });
  const pno = s.instrument('Piano', { zones: 'piano', sampler: { attack: 0.5, release: 500, velocity: 35 }, sends: { Hall: -10 }, volume: -1, inserts: [eq(3, 60), eq(2, 5000, 3)] });
  const vc = s.instrument('Cellos', { zones: 'cellos', sampler: { attack: 300, release: 900, velocity: 40, level: 9 }, sends: { Hall: -7 }, volume: -1, pan: 0.1, inserts: [eq(3, 45)] });
  const va = s.instrument('Violas', { zones: 'violas', sampler: { attack: 400, release: 900, velocity: 40, level: 9 }, sends: { Hall: -5 }, volume: -4, pan: 0.3, inserts: [eq(3, 150)] });
  const vn = s.instrument('Violins', { zones: 'violins', sampler: { attack: 350, release: 900, velocity: 40, level: 10 }, sends: { Hall: -4 }, volume: -2, pan: -0.3, inserts: [eq(3, 200)] });
  const fl = s.instrument('Bansuri', { zones: 'flute_even', sampler: { attack: 60, release: 450, velocity: 40, level: 0 }, sends: { Hall: -6 }, volume: 0.5, inserts: [eq(2, 5000, 2)] });
  const sax = s.instrument('Sax', { zones: 'tenor_sax_vib', sampler: { attack: 40, release: 400, velocity: 40, level: 9 }, sends: { Hall: -7 }, volume: -3, pan: 0.1 });
  // Santoor (Dan Tranh) warmed after the owner heard the intro as "too metally": its stem sat at 4 kHz only 2 dB under
  // 1 kHz (centroid 1.6 kHz). Lower register, softer strokes (mf layer), high shelf and low-pass take the zing off.
  const dt = s.instrument('Santoor', { zones: 'dan_tranh', oneShot: true, sampler: { attack: 0.5, release: 900, velocity: 40, level: 10 }, sends: { Hall: -6 }, volume: -7, pan: 0.2,
    inserts: [eq(3, 150), eq(0, 350, 2, 0.8), eq(2, 3000, -2.5), eq(4, 10000, 0, 0.7)] });
  dt.automate('volume', [[0, 2], [8 * BAR - 10, 2], [8 * BAR, 0]]); // the soft mf strokes carry the intro: 2 dB up there only
  const bass = s.instrument('Bass', { synth: { plugin: 'subtractive_synth', params: { osc1_wave: 2, osc2_wave: 3, osc2_semitones: 0, osc_mix: 30, cutoff: 900, resonance: 5, filter_env_amount: 10, amp_attack: 5, amp_decay: 400, amp_sustain: 70, amp_release: 180, level: -6 } },
    inserts: [eq(3, 32), { plugin: 'saturator', params: { drive: 2, mix: 20 } }], volume: 1 });
  const kit = s.instrument('Kit', { synth: { plugin: 'drum_synth', params: { level: -8, kick_decay: 460, kick_tune: -2, snare_snappy: 60, snare_decay: 180, hat_decay: 35, open_hat_decay: 220 } },
    inserts: [eq(0, 100, 4, 1.2), { plugin: 'compressor', params: { threshold: -16, ratio: 3, attack: 8, release: 120, makeup: 2 } }], sends: { Hall: -18 }, volume: -2 });
  const hand = s.instrument('Dholak', { zones: 'hand', oneShot: true, sampler: { attack: 0.5, release: 300, velocity: 60 }, sends: { Hall: -14 }, volume: -8, pan: -0.15,
    inserts: [eq(3, 45), eq(0, 110, 5, 1.0)] }); // body under the doum (owner: "percussion needs a little bass"); the bass synth sits at 50-80 Hz
  s.master('eq_1band', { type: 2, freq: 4000, gain: 4 });   // the references sit 10-20 dB brighter above 4 kHz than our lobby pieces
  s.master('eq_1band', { type: 2, freq: 10000, gain: 3 });
  s.master('maximizer', { threshold: -3.5, ceiling: -1.7 }); // -1.5 measured -0.99 dBTP

  // Piano: ballad arpeggio, bass note then chord tones in eighths (thinner when told to).
  let pv = null, bv = null;
  const piano = (t0, chs, vel, thin = false) => {
    for (const { ch, at, beats } of chs) {
      pv = voice(ch, 3, 55, 71, pv);
      const b = bassNote(ch, 40, 52);
      pno.note(b, t0 + at * TPB, beats * TPB - 30, vel + 4);
      const order = thin ? [null, 1, null, 2] : [0, 1, 2, 1, 0, 1, 2, 1];
      for (let k = 1; k < beats * 2; k++) {
        const idx = order[k % order.length];
        if (idx != null) pno.note(pv[idx], t0 + at * TPB + k * TPB / 2 + h.t(8), TPB / 2 + 200, vel - 6 + h.v(3));
      }
    }
  };
  let vaV = null, vnV = null, cn = null;
  const pads = (t0, chs, vel, violins) => {
    for (const { ch, at, beats } of chs) {
      cn = bassNote(ch, 43, 55, cn); vc.note(cn, t0 + at * TPB, beats * TPB - 40, vel - 4);
      vaV = voice(ch, 2, 57, 69, vaV); vaV.forEach(p => va.note(p, t0 + at * TPB + 20, beats * TPB - 40, vel));
      if (violins) { vnV = voice(ch, 2, 67, 79, vnV); vnV.forEach(p => vn.note(p, t0 + at * TPB + 40, beats * TPB - 60, Math.min(78, vel - 4))); }
    }
  };
  // Santoor: each chord tone struck twice in quick succession, wandering in the upper register.
  const santoor = (t0, chs, vel) => {
    for (const { ch, at, beats } of chs) {
      const v = voice(ch, 4, 59, 78);
      const path = [0, 1, 2, 3, 2, 1, 2, 3];
      for (let k = 0; k < beats * 2; k++) {
        const p = v[path[k % path.length]], t = t0 + at * TPB + k * 2 * S16;
        dt.note(p, t + h.t(5), S16 * 2, vel + (k % 2 ? -6 : 0) + h.v(3));
        dt.note(p, t + S16 + h.t(5), S16 * 2, vel - 16 + h.v(3));
      }
    }
  };
  // Bass on the 3-3-2 grid (beats 1, 2&, 4) under each chord's bass note.
  let bn = null;
  const bassBar = (t0, chs, vel) => {
    for (const { ch, at, beats } of chs) {
      bn = bassNote(ch, 28, 40, bn);
      for (const b of [0, 1.5, 3]) if (b >= at && b < at + beats) bass.note(bn, t0 + b * TPB, (b === 3 ? 1 : 1.5) * TPB - 60, vel + (b === 0 ? 8 : 0) + h.v(3));
    }
  };
  // Groove: 3-3-2 kick (as in the references), soft snare on 4, closed hats in eighths; dholak strokes on the hand kit
  // (60 doum low, 62 tek high, 64 ka slap) in a keherwa-like pattern.
  const groove = (t0, vel, full = true) => {
    drums(kit, t0, { 36: 'X.....X.....X...', 38: full ? '........x.......' : '................', 42: full ? 'x.o.x.o.x.o.x.o.' : '' }, { vel, h });
    drums(hand, t0, { 60: 'X.....x.....x...', 62: '...x.....x....x.', 64: full ? '..o...o.o.o...o.' : '' }, { vel: vel - 6, h });
    drums(hand, t0, { 66: 'x.....x.....x...' }, { vel: vel - 14, h: hf }); // muted large frame drum under each doum for low end
  };
  const fill = t0 => drums(hand, t0 + 2 * TPB, { 62: 'x.x.xxXX', 60: 'X.......' }, { vel: 84, h });

  const sections = {};
  let bar = 0;
  for (const [name, len] of FORM) {
    sections[name] = [bar + 1, bar + len];
    const t0s = bar * BAR;
    for (let i = 0; i < len; i++) {
      const t0 = (bar + i) * BAR;
      const harm = name.startsWith('Antara') ? ANTARA_H[i] : MUKHDA_H[i % 8];
      const chs = barChords(harm);
      switch (name) {
        case 'Intro':
          santoor(t0, chs, i < 4 ? 38 : 40);
          pads(t0, chs, 44, false);
          if (i >= 4) piano(t0, chs, 40, true);
          if (i === 7) fill(t0);
          break;
        case 'Mukhda': case 'Mukhda1b':
          piano(t0, chs, 48); pads(t0, chs, 54, true); bassBar(t0, chs, 80); groove(t0, 78);
          if (i === 7) fill(t0);
          break;
        case 'Antara': case 'Antara2':
          piano(t0, chs, name === 'Antara' ? 44 : 48, name === 'Antara' && i < 8);
          if (name === 'Antara2' || i >= 2) pads(t0, chs, name === 'Antara' ? 46 : 54, name === 'Antara2' || i >= 8);
          bassBar(t0, chs, 74);
          groove(t0, name === 'Antara' ? 70 : 76, name === 'Antara2' || i >= 8);
          if (name === 'Antara2') santoor(t0, chs, 40);
          if (i === 15) fill(t0);
          break;
        case 'Interlude':
          santoor(t0, chs, 52); pads(t0, chs, 50, false); bassBar(t0, chs, 74); groove(t0, 72, false);
          if (i === 7) fill(t0);
          break;
        case 'Mukhda2':
          piano(t0, chs, 50); pads(t0, chs, 58, true); bassBar(t0, chs, 84); groove(t0, 82);
          if (i >= 8) santoor(t0, chs, 42);
          if (i === 7) fill(t0);
          break;
        case 'Outro':
          santoor(t0, chs, 42 - i * 2);
          pads(t0, chs, 50 - i * 3, i < 4);
          if (i < 4) piano(t0, chs, 42 - i * 2, true);
          break;
      }
    }
    // Strings swell in with fader automation rather than arriving as a block (RULES 4: staged entries).
    // A point holds back to the start of the piece, so each swell starts with a 0 dB point just before it.
    const swell = (inst, at, from = -14, over = 2 * BAR) => inst.automate('volume', [[at - 10, 0], [at, from], [at + over, 0]]);
    if (name === 'Antara') { swell(va, t0s + 2 * BAR); swell(vc, t0s + 2 * BAR); swell(vn, t0s + 8 * BAR); }
    if (name === 'Outro') { va.automate('volume', [[t0s, 0], [t0s + 8 * BAR, -24]]); vc.automate('volume', [[t0s, 0], [t0s + 8 * BAR, -24]]); vn.automate('volume', [[t0s, 0], [t0s + 4 * BAR, -24]]); }
    if (name === 'Intro') melody(fl, t0s + 4 * BAR, MUKHDA.slice(4), 62, { h, lift: 0.3, legato: 30, grace: 80 });
    if (name.startsWith('Mukhda')) for (let k = 0; k < len / 8; k++) melody(fl, t0s + k * 8 * BAR, MUKHDA, 72 + k * 4, { h, lift: 0.3, legato: 30, grace: 80 });
    if (name.startsWith('Antara')) melody(fl, t0s, ANTARA, name === 'Antara' ? 68 : 72, { h, lift: 0.3, legato: 30, grace: 80 });
    if (name === 'Interlude') melody(sax, t0s, SAX, 74, { h, lift: 0.2, legato: 40 });
    if (name === 'Mukhda2') melody(vn, t0s + 8 * BAR, COUNTER, 66, { h, lift: 0, legato: 40 });
    if (name === 'Outro') melody(fl, t0s, MUKHDA.slice(4).concat([[['B4', 4]], [[null, 4]], [[null, 4]], [[null, 4]]]), 60, { h, lift: 0.3, legato: 30 });
    bar += len;
  }
  return { session: s, endTicks: (bar + 3) * BAR, sections, ref: 'refs/tum-hi-ho.profile.json' };
}
