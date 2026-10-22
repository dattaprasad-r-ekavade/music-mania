// Dune Lab: auditions for desert / Dune-style sounds (2026-10-22), not a release.
// Render: node tools/render.mjs pieces/dune-lab.mjs
// 64 BPM, D Phrygian (D Eb F G A Bb C). Each station alone, then a 12-bar sketch that puts them together.

import { Session, TPB, rng } from '../tools/lib/session.mjs';
import { presets } from '../tools/lib/palette.mjs';
import { human, melody, checkBars, drums } from '../tools/lib/music.mjs';

const THEME = [
  [['D4', 2], ['Eb4', 1], ['F4', 1]], [['Eb4', 1.5], ['D4', .5], ['C4', 2]],
  [['D4', 1], ['F4', 1], ['G4', 1], ['A4', 1]], [['Bb4', .5], ['A4', .5], ['G4', 1], ['A4', 2]],
];
checkBars('theme', THEME);

export default function () {
  const s = new Session({ bpm: 64 });
  const BAR = s.bar;
  const h = human(rng(6464));
  const P = presets(64);
  s.reverb('Hall', 'plate_reverb', { decay: 4.5, pre_delay: 35, damping: 7000, size: 90, low_cut: 200 });
  s.master('maximizer', { threshold: 0, ceiling: -1.5 });

  const dClar = s.instrument('DudukClar', P.dudukClar), dCA = s.instrument('DudukCA', P.dudukCA), dOboe = s.instrument('DudukOboe', P.dudukOboe);
  const dLoop = s.instrument('DudukLoop', P.dudukLoop), glide = s.instrument('DudukGlide', P.dudukGlide);
  const cello = s.instrument('ECello', P.eCello), horn = s.instrument('WarHorn', P.warHorn);
  const pad = s.instrument('VoxPad', P.voxPad), wail = s.instrument('VoxWail', P.voxWail);
  const pulse = s.instrument('SubPulse', P.subPulse), perc = s.instrument('Perc', P.perc), phil = s.instrument('PhilPerc', P.philPerc);
  const bowed = s.instrument('VibesBow', P.vibesBow), gongDown = s.instrument('GongDown', P.gongDown), anvil = s.instrument('AnvilDelay', P.anvilDelay);

  const theme = (inst, t, o = {}) => melody(inst, t, THEME, 88, { h, legato: 30, ...o });
  const glideUnder = (t, shift = 0) => melody(glide, t, THEME, 80, { legato: -80, shift }); // overlapping notes make the synth glide
  const heartbeat = (t0, vel) => drums(pulse, t0, { 36: 'X..x............' }, { vel });
  const warDrums = (t0, vel) => { drums(pulse, t0, { 45: 'X.....x...X.....' }, { vel }); drums(phil, t0, { 62: 'X.........X...x.', 80: '......X.........' }, { vel: vel - 10, h }); drums(perc, t0, { 64: 'X...............', 66: '..........X.....' }, { vel: vel - 15, h }); };

  const STATIONS = [
    ['Duduk clarinet', 4, t => { theme(dClar, t); glideUnder(t); }],
    ['Duduk cor anglais', 4, t => { theme(dCA, t); glideUnder(t); }],
    ['Duduk oboe', 4, t => { theme(dOboe, t, { shift: 12 }); glideUnder(t, 12); }],
    ['Duduk loop', 4, t => theme(dLoop, t, { legato: 0 })],
    ['Glide alone', 4, t => glideUnder(t)],
    ['E-cello', 4, t => theme(cello, t, { shift: -12 })],
    ['War horn', 4, t => { horn.note('D2', t, 2 * BAR - 200, 100); horn.note('A2', t + 2 * BAR, BAR - 200, 100); horn.note('Eb2', t + 3 * BAR, BAR - 100, 105); }],
    ['Vox pad', 4, t => { for (const p of ['D3', 'A3', 'F4']) pad.note(p, t, 2 * BAR, 80); for (const p of ['Eb3', 'Bb3', 'G4']) pad.note(p, t + 2 * BAR, 2 * BAR - 100, 80); }],
    ['Vox wail', 4, t => melody(wail, t, THEME, 85, { legato: -60, shift: 12 })],
    ['Heartbeat', 2, t => { heartbeat(t, 110); heartbeat(t + BAR, 110); }],
    ['War drums', 4, t => { for (let i = 0; i < 4; i++) warDrums(t + i * BAR, 105); }],
  ];
  const sections = {};
  let bar = 0;
  for (const [name, len, fn] of STATIONS) { sections[name] = [bar + 1, bar + len]; fn(bar * BAR); bar += len + 1; }

  // Sketch: drone and heartbeat, duduk theme, metal enters, e-cello takes the theme over war drums with horn.
  sections.Sketch = [bar + 1, bar + 12];
  const T = i => (bar + i) * BAR;
  for (let i = 0; i < 12; i++) {
    for (const p of i % 4 < 2 ? ['D3', 'A3'] : ['Eb3', 'Bb3']) pad.note(p, T(i), BAR, 60 + i * 2);
    heartbeat(T(i), 95 + Math.min(i, 8) * 2);
    if (i >= 8) warDrums(T(i), 100 + (i - 8) * 4);
  }
  theme(dClar, T(0)); glideUnder(T(0));
  bowed.note('D4', T(4), 4 * BAR, 85); bowed.note('A4', T(4), 4 * BAR, 80);
  gongDown.note(62, T(4), 2 * BAR, 100); anvil.note(63, T(6) + 2 * TPB, TPB, 90);
  theme(cello, T(4), { shift: -12 }); melody(wail, T(4), THEME, 72, { legato: -60, shift: 12 });
  theme(cello, T(8), { shift: -12 });
  horn.note('D2', T(8), 2 * BAR, 105); horn.note('Eb2', T(10), 2 * BAR - 100, 110);
  bar += 12;
  gongDown.note(62, bar * BAR, 2 * BAR, 100); horn.note('D2', bar * BAR, 2 * BAR, 100);
  sections.End = [bar + 1, bar + 3];
  return { session: s, endTicks: (bar + 4) * BAR, sections };
}
