// Neon Bhairav: cyberpunk with Indian fusion (original composition).
// Render: node tools/render.mjs pieces/neon-bhairav.mjs --stems
// 100 BPM, raga Bhairav on C (C Db E F G Ab B): the dawn raga's flat 2nd and 6th over dark synths.
// Synth lead with glide slides between notes like meend, doubled by oboe as shehnai; hand drums play tabla-style runs.
// Form: Intro 8 | Verse 16 | Drop 16 | Break 8 (tabla + alaap) | Build 8 | Drop2 16 (lead up an octave) | Outro 8

import { Session, TPB, ZONES, rng } from '../tools/lib/session.mjs';
import { barChords, voice, bassNote, human, melody, checkBars, drums } from '../tools/lib/music.mjs';

const LOOP = ['C', 'Db', 'Fm', 'C', 'Ab', 'Db', 'Fm', 'C'];
const LEAD = [
  [['G4', 1.5], ['Ab4', .5], ['G4', 1], ['E4', 1]], [['F4', 1], ['E4', .5], ['Db4', .5], ['C4', 2]],
  [['C5', 1], ['B4', .5], ['C5', .5], ['Ab4', 1], ['F4', 1]], [['G4', 3], [null, 1]],
  [['Ab4', .5], ['B4', .5], ['C5', 1], ['Db5', 1], ['C5', 1]], [['B4', .5], ['C5', .5], ['Ab4', 1], ['G4', 2]],
  [['F4', 1], ['Ab4', .5], ['G4', .5], ['F4', 1], ['E4', 1]], [['Db4', 1], ['E4', .5], ['Db4', .5], ['C4', 2]],
  [['C5', 1.5], ['Db5', .5], ['C5', 1], ['B4', 1]], [['Ab4', 1], ['G4', .5], ['Ab4', .5], ['F4', 2]],
  [['G4', .5], ['Ab4', .5], ['B4', .5], ['C5', .5], ['Db5', 1], ['E5', 1]], [['C5', 3], [null, 1]],
  [['E5', .5], ['F5', .5], ['E5', .5], ['Db5', .5], ['C5', 1], ['B4', 1]], [['Ab4', 1], ['B4', .5], ['Ab4', .5], ['G4', 2]],
  [['F4', .5], ['G4', .5], ['Ab4', .5], ['G4', .5], ['F4', 1], ['E4', 1]], [['C4', 4]],
];
const ALAAP = [ // oboe, free and slow, over the drone in the Break
  [[null, 2], ['G4', 2]], [[['Ab4', 'B4'], 3], ['G4', 1]], [['F4', 2], ['E4', 2]], [[['Db4', 'E4'], 4]],
  [[null, 1], ['E4', 1], ['F4', 1], ['G4', 1]], [[['Ab4', 'G4'], 2], ['B4', 2]], [['C5', 4]], [[null, 4]],
];
checkBars('lead', LEAD); checkBars('alaap', ALAAP);

const FORM = [['Intro', 8], ['Verse', 16], ['Drop', 16], ['Break', 8], ['Build', 8], ['Drop2', 16], ['Outro', 8]];

export default function () {
  const s = new Session({ bpm: 100 });
  const BAR = s.bar, S16 = TPB / 4;
  const h = human(rng(1010));
  const eq = (type, freq, gain = 0, q = 0.7) => ({ plugin: 'eq_1band', params: { type, freq, gain, q } });
  const syn = params => ({ plugin: 'subtractive_synth', params });

  s.reverb('Hall', 'plate_reverb', { decay: 2.6, pre_delay: 20, damping: 9000, size: 75, low_cut: 300 });
  const drone = s.instrument('Drone', { synth: syn({ osc1_wave: 0, osc2_wave: 0, osc2_detune: 3, osc_mix: 50, cutoff: 650, resonance: 15, filter_env_amount: 5, amp_attack: 1500, amp_decay: 1000, amp_sustain: 90, amp_release: 2000, level: -10 }),
    inserts: [{ plugin: 'chorus', params: { rate: 0.2, depth: 30, mix: 35 } }], sends: { Hall: -8 }, volume: 1 });
  const bass = s.instrument('Bass', { synth: syn({ osc1_wave: 0, osc2_wave: 1, osc2_semitones: -12, osc2_detune: 0, osc_mix: 50, cutoff: 320, resonance: 30, filter_env_amount: 55, filter_decay: 120, filter_sustain: 10, amp_attack: 1, amp_decay: 180, amp_sustain: 40, amp_release: 60, level: -8 }),
    inserts: [{ plugin: 'saturator', params: { drive: 5, mix: 45 } }, eq(3, 30)], volume: 8 });
  const arp = s.instrument('Arp', { synth: syn({ osc1_wave: 1, osc2_wave: 0, osc2_detune: 6, osc_mix: 40, cutoff: 1800, resonance: 35, filter_env_amount: 40, filter_decay: 150, filter_sustain: 15, amp_attack: 1, amp_decay: 160, amp_sustain: 20, amp_release: 120, level: -12 }),
    inserts: [{ plugin: 'mod_delay', params: { time: 450, feedback: 30, mix: 22 } }, eq(3, 200)], sends: { Hall: -12 }, volume: 10, pan: 0.25 });
  const pad = s.instrument('Pad', { synth: syn({ osc1_wave: 0, osc2_wave: 0, osc2_detune: 14, osc_mix: 50, cutoff: 1500, resonance: 10, filter_env_amount: 10, amp_attack: 800, amp_decay: 1000, amp_sustain: 85, amp_release: 1500, level: -12 }),
    inserts: [{ plugin: 'chorus', params: { rate: 0.3, depth: 50, mix: 50 } }, eq(3, 180)], sends: { Hall: -6 }, volume: 5, pan: -0.2 });
  const lead = s.instrument('Lead', { synth: syn({ osc1_wave: 0, osc2_wave: 1, osc2_detune: 8, osc_mix: 45, cutoff: 3000, resonance: 20, filter_env_amount: 25, filter_decay: 300, filter_sustain: 50, amp_attack: 5, amp_decay: 300, amp_sustain: 80, amp_release: 200, glide: 70, level: -10 }),
    inserts: [{ plugin: 'saturator', params: { drive: 3, mix: 30 } }, { plugin: 'mod_delay', params: { time: 300, feedback: 25, mix: 18 } }], sends: { Hall: -10 }, volume: 8 });
  const ob = s.instrument('Shehnai', { zones: 'oboe', sampler: { attack: 25, release: 250, velocity: 45, level: 8 }, sends: { Hall: -6 }, volume: -3, pan: 0.1, inserts: [eq(2, 4500, 2)] });
  const kit = s.instrument('Drums', { synth: { plugin: 'drum_synth', params: { level: -6, kick_decay: 480, kick_tune: -3, snare_snappy: 85, snare_decay: 230, hat_decay: 40, open_hat_decay: 280, tom_tune: -2, cymbal_decay: 2200 } },
    inserts: [{ plugin: 'compressor', params: { threshold: -16, ratio: 4, attack: 5, release: 100, makeup: 3 } }], sends: { Hall: -16 }, volume: -3 });
  const tabla = s.instrument('Tabla', { zones: 'perc', oneShot: true, sampler: { attack: 0.5, release: 400, velocity: 60 }, sends: { Hall: -12 }, volume: -4, pan: -0.15 });
  s.master('eq_1band', { type: 0, freq: 450, gain: -2.5, q: 0.8 });
  s.master('maximizer', { threshold: -5, ceiling: -1.5 });

  const sec = k => ZONES.perc.find(z => z.root === k).seconds * TPB * 100 / 60;
  const swellInto = t => tabla.note(55, t - sec(55) + TPB / 2, sec(55), 90);
  const droneBar = (t0, vel) => { drone.note('C2', t0, BAR - 30, vel); drone.note('G2', t0 + 20, BAR - 50, vel - 6); };
  // Rolling bass: off-beat 16ths around the root, the "dark synth" gallop.
  const rolling = (t0, ch, vel) => { const r = bassNote(ch, 24, 35); [...'X.xxX.xxX.xxX.xx'].forEach((c, i) => { if (c !== '.') bass.note(r + (i === 14 ? 12 : 0), t0 + i * S16, S16 * 0.9, (c === 'X' ? vel + 10 : vel) + h.v()); }); };
  let av = null, pv = null;
  const arpBar = (t0, ch, vel) => { av = voice(ch, 4, 60, 79, av); [0, 2, 1, 3, 2, 0, 3, 1, 0, 2, 1, 3, 2, 3, 1, 2].forEach((k, i) => arp.note(av[k], t0 + i * S16 + h.t(3), S16 * 0.8, vel + (i % 4 === 0 ? 10 : 0) + h.v(3))); };
  const padBar = (t0, ch, vel) => { pv = voice(ch, 3, 55, 72, pv); pv.forEach(p => pad.note(p, t0 + 10, BAR - 40, vel)); };
  const fourFloor = (t0, vel, fill = false) => drums(kit, t0, { 36: 'X...X...X...X...', 38: fill ? '....X.......XxXX' : '....X.......X...', 42: 'oxo.oxo.oxo.oxox', 46: '..x...x...x...x.' }, { vel, h });
  const halfBeat = (t0, vel) => drums(kit, t0, { 36: 'X.........X.....', 38: '........X.......', 42: 'x.o.x.o.x.o.x.o.' }, { vel, h });
  // Tabla-style runs: 41 tumba (bayan, low), 43 conga, 45 quinto (dayan, "na"), 46 slap ("te").
  const TABLA = [
    { 41: 'X.....x.X.......', 45: '..x.x.....x.x.x.', 46: '.x.....x...x...x' }, { 41: 'X..x..x.X.......', 45: 'x.xx.xx...x.xx.x', 46: '........x.......' },
    { 41: 'X.......X..x....', 43: '..x.x.......x.x.', 45: 'x...x.xx.x..x.xx' }, { 41: 'X.x.X.x.x.X.x.X.', 45: '.x.x.x.x.x.x.x.x', 46: 'x...x...x...x...' },
  ];
  const tablaBar = (t0, i, vel) => drums(tabla, t0, TABLA[i % 4], { vel, h });

  const sections = {};
  let bar = 0;
  for (const [name, len] of FORM) {
    sections[name] = [bar + 1, bar + len];
    for (let i = 0; i < len; i++) {
      const t0 = (bar + i) * BAR;
      const ch = barChords(LOOP[i % 8])[0].ch;
      switch (name) {
        case 'Intro':
          droneBar(t0, 50 + i * 3);
          if (i >= 2) arpBar(t0, ch, 46 + i * 4);
          if (i === 0) { tabla.note(52, t0, 4 * BAR, 80); tabla.note(36, t0, BAR, 90); }
          if (i === 7) { swellInto(t0 + BAR); drums(tabla, t0 + 2 * TPB, { 41: 'X.x.X.x.', 45: '.x.xxxxx' }, { vel: 88, h }); } // pickup into the verse
          break;
        case 'Verse':
          droneBar(t0, 70); arpBar(t0, ch, 76);
          rolling(t0, ch, i < 4 ? 62 + i * 5 : 82);
          halfBeat(t0, i < 2 ? 68 + i * 8 : 96);
          if (i >= 4) tablaBar(t0, i, 70);
          if (i === 15) { drums(kit, t0 + 2 * TPB, { 38: 'xxxxXXXX' }, { vel: 95, h, step: S16 }); swellInto(t0 + BAR); }
          break;
        case 'Drop': case 'Drop2':
          droneBar(t0, 74); arpBar(t0, ch, 84); padBar(t0, ch, name === 'Drop2' ? 76 : 68);
          rolling(t0, ch, 92);
          fourFloor(t0, 102, i % 8 === 7);
          tablaBar(t0, i, name === 'Drop2' ? 82 : 74);
          if (i % 8 === 0) { kit.note(49, t0, 2 * BAR, 110); tabla.note(36, t0, BAR, 110); }
          if (name === 'Drop2' && i === 0) tabla.note(52, t0, 4 * BAR, 105);
          break;
        case 'Break':
          droneBar(t0, 76); padBar(t0, ch, 60);
          tablaBar(t0, i, 84 + (i >= 6 ? 8 : 0));
          if (i === 7) drums(tabla, t0, { 41: 'X.X.X.X.XXXXXXXX', 45: 'x.x.x.x.xxxxxxxx' }, { vel: 100, h }); // tihai-like run out
          break;
        case 'Build':
          droneBar(t0, 74); arpBar(t0, ch, 70 + i * 4); padBar(t0, ch, 56 + i * 3);
          rolling(t0, ch, 76 + i * 2);
          drums(kit, t0, { 36: 'X...X...X...X...', 38: i < 4 ? '..x...x...x...x.' : 'x.x.x.x.x.x.x.x.' }, { vel: 70 + i * 5, h });
          if (i === 7) { drums(kit, t0, { 38: 'xxxxxxxxXXXXXXXX' }, { vel: 105, h }); swellInto(t0 + BAR); }
          break;
        case 'Outro':
          droneBar(t0, 70 - i * 6);
          if (i < 6) arpBar(t0, ch, 76 - i * 7);
          if (i < 4) halfBeat(t0, 86 - i * 6);
          if (i === 7) { tabla.note(52, t0, 4 * BAR, 85); tabla.note(36, t0, BAR, 95); }
          break;
      }
    }
    const t0 = bar * BAR;
    if (name === 'Verse') melody(ob, t0, LEAD.slice(0, 8).concat(LEAD.slice(0, 8)), 70, { h, lift: 0.3, legato: 20 });
    if (name === 'Drop') { melody(lead, t0, LEAD, 92, { h, lift: 0.2, legato: 0 }); melody(ob, t0, LEAD, 74, { h, lift: 0.3, legato: 20 }); }
    if (name === 'Drop2') { melody(lead, t0, LEAD, 96, { h, lift: 0.2, legato: 0, shift: 12 }); melody(ob, t0, LEAD, 78, { h, lift: 0.3, legato: 20 }); }
    if (name === 'Break') melody(ob, t0, ALAAP, 70, { h, lift: 0.3, legato: 20, grace: 80 });
    if (name === 'Outro') melody(ob, t0, LEAD.slice(4, 8).concat([[[null, 4]], [[null, 4]], [[null, 4]], [[null, 4]]]), 66, { h, lift: 0.3, legato: 20 });
    bar += len;
  }
  return { session: s, endTicks: (bar + 5) * BAR, sections }; // the closing gong needs ~10 s
}
