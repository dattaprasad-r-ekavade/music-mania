// Future Lab: a sound-design palette for western / futuristic pieces (owner's request 2026-10-22), not a release.
// Render: node tools/render.mjs pieces/future-lab.mjs
// 110 BPM, D minor. Stations, each named in `sections` so measure.py prints its level:
//   electric violin (four signal chains on the Iowa solo violin), brass from trumpet down to tuba (solo, section,
//   choir, braam, stabs), metallic percussion (raw and processed), synths, then a 16-bar groove that uses them together.

import { Session, TPB, rng } from '../tools/lib/session.mjs';
import { barChords, voice, bassNote, human, melody, checkBars, drums } from '../tools/lib/music.mjs';

const VLN = [
  [['D5', 1], ['F5', .5], ['A5', .5], ['G5', 1], ['F5', .5], ['E5', .5]], [['F5', 1.5], ['E5', .5], ['D5', 2]],
  [['A5', .5], ['Bb5', .5], ['A5', .5], ['G5', .5], ['F5', 1], ['E5', 1]], [['D5', 3], [null, 1]],
];
const BRASS = [[['D4', 1], ['F4', 1], ['A4', 2]], [['G4', 1.5], ['F4', .5], ['D4', 2]]];
const LOOP = ['Dm', 'Bb', 'F', 'C'];
checkBars('violin', VLN); checkBars('brass', BRASS);

export default function () {
  const s = new Session({ bpm: 110 });
  const BAR = s.bar, S16 = TPB / 4, BEAT = 60000 / 110;
  const h = human(rng(2210));
  const eq = (type, freq, gain = 0, q = 0.7) => ({ plugin: 'eq_1band', params: { type, freq, gain, q } });
  const syn = params => ({ plugin: 'subtractive_synth', params });
  const delay = (beats, feedback, mix) => ({ plugin: 'mod_delay', params: { time: Math.round(BEAT * beats), feedback, mix, lpf: 7000 } });

  s.reverb('Hall', 'plate_reverb', { decay: 2.4, pre_delay: 20, damping: 9000, size: 70, low_cut: 250 });
  s.master('maximizer', { threshold: -3, ceiling: -1.5 });

  // Electric violin: the Iowa solo violin through amp-like chains. Iowa is dry and mono: pan and send it.
  const vn = { zones: 'violin_solo', sampler: { attack: 12, release: 220, velocity: 40, level: 4 }, sends: { Hall: -10 }, pan: 0.1 };
  const evClean = s.instrument('EVClean', { ...vn, inserts: [eq(3, 180), delay(0.75, 25, 18)] });
  const evDrive = s.instrument('EVDrive', { ...vn, volume: -4.5, inserts: [eq(3, 220), { plugin: 'saturator', params: { drive: 16, tone: 6500, mix: 75 } }, { plugin: 'chorus', params: { rate: 0.4, depth: 25, mix: 25 } }, delay(0.75, 30, 20)] });
  const evOct = s.instrument('EVOctave', { ...vn, volume: -1, inserts: [eq(3, 120), { plugin: 'pitch_shifter', params: { semitones: -12, mix: 40 } }, { plugin: 'saturator', params: { drive: 10, tone: 5000, mix: 60 } }, delay(0.75, 25, 18)] });
  const evPhase = s.instrument('EVPhaser', { ...vn, inserts: [eq(3, 220), { plugin: 'saturator', params: { drive: 8, tone: 8000, mix: 50 } }, { plugin: 'phaser', params: { rate: 0.35, depth: 80, stages: 3, feedback: 55, mix: 55 } }, delay(0.5, 35, 22)] });
  const evSaw = s.instrument('EVSawLayer', { synth: syn({ osc1_wave: 0, osc2_wave: 0, osc2_detune: 7, osc_mix: 50, cutoff: 2400, resonance: 15, filter_env_amount: 20, filter_decay: 250, filter_sustain: 60, amp_attack: 15, amp_decay: 300, amp_sustain: 80, amp_release: 200, glide: 40, level: -16 }),
    inserts: [eq(3, 250), { plugin: 'chorus', params: { rate: 0.5, depth: 40, mix: 40 } }], sends: { Hall: -12 }, volume: -4, pan: -0.15 });

  // Brass by size. Iowa (solo, ff only, very different raw levels: RULES 4e) and VSCO sections.
  const solo = (zones, volume, pan) => s.instrument(zones.replace(/_/g, ''), { zones, sampler: { attack: 20, release: 260, velocity: 30, level: 6 }, sends: { Hall: -9 }, volume, pan, maxShift: 7 });
  const tpS = solo('trumpet_iowa', 1, 0.2), hnS = solo('horns_iowa', 2, -0.2), tbS = solo('trombone_iowa', 12, 0.15), tuS = solo('tuba_iowa', 4, -0.1);
  const sect = (zones, volume, pan, extra = {}) => s.instrument(zones.replace(/_/g, '') + 'Sec', { zones, sampler: { attack: 15, release: 300, velocity: 45, level: 2 }, sends: { Hall: -7 }, volume, pan, maxShift: 7, ...extra });
  const tp = sect('trumpet', -3, 0.25), hn = sect('horns', 3, -0.3), tb = sect('trombones', 12, 0.3, { sampler: { attack: 15, release: 300, velocity: 45, level: 6 } }), tu = sect('tuba', 12, 0);
  const tpSt = sect('trumpet_stac', 0, 0.25, { oneShot: true }), hnSt = sect('horns_stac', 2, -0.3, { oneShot: true }), tbSt = sect('trombones_stac', 0, 0.3, { oneShot: true }), tuSt = sect('tuba_stac', 2, 0, { oneShot: true });
  // Braam: low brass an octave down again, driven. The trailer horn.
  const braam = s.instrument('Braam', { zones: 'trombones', sampler: { attack: 60, release: 900, velocity: 30, level: 4 }, sends: { Hall: -5 }, volume: 0, maxShift: 7,
    inserts: [{ plugin: 'pitch_shifter', params: { semitones: -12, mix: 45 } }, { plugin: 'saturator', params: { drive: 12, tone: 4000, mix: 60 } }, eq(3, 35)] });

  // Metallic percussion.
  const pitched = (zones, volume, extra = {}, name = zones.replace(/_/g, '')) => s.instrument(name, { zones, oneShot: true, sampler: { attack: 0.5, release: 600, velocity: 50 }, sends: { Hall: -10 }, volume, ...extra });
  const crot = pitched('crotales', 5, { pan: 0.3 }), vib = pitched('vibes_hard', 3, { pan: -0.2 }), gong = pitched('thai_gong', 0);
  const vibBow = s.instrument('VibesBow', { zones: 'vibes_bow', sampler: { attack: 200, release: 1200, velocity: 30, level: 6 }, sends: { Hall: -6 }, volume: -3 });
  const perc = s.instrument('Perc', { zones: 'perc', oneShot: true, sampler: { attack: 0.5, release: 500, velocity: 60 }, sends: { Hall: -12 }, volume: 4 });
  const phil = s.instrument('PhilPerc', { zones: 'phil_perc', oneShot: true, sampler: { attack: 0.5, release: 600, velocity: 50 }, sends: { Hall: -10 }, volume: 8 });
  const metalFX = pitched('crotales', 12, { inserts: [{ plugin: 'rectifier', params: { mode: 1, mix: 45 } }, { plugin: 'flanger', params: { rate: 0.15, depth: 80, feedback: 70, mix: 50 } }, delay(0.75, 45, 30)] }, 'MetalFX');
  const gongDown = pitched('thai_gong', 5, { inserts: [{ plugin: 'pitch_shifter', params: { semitones: -12, mix: 100 } }, eq(3, 40)] }, 'GongDown');
  const anvilDly = s.instrument('AnvilDelay', { zones: 'perc', oneShot: true, sampler: { attack: 0.5, release: 400, velocity: 60 }, sends: { Hall: -14 }, volume: 11, pan: -0.25, inserts: [eq(2, 2500, -3), delay(0.75, 40, 35)] });
  const kit = s.instrument('Drums', { synth: { plugin: 'drum_synth', params: { level: -6, kick_decay: 520, kick_tune: -4, snare_snappy: 80, snare_decay: 220, hat_decay: 35, open_hat_decay: 260, cymbal_decay: 2000 } },
    inserts: [{ plugin: 'compressor', params: { threshold: -16, ratio: 4, attack: 5, release: 100, makeup: 3 } }], sends: { Hall: -16 }, volume: 3 });

  // Synths.
  const pad = s.instrument('Pad', { synth: syn({ osc1_wave: 0, osc2_wave: 0, osc2_detune: 14, osc_mix: 50, cutoff: 1400, resonance: 10, filter_env_amount: 10, amp_attack: 700, amp_decay: 1000, amp_sustain: 85, amp_release: 1500, level: -12 }),
    inserts: [{ plugin: 'chorus', params: { rate: 0.3, depth: 50, mix: 50 } }, eq(3, 180)], sends: { Hall: -6 }, volume: 11, pan: -0.15 });
  const arp = s.instrument('Arp', { synth: syn({ osc1_wave: 1, osc2_wave: 0, osc2_detune: 6, osc_mix: 40, cutoff: 1900, resonance: 35, filter_env_amount: 40, filter_decay: 150, filter_sustain: 15, amp_attack: 1, amp_decay: 160, amp_sustain: 20, amp_release: 120, level: -12 }),
    inserts: [delay(0.75, 35, 25), eq(3, 220)], sends: { Hall: -12 }, volume: 12, pan: 0.3 });
  const bass = s.instrument('Bass', { synth: syn({ osc1_wave: 0, osc2_wave: 1, osc2_semitones: -12, osc_mix: 50, cutoff: 300, resonance: 30, filter_env_amount: 55, filter_decay: 120, filter_sustain: 10, amp_attack: 1, amp_decay: 180, amp_sustain: 40, amp_release: 60, level: -8 }),
    inserts: [{ plugin: 'saturator', params: { drive: 5, mix: 45 } }, eq(3, 30)], volume: 12 });
  const lead = s.instrument('SynthLead', { synth: syn({ osc1_wave: 0, osc2_wave: 1, osc2_detune: 8, osc_mix: 45, cutoff: 3000, resonance: 20, filter_env_amount: 25, filter_decay: 300, filter_sustain: 50, amp_attack: 5, amp_sustain: 80, amp_release: 200, glide: 90, level: -12 }),
    inserts: [delay(0.75, 30, 20)], sends: { Hall: -10 }, volume: 12 });
  const trem = s.instrument('TremPhaser', { zones: 'violins_trem', sampler: { attack: 80, release: 500, velocity: 40, level: 4 }, sends: { Hall: -8 }, volume: 0,
    inserts: [{ plugin: 'phaser', params: { rate: 0.25, depth: 90, stages: 4, feedback: 60, mix: 60 } }, eq(3, 200)] });

  // Shared figures.
  const chordsOf = i => barChords(LOOP[i % 4])[0].ch;
  let pv = null, bv = null;
  const padBar = (t0, i, vel) => { pv = voice(chordsOf(i), 3, 55, 72, pv); pv.forEach(p => pad.note(p, t0 + 10, BAR - 40, vel)); };
  const arpBar = (t0, i, vel) => { const v = voice(chordsOf(i), 4, 62, 81); [0, 2, 1, 3, 2, 0, 3, 1, 0, 2, 1, 3, 2, 3, 1, 2].forEach((k, j) => arp.note(v[k], t0 + j * S16 + h.t(3), S16 * 0.8, vel + (j % 4 === 0 ? 10 : 0))); };
  const bassBar = (t0, i, vel) => { const r = bassNote(chordsOf(i), 26, 37); [...'X..xX.x.X..xX.xx'].forEach((c, j) => { if (c !== '.') bass.note(r + (j === 15 ? 12 : 0), t0 + j * S16, S16 * 0.9, (c === 'X' ? vel + 10 : vel) + h.v()); }); };
  const choirBar = (t0, i, vel, len = BAR) => {
    const ch = chordsOf(i);
    bv = voice(ch, 4, 55, 76, bv);
    tp.note(bv[3], t0, len - 60, vel); hn.note(bv[2], t0, len - 60, vel); hn.note(bv[1], t0 + 10, len - 60, vel - 4);
    tb.note(bv[0] - 12, t0, len - 60, vel); tu.note(bassNote(ch, 31, 43), t0, len - 60, vel);
  };
  const stabBar = (t0, i, vel, rhythm = 'X..X..X...X.X...') => {
    const ch = chordsOf(i), v = voice(ch, 4, 58, 76);
    [...rhythm].forEach((c, j) => {
      if (c === '.') return;
      const t = t0 + j * S16;
      tpSt.note(v[3], t, S16 * 1.5, vel); hnSt.note(v[1], t, S16 * 1.5, vel); hnSt.note(v[2], t, S16 * 1.5, vel - 4);
      tbSt.note(v[0] - 12, t, S16 * 1.5, vel); tuSt.note(bassNote(ch, 31, 43), t, S16 * 1.5, vel);
    });
  };
  const braamHit = (t0, vel, len = 2 * BAR) => { for (const p of ['D2', 'A2', 'D3', 'F3']) braam.note(p, t0, len, vel); tuS.note('D2', t0, len, vel); perc.note(52, t0, len, vel); };

  // Stations: [name, bars, fn(t0)].
  const STATIONS = [
    ['EV clean', 4, t => melody(evClean, t, VLN, 85, { h, legato: 20 })],
    ['EV drive', 4, t => melody(evDrive, t, VLN, 85, { h, legato: 20 })],
    ['EV octave', 4, t => melody(evOct, t, VLN, 85, { h, legato: 20 })],
    ['EV phaser', 4, t => melody(evPhase, t, VLN, 85, { h, legato: 20 })],
    ['EV drive+saw', 4, t => { melody(evDrive, t, VLN, 85, { h, legato: 20 }); melody(evSaw, t, VLN, 90, { legato: 0 }); }],
    ['Trumpet solo', 2, t => melody(tpS, t, BRASS, 90, { h, shift: 12 })],
    ['Horn solo', 2, t => melody(hnS, t, BRASS, 90, { h })],
    ['Trombone solo', 2, t => melody(tbS, t, BRASS, 90, { h, shift: -12 })],
    ['Tuba solo', 2, t => melody(tuS, t, BRASS, 90, { h, shift: -24 })],
    ['Trumpets sect', 2, t => melody(tp, t, BRASS, 90, { h, shift: 12 })],
    ['Horns sect', 2, t => melody(hn, t, BRASS, 90, { h })],
    ['Trombones sect', 2, t => melody(tb, t, BRASS, 90, { h, shift: -12 })],
    ['Tuba sect', 2, t => melody(tu, t, BRASS, 90, { h, shift: -24 })],
    ['Brass choir', 4, t => { for (let i = 0; i < 4; i++) choirBar(t + i * BAR, i, 80 + i * 6); }],
    ['Braam', 3, t => braamHit(t, 110)],
    ['Brass stabs', 4, t => { for (let i = 0; i < 4; i++) stabBar(t + i * BAR, i, 100); }],
    ['Crotales', 2, t => [74, 77, 81, 86, 81, 77, 74, 69].forEach((p, j) => crot.note(p + 12, t + j * TPB, TPB, 80))],
    ['Vibes', 2, t => [62, 65, 69, 74, 69, 65, 62, 57].forEach((p, j) => vib.note(p, t + j * TPB, TPB, 85))],
    ['Bowed vibes', 2, t => [62, 65, 69].forEach(p => vibBow.note(p, t, 2 * BAR - 100, 90))],
    ['Thai gong', 2, t => [62, 69, 74, 69].forEach((p, j) => gong.note(p, t + j * 2 * TPB, 2 * TPB, 90))],
    ['Metal kit', 4, t => [61, 63, 56, 51, 52, 53].forEach((k, j) => perc.note(k, t + j * 2 * TPB, 2 * TPB, 100))],
    ['Phil metal', 3, t => [66, 68, 74, 75, 76, 78, 81, 60].forEach((k, j) => phil.note(k, t + j * 1.5 * TPB, 1.5 * TPB, 100))],
    ['Metal FX', 2, t => [74, 81, 77, 86, 74, 81, 79, 84].forEach((p, j) => metalFX.note(p + 12, t + j * TPB, TPB, 85))],
    ['Gong down', 3, t => [62, 60].forEach((p, j) => gongDown.note(p, t + j * BAR * 1.5, BAR * 1.5, 100))],
    ['Anvil delay', 2, t => drums(anvilDly, t, { 63: 'X.....X.....X...' }, { vel: 95, h })],
    ['Synth hats', 2, t => { for (let i = 0; i < 2; i++) drums(kit, t + i * BAR, { 42: 'xxXxxxXxxxXxxxXx', 46: '..x.......x.....' }, { vel: 85, h }); }],
    ['Pad', 2, t => { padBar(t, 0, 80); padBar(t + BAR, 1, 80); }],
    ['Arp', 2, t => { arpBar(t, 0, 80); arpBar(t + BAR, 1, 80); }],
    ['Bass', 2, t => { bassBar(t, 0, 85); bassBar(t + BAR, 1, 85); }],
    ['Synth lead', 4, t => melody(lead, t, VLN, 90, { legato: 0, shift: -12 })],
    ['Trem phaser', 2, t => { for (const p of ['D4', 'F4', 'A4']) trem.note(p, t, 2 * BAR - 100, 85); }],
  ];

  const sections = {};
  let bar = 0;
  for (const [name, len, fn] of STATIONS) {
    sections[name] = [bar + 1, bar + len];
    fn(bar * BAR);
    bar += len + 1; // a bar of silence between stations
  }

  // Groove: 16 bars, everything together. Braam on 1 and 9, stabs answer the violin, violin leads 5-8 and 13-16.
  sections.Groove = [bar + 1, bar + 16];
  for (let i = 0; i < 16; i++) {
    const t0 = (bar + i) * BAR;
    bassBar(t0, i, i < 2 ? 70 : 82);
    padBar(t0, i, 62);
    if (i >= 2) arpBar(t0, i, 58);
    drums(kit, t0, { 36: 'X.....X.X.......', 38: '....X.......X...', 42: 'x.xxx.xxx.xxx.xx', ...(i % 4 === 3 ? { 46: '..............x.' } : {}) }, { vel: 95, h });
    drums(perc, t0, { 63: '....X.......X...', 61: '..x...x...x...x.' }, { vel: 70, h });
    if (i % 2 === 1) drums(phil, t0, { 66: 'x..x..x...x.x...' }, { vel: 55, h });
    if (i % 4 === 0) crot.note(86, t0, BAR, 70);
    if (i === 0 || i === 8) braamHit(t0, 105);
    if ((i >= 2 && i < 4) || (i >= 10 && i < 12)) stabBar(t0, i, 95);
    if (i >= 4 && i < 8) choirBar(t0, i, 64);
  }
  melody(evDrive, (bar + 4) * BAR, VLN, 92, { h, legato: 20 });
  melody(evOct, (bar + 12) * BAR, VLN, 95, { h, legato: 20 });
  melody(evSaw, (bar + 12) * BAR, VLN, 88, { legato: 0 });
  stabBar((bar + 15) * BAR, 3, 105, 'X.....X.....X.X.');
  bar += 16;
  braamHit(bar * BAR, 100, BAR * 2);
  sections.End = [bar + 1, bar + 3];
  return { session: s, endTicks: (bar + 4) * BAR, sections };
}
