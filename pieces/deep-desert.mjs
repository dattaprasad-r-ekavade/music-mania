// Deep Desert: original cue in the sound world of Zimmer's Dune scores (owner's request 2026-10-22).
// Render: node tools/render.mjs pieces/deep-desert.mjs --png
// 62 BPM, D Phrygian dominant (D Eb F# G A Bb C). Learned from refs/dune-*.profile.json, not copied:
// a drone that sits on D and leans on bII (Eb), few notes per bar, mostly off the beat, heavy sub, a wide dynamic arc.
// Duduk stand-in (Iowa clarinet + gliding synth), electric cello, war horn, "ah" voice synths, metal, war drums.
// Form: Intro 8 | Theme 8 | Rise 8 | Cello 8 | Climax 12 | Outro 8

import { Session, TPB, rng } from '../tools/lib/session.mjs';
import { presets } from '../tools/lib/palette.mjs';
import { human, melody, checkBars, drums } from '../tools/lib/music.mjs';

const THEME = [
  [[null, .5], ['D4', .5], ['A4', 2], ['Bb4', .5], ['A4', .5]],
  [[['G4', 'A4'], 1.5], ['F#4', .5], ['Eb4', 2]],
  [[null, .5], ['D4', .5], ['F#4', .5], ['G4', .5], ['A4', 1.5], ['C5', .5]],
  [['Bb4', 3], [null, 1]],
  [[null, .5], ['A4', .5], ['D5', 2], ['C5', .5], ['Bb4', .5]],
  [[['C5', 'Bb4'], 1.5], ['A4', .5], ['G4', 1], ['F#4', 1]],
  [[null, .5], ['Eb4', 1], ['F#4', .5], ['G4', .5], ['F#4', .5], ['Eb4', 1]],
  [['D4', 4]],
];
// Long-note counterline for the voice synth (sounds an octave up).
const WAIL = [[['D4', 4]], [['C4', 2], ['Bb3', 2]], [['A3', 4]], [['G3', 2], ['Bb3', 2]], [['A3', 3], ['C4', 1]], [['D4', 4]], [['Eb4', 2], ['D4', 2]], [['D4', 4]]];
// Harmony per theme bar: D (open fifth, no third) or Eb (bII).
const HARM = ['D', 'D', 'D', 'Eb', 'D', 'D', 'Eb', 'D'];
const PAD = { D: ['D3', 'A3', 'D4'], Eb: ['Eb3', 'G3', 'Bb3'] };
const LOW = { D: 'D', Eb: 'Eb' };
checkBars('theme', THEME); checkBars('wail', WAIL);

const FORM = [['Intro', 8], ['Theme', 8], ['Rise', 8], ['Cello', 8], ['Climax', 12], ['Outro', 8]];

export default function () {
  const s = new Session({ bpm: 62 });
  const BAR = s.bar, S16 = TPB / 4;
  const h = human(rng(1965));
  const P = presets(62);
  s.reverb('Hall', 'plate_reverb', { decay: 5, pre_delay: 40, damping: 8000, size: 95, low_cut: 180 });
  s.master('eq_1band', { type: 1, freq: 80, gain: 3, q: 0.7 });     // sub weight: 63 Hz sat 5 dB under
  s.master('eq_1band', { type: 0, freq: 500, gain: -3, q: 1 });       // 500 Hz sat 5 dB over (voice formants, ostinato)
  s.master('eq_1band', { type: 0, freq: 2500, gain: 5, q: 0.7 });  // presence: 2-4 kHz sat 8-9 dB under Paul's Dream
  s.master('eq_1band', { type: 2, freq: 3000, gain: 3 });
  s.master('eq_1band', { type: 4, freq: 10000, q: 0.7 });           // 16 kHz sat 5-12 dB over it
  s.master('maximizer', { threshold: 0, ceiling: -2 });

  const duduk = s.instrument('Duduk', { ...P.dudukClar, volume: -8, pan: 0.15, inserts: [{ plugin: 'eq_1band', params: { type: 4, freq: 5000, q: 0.7 } }, { plugin: 'eq_1band', params: { type: 0, freq: 400, gain: 2, q: 1 } }] }), glide = s.instrument('DudukGlide', P.dudukGlide);
  const celloFx = P.eCello.inserts.map(x => x.params.freq === 2500 ? { ...x, params: { ...x.params, gain: 2 } } : x); // brighter than the preset
  const cello = s.instrument('ECello', { ...P.eCello, volume: -7, pan: -0.15, inserts: celloFx });
  const ost = s.instrument('CelloOstinato', { ...P.eCello, sampler: { ...P.eCello.sampler, attack: 10, release: 150 }, volume: -16, pan: -0.4, inserts: celloFx });
  const horn = s.instrument('WarHorn', { ...P.warHorn, volume: -6 }), padFx = P.voxPad.inserts.map(x => x.params.freq === 700 ? { ...x, params: { ...x.params, gain: 6 } } : x),
    pad = s.instrument('VoxPad', { ...P.voxPad, volume: P.voxPad.volume - 3, pan: -0.7, inserts: padFx }),
    // A second, differently detuned pad panned opposite: the references are about 6 dB wider.
    pad2 = s.instrument('VoxPadR', { ...P.voxPad, synth: { ...P.voxPad.synth, params: { ...P.voxPad.synth.params, osc2_detune: 16 } }, volume: P.voxPad.volume - 3, pan: 0.7, inserts: padFx }), wail = s.instrument('VoxWail', P.voxWail);
  const sub = s.instrument('SubDrone', P.subDrone), pulse = s.instrument('SubPulse', P.subPulse);
  const perc = s.instrument('Perc', P.perc), phil = s.instrument('PhilPerc', P.philPerc), bowed = s.instrument('VibesBow', { ...P.vibesBow, volume: -11 }); // at the preset level the intro's first bars matched the climax
  const gongDown = s.instrument('GongDown', { ...P.gongDown, volume: -4 }), anvil = s.instrument('AnvilDelay', { ...P.anvilDelay, volume: 14, pan: 0.35 }), metal = s.instrument('MetalFX', { ...P.metalFX, volume: 12, pan: -0.3 });
  const shimmer = s.instrument('Shimmer', { ...P.tremPhaser, volume: -2 });

  const theme = (t0, vel, o = {}) => melody(duduk, t0, THEME, vel, { h, legato: 30, ...o });
  const glideTheme = (t0, vel, bars = THEME) => melody(glide, t0, bars, vel, { legato: -80 }); // overlap = glide
  const padBar = (t0, hm, vel) => PAD[hm].forEach((p, k) => { pad.note(p, t0 + k * 15, BAR - 20, vel); pad2.note(p, t0 + 30 - k * 10, BAR - 40, vel); });
  const subBar = (t0, hm, vel) => { sub.note(`${LOW[hm]}1`, t0, BAR - 10, vel); sub.note(`${LOW[hm]}2`, t0, BAR - 10, vel - 15); };
  const heartbeat = (t0, vel) => drums(pulse, t0, { 36: 'X..x............' }, { vel });
  // War drums, 16ths at 62 BPM = the references' 123 BPM pulse: low toms, surdo, bass drum, timpani.
  const warDrums = (t0, vel, full) => {
    drums(pulse, t0, { 36: 'X.........x.....', 45: full ? 'X..X..x...X..x.x' : 'X.....x...X.....' }, { vel, h });
    drums(phil, t0, { 62: full ? 'x.x...x.x.x...x.' : '..........x.....', 80: '......X.......X.' }, { vel: vel - 12, h });
    drums(perc, t0, { 64: 'X...............', ...(full ? { 66: '........X.....x.' } : {}) }, { vel: vel - 15, h });
  };
  const shaker = (t0, vel) => drums(phil, t0, { 70: 'x.xx.xx.x.xx.x.x' }, { vel, h });
  const OST = { D: { D: 'D3', d: 'D2', A: 'A2', E: 'Eb3' }, Eb: { D: 'Eb3', d: 'Eb2', A: 'Bb2', E: 'D3' } };
  const ostBar = (t0, hm, vel) => [...'Dd.ADd.Ed.ADdAd'].forEach((c, j) => {
    if (c !== '.') ost.note(OST[hm][c], t0 + j * S16, S16 * 0.95, vel + (j % 4 === 0 ? 8 : 0) + h.v());
  });
  // Cello samples last 2.4-4 s: a held note past the sample's end clicks, so hits stay under 2.2 beats and holds re-strike each bar.
  const hornHit = (t0, hm, vel, bars = 1) => { for (let b = 0; b < bars; b++) { const t = t0 + b * BAR, v = vel - b * 8; horn.note(`${LOW[hm]}2`, t, 2.2 * TPB, v); horn.note(hm === 'D' ? 'A2' : 'Bb2', t + 20, 2.2 * TPB, v - 8); } };

  const sections = {};
  let bar = 0;
  for (const [name, len] of FORM) {
    sections[name] = [bar + 1, bar + len];
    const T = i => (bar + i) * BAR;
    for (let i = 0; i < len; i++) {
      const t0 = T(i), hm = HARM[i % 8];
      switch (name) {
        case 'Intro':
          padBar(t0, i < 4 ? 'D' : hm, 45 + i * 3);
          if (i >= 4) { subBar(t0, 'D', 60 + i * 3); heartbeat(t0, 70 + i * 3); }
          break;
        case 'Theme':
          padBar(t0, hm, 66); subBar(t0, hm, 80); heartbeat(t0, 90);
          if (i >= 4) shaker(t0, 45 + i * 2);
          break;
        case 'Rise':
          padBar(t0, hm, 70); subBar(t0, hm, 85);
          ostBar(t0, hm, 70 + i * 3);
          shaker(t0, 60);
          if (i < 4) heartbeat(t0, 95); else warDrums(t0, 88 + (i - 4) * 4, false);
          if (i % 2 === 1) anvil.note(63, t0 + 2 * TPB, TPB, 80 + i * 2);
          break;
        case 'Cello':
          padBar(t0, hm, 74); subBar(t0, hm, 90);
          ostBar(t0, hm, 80); shaker(t0, 64); warDrums(t0, 100, true);
          if (hm === 'Eb') hornHit(t0, hm, 100);
          if (i % 2 === 1) anvil.note(63, t0 + 2 * TPB, TPB, 92);
          break;
        case 'Climax':
          if (i < 8) {
            padBar(t0, hm, 84); subBar(t0, hm, 100);
            ostBar(t0, hm, 88); shaker(t0, 72); warDrums(t0, 110 + (i >= 4 ? 6 : 0), true);
            hornHit(t0, hm, 108 + (i >= 4 ? 6 : 0));
            anvil.note(63, t0 + 2 * TPB, TPB, 98);
          } else {
            // Release: the horn holds D, the drums drop away, the shimmer carries the air.
            padBar(t0, 'D', 80 - (i - 8) * 6); subBar(t0, 'D', 95 - (i - 8) * 6);
            if (i === 8) { hornHit(t0, 'D', 112, 3); perc.note(51, t0, 2 * BAR, 110); gongDown.note(62, t0, 3 * BAR, 110); }
            if (i < 10) heartbeat(t0, 100 - (i - 8) * 10);
          }
          break;
        case 'Outro':
          padBar(t0, i < 6 ? hm : 'D', 62 - i * 3); subBar(t0, i < 6 ? hm : 'D', 78 - i * 4);
          if (i < 4) heartbeat(t0, 80 - i * 8);
          break;
      }
    }
    switch (name) {
      case 'Intro':
        bowed.note('D4', T(0), 3 * BAR, 75); bowed.note('A4', T(0) + 40, 3 * BAR, 70);
        gongDown.note(62, T(0) + TPB / 2, 3 * BAR, 90); // not at 0: the pitch shifter clicks on the first sample
        phil.note(76, T(2), 2 * BAR, 70); // wind chimes
        for (const p of ['A5', 'D6']) shimmer.note(p, T(4), 2 * BAR, 60);
        break;
      case 'Theme':
        theme(T(0), 86); glideTheme(T(0), 76);
        break;
      case 'Rise':
        melody(wail, T(0), WAIL, 74, { legato: -60, shift: 12 });
        theme(T(4), 84, { shift: 12, legato: 30 }); // duduk answers the second half an octave up, over the rising drums
        glideTheme(T(4), 72, THEME.slice(4).map(b => b.map(([n, d]) => [n && (Array.isArray(n) ? n[0] : n), d])));
        [86, 93, 89, 98].forEach((p, j) => metal.note(p, T(4 + j) + TPB * 1.5, TPB, 80));
        break;
      case 'Cello':
        melody(cello, T(0), THEME, 92, { h, legato: 20, shift: -12 });
        melody(wail, T(0), WAIL, 70, { legato: -60, shift: 12 });
        bowed.note('D5', T(0), 3 * BAR, 70);
        break;
      case 'Climax':
        theme(T(0), 98, { shift: 12 }); glideTheme(T(0), 84);
        melody(cello, T(0), THEME, 100, { h, legato: 20, shift: -12 });
        melody(wail, T(0), THEME, 80, { legato: -60, shift: 12 });
        [86, 93, 98, 91, 86, 93, 98, 103].forEach((p, j) => metal.note(p, T(j) + TPB * 2.5, TPB, 85));
        for (const p of ['A5', 'D6']) shimmer.note(p, T(8), 2 * BAR, 75);
        break;
      case 'Outro':
        melody(duduk, T(0), THEME.slice(0, 3).concat([[['D4', 4]]]), 78, { h, legato: 30 });
        melody(glide, T(0), THEME.slice(0, 3).concat([[['D4', 4]]]).map(b => b.map(([n, d]) => [n && (Array.isArray(n) ? n[0] : n), d])), 68, { legato: -80 });
        bowed.note('D4', T(4), 3 * BAR, 70); bowed.note('A4', T(4) + 40, 3 * BAR, 64);
        gongDown.note(62, T(6), 2 * BAR, 85);
        break;
    }
    bar += len;
  }
  // The arc: the sustained bed (pad, sub, heartbeat, shaker/surdo) gets louder section by section, so the
  // limiter no longer flattens it. dB offsets per section, ramped over the bar before each change.
  const ARC = { VoxPad: [-13, -8, -6.5, -6, -4, -9], SubDrone: [-10, -5.5, -4, -4, -3, -7], SubPulse: [-10, -5.5, -4, -5, -1, -7], PhilPerc: [-4, -4, -4, -4, -2, -4] };
  const starts = Object.values(sections).map(([a]) => (a - 1) * BAR);
  for (const [inst, offs] of [[pad, ARC.VoxPad], [pad2, ARC.VoxPad], [sub, ARC.SubDrone], [pulse, ARC.SubPulse], [phil, ARC.PhilPerc]])
    inst.automate('volume', offs.flatMap((v, k) => k ? [[starts[k] - BAR, offs[k - 1]], [starts[k], v]] : [[0, v]]));
  return { session: s, endTicks: (bar + 2) * BAR, sections, ref: 'refs/dune-pauls-dream.profile.json' };
}
