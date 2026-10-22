// Future Lab: a sound-design palette for western / futuristic pieces (owner's request 2026-10-22), not a release.
// Render: node tools/render.mjs pieces/future-lab.mjs
// 110 BPM, D minor. Stations, each named in `sections` so measure.py prints its level:
//   electric violin (four signal chains on the Iowa solo violin), brass from trumpet down to tuba (solo, section,
//   choir, braam, stabs), metallic percussion (raw and processed), synths, then a 16-bar groove that uses them together.

import { Session, TPB, rng } from '../tools/lib/session.mjs';
import { presets } from '../tools/lib/palette.mjs';
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
  const BAR = s.bar, S16 = TPB / 4;
  const h = human(rng(2210));
  const P = presets(110);

  s.reverb('Hall', 'plate_reverb', { decay: 2.4, pre_delay: 20, damping: 9000, size: 70, low_cut: 250 });
  s.master('maximizer', { threshold: -3, ceiling: -1.5 });

  const evClean = s.instrument('EVClean', P.evClean), evDrive = s.instrument('EVDrive', P.evDrive), evOct = s.instrument('EVOctave', P.evOctave);
  const evPhase = s.instrument('EVPhaser', P.evPhaser), evSaw = s.instrument('EVSawLayer', P.evSaw);
  const tpS = s.instrument('trumpetiowa', P.trumpetSolo), hnS = s.instrument('hornsiowa', P.hornSolo), tbS = s.instrument('tromboneiowa', P.tromboneSolo), tuS = s.instrument('tubaiowa', P.tubaSolo);
  const tp = s.instrument('trumpetSec', P.trumpets), hn = s.instrument('hornsSec', P.horns), tb = s.instrument('trombonesSec', P.trombones), tu = s.instrument('tubaSec', P.tuba);
  const tpSt = s.instrument('trumpetstacSec', P.trumpetsStac), hnSt = s.instrument('hornsstacSec', P.hornsStac), tbSt = s.instrument('trombonesstacSec', P.trombonesStac), tuSt = s.instrument('tubastacSec', P.tubaStac);
  const braam = s.instrument('Braam', P.braam);
  const crot = s.instrument('crotales', P.crotales), vib = s.instrument('vibeshard', P.vibes), gong = s.instrument('thaigong', P.thaiGong), vibBow = s.instrument('VibesBow', P.vibesBow);
  const perc = s.instrument('Perc', P.perc), phil = s.instrument('PhilPerc', P.philPerc), metalFX = s.instrument('MetalFX', P.metalFX), gongDown = s.instrument('GongDown', P.gongDown);
  const anvilDly = s.instrument('AnvilDelay', P.anvilDelay), kit = s.instrument('Drums', P.drums);
  const pad = s.instrument('Pad', P.pad), arp = s.instrument('Arp', P.arp), bass = s.instrument('Bass', P.bass), lead = s.instrument('SynthLead', P.synthLead), trem = s.instrument('TremPhaser', P.tremPhaser);

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
