// City Lights: urban night, neo-soul / lo-fi hip-hop (original composition).
// Render: node tools/render.mjs pieces/city-lights.mjs --stems
// 86 BPM, swung 16ths, Db major with jazz voicings. Warm saturated piano, round synth bass, boom-bap drum machine,
// harmon-muted trumpet lead, pizzicato motif and a chorused synth pad in the break.
// Form: Intro 4 | A 16 (beat comes in over 4 bars) | B 16 trumpet | Break 8 | A2 16 piano melody | B2 8 trumpet | Outro 4

import { Session, TPB, rng } from '../tools/lib/session.mjs';
import { barChords, voice, bassNote, human, melody, checkBars, drums } from '../tools/lib/music.mjs';

const LOOP_A = ['Ebm9', 'Ab13', 'Dbmaj9', 'Bbm7'];
const LOOP_B = ['Gbmaj9', 'Fm7', 'Ebm9', 'Ab13'];
const TRUMPET = [
  [[null, .5], ['F5', .5], ['Db5', .5], ['Bb4', .5], ['Ab4', 1], ['F4', 1]], [['Ab4', 1.5], ['Bb4', .5], ['C5', 1], ['Eb5', 1]],
  [['Db5', 1.5], ['Bb4', .5], ['Gb4', 1], ['F4', 1]], [['Eb4', 2], [null, 2]],
  [[null, .5], ['Bb4', .5], ['Db5', .5], ['F5', .5], ['Ab5', 1], ['F5', 1]], [['Eb5', 1], ['C5', .5], ['Ab4', .5], ['F4', 2]],
  [['Gb4', .5], ['Ab4', .5], ['Bb4', .5], ['Db5', .5], ['F5', 1], ['Eb5', 1]], [['C5', 3], [null, 1]],
];
const PIANO_MEL = [
  [['Bb5', .5], ['Gb5', .5], ['F5', 1], ['Db5', 1], ['Eb5', 1]], [['F5', 2], ['C5', 1], ['Eb5', 1]],
  [['Ab5', 1], ['F5', .5], ['Eb5', .5], ['C5', 1], ['Ab4', 1]], [['Bb4', 2], ['Db5', 2]],
  [['Bb5', .5], ['Gb5', .5], ['F5', 1], ['Db5', .5], ['Eb5', .5], ['F5', 1]], [['Gb5', 1.5], ['F5', .5], ['Eb5', 1], ['C5', 1]],
  [['Eb5', 1], ['F5', 1], ['Ab5', 1], ['C6', 1]], [['Bb5', 3], [null, 1]],
];
checkBars('trumpet', TRUMPET); checkBars('piano', PIANO_MEL);

const FORM = [['Intro', 4, LOOP_A], ['A', 16, LOOP_A], ['B', 16, LOOP_B], ['Break', 8, LOOP_B], ['A2', 16, LOOP_A], ['B2', 8, LOOP_B], ['Outro', 4, LOOP_A]];

export default function () {
  const s = new Session({ bpm: 86 });
  const BAR = s.bar, S16 = TPB / 4, SW = 0.14; // swing: every second 16th is late by 14% of a 16th
  const h = human(rng(86));
  const eq = (type, freq, gain = 0, q = 0.7) => ({ plugin: 'eq_1band', params: { type, freq, gain, q } });
  const swung = step => step * S16 + (step % 2 ? SW * S16 : 0);

  s.reverb('Room', 'room_reverb', { decay: 1.4, pre_delay: 12, damping: 9000, size: 55, low_cut: 300 });
  const pno = s.instrument('Piano', { zones: 'piano', sampler: { attack: 0.5, release: 350, velocity: 40 }, sends: { Room: -10 }, volume: 0,
    inserts: [eq(3, 60), eq(0, 350, -3, 1), eq(4, 7000), { plugin: 'saturator', params: { drive: 4, mix: 35 } }] });
  const bass = s.instrument('Bass', { synth: { plugin: 'subtractive_synth', params: { osc1_wave: 2, osc2_wave: 3, osc2_semitones: 0, osc2_detune: 4, osc_mix: 35, cutoff: 900, resonance: 10, filter_env_amount: 20, filter_decay: 200, filter_sustain: 40, amp_attack: 4, amp_decay: 400, amp_sustain: 75, amp_release: 120, glide: 0, level: -6 } },
    inserts: [eq(3, 30), { plugin: 'saturator', params: { drive: 3, mix: 30 } }], volume: 0 });
  const kit = s.instrument('Drums', { synth: { plugin: 'drum_synth', params: { level: -6, kick_decay: 420, kick_tune: -4, snare_snappy: 55, snare_decay: 200, snare_tune: -2, hat_decay: 35, open_hat_decay: 260 } },
    inserts: [eq(4, 9000), { plugin: 'compressor', params: { threshold: -16, ratio: 3, attack: 10, release: 140, makeup: 2 } }], sends: { Room: -14 }, volume: -2 });
  const perc = s.instrument('Perc', { zones: 'perc', oneShot: true, sampler: { attack: 0.5, release: 300, velocity: 60 }, sends: { Room: -12 }, volume: 2, pan: 0.3 });
  const tp = s.instrument('Trumpet', { zones: 'trumpet_harmon', sampler: { attack: 35, release: 300, velocity: 40, level: 8 }, sends: { Room: -6 }, volume: 0, pan: -0.1,
    inserts: [eq(0, 3000, -4, 1), eq(4, 6500)] }); // harmon mute buzz: measured 29% of energy above 4 kHz
  const pz = s.instrument('Pizz', { zones: 'violins_pizz', oneShot: true, sampler: { attack: 0.5, release: 400, velocity: 50, level: 10 }, sends: { Room: -6 }, volume: 0, pan: 0.35 });
  const pad = s.instrument('Pad', { synth: { plugin: 'subtractive_synth', params: { osc1_wave: 0, osc2_wave: 0, osc2_detune: 12, osc_mix: 50, cutoff: 1300, resonance: 8, filter_env_amount: 10, amp_attack: 600, amp_decay: 800, amp_sustain: 85, amp_release: 1200, level: -12 } },
    inserts: [{ plugin: 'chorus', params: { rate: 0.35, depth: 45, mix: 45 } }, eq(3, 200)], sends: { Room: -6 }, volume: 2, pan: -0.2 });
  s.master('eq_1band', { type: 0, freq: 450, gain: -3.5, q: 0.8 });
  s.master('eq_1band', { type: 2, freq: 3000, gain: -5 }); // lo-fi: a darker top (trumpet, hats and tambourine measured bright)
  s.master('maximizer', { threshold: -7, ceiling: -1 });

  let pv = null;
  // Neo-soul comping: chord on 1 (held), a short push on the swung "a" of 2, a ghost on 4.
  const comp = (t0, ch, vel, sparse = false) => {
    pv = voice(ch, 4, 55, 74, pv);
    pv.forEach((p, k) => pno.note(p, t0 + k * 18 + h.t(8), 6 * S16, vel + h.v()));
    if (sparse) return;
    pv.forEach((p, k) => pno.note(p, t0 + swung(7) + k * 12 + h.t(8), 2 * S16, vel - 8 + h.v()));
    pv.slice(1).forEach(p => pno.note(p, t0 + swung(12) + h.t(8), 2 * S16, vel - 18 + h.v()));
  };
  const bassline = (t0, ch, next, vel) => {
    const r = bassNote(ch, 34, 46);
    bass.note(r, t0 + h.t(5), 5 * S16, vel + h.v());
    bass.note(r + 12, t0 + swung(6) + h.t(5), 2 * S16, vel - 10 + h.v());
    bass.note(r + 7 > 46 ? r - 5 : r + 7, t0 + swung(10), 2 * S16, vel - 6 + h.v());
    const n = bassNote(next, 34, 46);
    bass.note(n + (n > r ? -1 : 1), t0 + swung(14), S16 * 1.6, vel - 8 + h.v()); // chromatic approach to the next root
  };
  const beat = (t0, vel, { kick = true, snare = true, hats = true, fill = false } = {}) => {
    const p = {};
    if (kick) p[36] = 'X......x..X.....';
    if (snare) p[38] = fill ? '....X.......X.xx' : '....X.......X...';
    if (hats) p[42] = 'x.o.x.o.x.o.x.ox';
    drums(kit, t0, p, { vel, swing: SW, h });
    if (hats) drums(perc, t0, { 54: '..o...o...o...o.', 60: '..........x.....' }, { vel: vel - 25, swing: SW, h });
  };
  const pizzMotif = (t0, ch, vel) => {
    const v = voice(ch, 4, 67, 84);
    [[0, 0], [3, 1], [6, 2], [8, 3], [11, 2], [14, 1]].forEach(([st, k]) => pz.note(v[k], t0 + swung(st) + h.t(6), 2 * S16, vel + h.v()));
  };

  const sections = {};
  let bar = 0;
  for (const [name, len, loop] of FORM) {
    sections[name] = [bar + 1, bar + len];
    for (let i = 0; i < len; i++) {
      const t0 = (bar + i) * BAR;
      const ch = barChords(loop[i % 4])[0].ch, next = barChords(loop[(i + 1) % 4])[0].ch;
      switch (name) {
        case 'Intro': comp(t0, ch, 46 + i * 2, i < 2); if (i === 3) drums(kit, t0 + 3 * TPB, { 38: 'x.xx' }, { vel: 70, swing: SW, h }); break;
        case 'A': // beat builds over four bars: hats, then kick, then the whole kit
          comp(t0, ch, 50); bassline(t0, ch, next, i < 2 ? 70 : 84);
          beat(t0, 92, { kick: i >= 1, snare: i >= 2, hats: true, fill: i % 8 === 7 });
          break;
        case 'B': comp(t0, ch, 44, i % 2 === 1); bassline(t0, ch, next, 84); beat(t0, 92, { fill: i % 8 === 7 }); break;
        case 'Break':
          pizzMotif(t0, ch, 60); pad.note(bassNote(ch, 48, 59), t0, BAR - 60, 70); voice(ch, 3, 60, 72).forEach(p => pad.note(p, t0, BAR - 60, 64));
          bass.note(bassNote(ch, 34, 46), t0, BAR - 100, 72);
          drums(kit, t0, { 42: 'x.o.x.o.x.o.x.o.' }, { vel: 70, swing: SW, h });
          if (i === 7) drums(kit, t0 + 2 * TPB, { 38: 'x.x.xxxx', 36: 'x...x...' }, { vel: 85, swing: SW, h });
          break;
        case 'A2': comp(t0, ch, 46, true); bassline(t0, ch, next, 84); beat(t0, 94, { fill: i % 8 === 7 }); if (i >= 8) pizzMotif(t0, ch, 50); break;
        case 'B2': comp(t0, ch, 46, i % 2 === 1); bassline(t0, ch, next, 84); beat(t0, 94, { fill: i === 7 }); break;
        case 'Outro':
          comp(t0, ch, 46 - i * 3, true);
          if (i === 0) bass.note(bassNote(ch, 34, 46), t0, BAR, 70);
          if (i === 3) { pv = voice(chordOf('Dbmaj9'), 5, 56, 77); pv.forEach((p, k) => pno.note(p, t0 + 2 * TPB + k * 60, 2 * BAR, 44)); }
          break;
      }
    }
    const t0 = bar * BAR;
    if (name === 'B') melody(tp, t0, TRUMPET.concat(TRUMPET), 70, { h, lift: 0.4, legato: 30 });
    if (name === 'B2') melody(tp, t0, TRUMPET, 72, { h, lift: 0.4, legato: 30 });
    if (name === 'A2') melody(pno, t0, PIANO_MEL.concat(PIANO_MEL), 66, { h, lift: 0.3, legato: 30 });
    bar += len;
  }
  return { session: s, endTicks: (bar + 2) * BAR, sections };
}
const chordOf = sym => barChords(sym)[0].ch;
