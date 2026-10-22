// Deep Desert: original cue in the sound world of Zimmer's Dune scores (owner's request 2026-10-22).
// Render: node tools/render.mjs pieces/deep-desert.mjs --png
// 62 BPM, D Phrygian dominant with microtonal bends. Learned from refs/dune-*.profile.json, not copied.
// Review 1 (owner 6/10): "instruments in the right spot, but the framing was typical and predictable; Dune is not
// guessable". So the form avoids the steady build: a loud cold open cut to near silence, scattered metal at irregular
// times, the theme only in bent fragments, drums cycling in 7 against a cello in 5, a hard cut, a climax that lifts a
// semitone halfway, a collapse where everything bends down, and an ending left on bII.
// Bends: a pitch shifter in insert slot a on each bending group, its cents automated (plugin:a:cents, tested).
// Form: Open 1 | Void 6 | Fragments 9 | Pulse 10 | Cut 1 | Climax 10 | Collapse 3 | Coda 8

import { Session, TPB, rng } from '../tools/lib/session.mjs';
import { presets, eq } from '../tools/lib/palette.mjs';
import { human } from '../tools/lib/music.mjs';

// Duduk fragments: [beat, note, beats, bend]. bend: s = scoop up from cents below, f = fall at the end (cents),
// m = cents held mid-note (a "neutral" third). Fragments, not a square 8-bar theme.
const F1 = [[0.5, 'A4', 3, { s: -60 }], [3.5, 'Bb4', 0.5], [4, 'A4', 2.5, { f: -40 }]];
const F2 = [[0, 'D5', 1.5, { s: -80 }], [1.5, 'C5', 0.5], [2, 'Bb4', 0.75], [2.75, 'A4', 0.25], [3, 'G4', 1], [4, 'F#4', 3, { m: 40 }]];
const F3 = [[0, 'Eb4', 2, { s: -100 }], [2.5, 'D4', 4, { f: -100 }]];
const F4 = [[0, 'G4', 0.5], [0.5, 'A4', 0.5], [1, 'Bb4', 2.5, { s: -50 }], [3.5, 'A4', 0.5], [4, 'G4', 0.5], [4.5, 'F#4', 0.5, { m: 30 }], [5, 'Eb4', 3, { f: -60 }]];
// The overtone "singer": harmonics of D2 (73.4 Hz) the resonant peak steps through, [beat, harmonic].
const WHISTLE = [[0, 8], [3, 9], [4.5, 10], [6, 9], [9, 12], [10.5, 10], [12, 9], [14, 8]];

const NAMES = { C: 0, D: 2, E: 4, F: 5, G: 7, A: 9, B: 11 };
const midi = n => typeof n === 'number' ? n : 12 * (+n.slice(-1) + 1) + NAMES[n[0]] + (n[1] === '#' ? 1 : n[1] === 'b' ? -1 : 0);

export default function () {
  const s = new Session({ bpm: 62 });
  const BAR = s.bar, S16 = TPB / 4, MS = TPB * 62 / 60000;
  const r = rng(1965), h = human(r);
  const P = presets(62);
  const shifter = { plugin: 'pitch_shifter', params: { semitones: 0, cents: 0, mix: 100 } };
  const bendable = (preset, extra = {}) => ({ ...preset, ...extra, inserts: [shifter, ...(extra.inserts ?? preset.inserts ?? [])] });
  s.reverb('Hall', 'plate_reverb', { decay: 3.8, pre_delay: 40, damping: 8000, size: 95, low_cut: 180 });
  s.master('eq_1band', { type: 1, freq: 80, gain: 3, q: 0.7 });
  s.master('eq_1band', { type: 0, freq: 500, gain: -3, q: 1 });
  s.master('eq_1band', { type: 0, freq: 2500, gain: 5, q: 0.7 });
  s.master('eq_1band', { type: 2, freq: 3000, gain: 3 });
  s.master('eq_1band', { type: 4, freq: 10000, q: 0.7 });
  s.master('maximizer', { threshold: 0, ceiling: -2 });

  const celloFx = P.eCello.inserts.map(x => x.params.freq === 2500 ? { ...x, params: { ...x.params, gain: 2 } } : x);
  const padFx = P.voxPad.inserts.map(x => x.params.freq === 700 ? { ...x, params: { ...x.params, gain: 6 } } : x);
  const duduk = s.instrument('Duduk', bendable(P.dudukClar, { volume: -8, pan: 0.15, inserts: [eq(4, 5000), eq(0, 400, 2, 1)] }));
  const glide = s.instrument('DudukGlide', bendable(P.dudukGlide));
  const cello = s.instrument('ECello', bendable(P.eCello, { volume: -7, pan: -0.15, inserts: celloFx }));
  const ost = s.instrument('CelloOstinato', { ...P.eCello, sampler: { ...P.eCello.sampler, attack: 10, release: 150 }, volume: -16, pan: -0.4, inserts: celloFx });
  // Less drive than the preset (24): rapid driven blasts were what the aesthetics scorer marked down (Climax CE 3.1, 5.0 without the horn).
  const horn = s.instrument('WarHorn', bendable(P.warHorn, { volume: -4, inserts: P.warHorn.inserts.map(x => x.plugin === 'saturator' ? { ...x, params: { ...x.params, drive: 14, mix: 70 } } : x) }));
  const wail = s.instrument('VoxWail', bendable(P.voxWail));
  const pad = s.instrument('VoxPad', { ...P.voxPad, volume: P.voxPad.volume - 3, pan: -0.7, inserts: padFx });
  const pad2 = s.instrument('VoxPadR', { ...P.voxPad, synth: { ...P.voxPad.synth, params: { ...P.voxPad.synth.params, osc2_detune: 16 } }, volume: P.voxPad.volume - 3, pan: 0.7, inserts: padFx });
  // Throat-singing stand-in: a buzzy D2 drone; a narrow +16 dB peak in slot a steps through its overtones.
  const throat = s.instrument('Throat', { synth: { plugin: 'subtractive_synth', params: { osc1_wave: 0, osc2_wave: 1, osc2_detune: 3, osc_mix: 35, cutoff: 4000, resonance: 0, amp_attack: 900, amp_decay: 1000, amp_sustain: 95, amp_release: 1500, level: -14 } },
    inserts: [eq(0, 587, 16, 9), eq(0, 150, -6, 0.7), eq(4, 3500)], sends: { Hall: -6 }, volume: -2, pan: 0.2 });
  const sub = s.instrument('SubDrone', P.subDrone), pulse = s.instrument('SubPulse', P.subPulse);
  const perc = s.instrument('Perc', P.perc), phil = s.instrument('PhilPerc', P.philPerc);
  const bowed = s.instrument('VibesBow', { ...P.vibesBow, volume: -11, pan: -0.3 });
  const bowedDet = s.instrument('VibesBowDetuned', { ...P.vibesBow, volume: -11, pan: 0.3, inserts: [{ plugin: 'pitch_shifter', params: { semitones: 0, cents: 22, mix: 100 } }] }); // beats against `bowed`
  const bell = s.instrument('LowBell', { ...P.crotales, volume: 8, pan: -0.2, sends: { Hall: -3 }, inserts: [{ plugin: 'pitch_shifter', params: { semitones: -24, mix: 100 } }, eq(3, 60)] }); // crotales two octaves down
  const anvilLow = s.instrument('AnvilLow', { ...P.anvilDelay, volume: 12, pan: 0.35, inserts: [{ plugin: 'pitch_shifter', params: { semitones: -12, mix: 100 } }, ...P.anvilDelay.inserts] });
  const anvil = s.instrument('AnvilDelay', { ...P.anvilDelay, volume: 14, pan: 0.35 });
  const gongDown = s.instrument('GongDown', { ...P.gongDown, volume: -4 }), metal = s.instrument('MetalFX', { ...P.metalFX, volume: 12, pan: -0.3 });
  const shimmer = s.instrument('Shimmer', { ...P.tremPhaser, volume: -2 });

  // Bends: cents points on the slot-a shifter of every group that plays the line.
  const bend = (targets, t, len, b = {}) => {
    const pts = [[t - 5, b.s ?? 0], [t + (b.s ? 160 * MS : 5), 0]];
    if (b.m) pts.push([t + len * 0.3, 0], [t + len * 0.55, b.m], [t + len - 5, b.m]);
    if (b.f) pts.push([t + len * 0.6, b.m ?? 0], [t + len, b.f]);
    for (const x of targets) x.automate('plugin:a:cents', pts);
  };
  const line = (players, t0, frag, vel, shift = 0) => {
    for (const [beat, note, beats, b] of frag) {
      const t = t0 + beat * TPB + h.t(10), len = beats * TPB;
      for (const [inst, dv, legato] of players) inst.note(midi(note) + shift, t, len - legato, vel + dv + h.v(3));
      bend(players.map(p => p[0]), t, len, b);
    }
  };
  const dudukLine = (t0, frag, vel, shift = 0) => line([[duduk, 0, 30], [glide, -10, -60]], t0, frag, vel, shift);
  const padChord = (t0, notes, len, vel) => notes.forEach((p, k) => { pad.note(p, t0 + k * 15, len - 20, vel); pad2.note(p, t0 + 30 - k * 10, len - 40, vel); });
  const subNote = (t0, n, len, vel) => { sub.note(`${n}1`, t0, len - 10, vel); sub.note(`${n}2`, t0, len - 10, vel - 15); };
  // A pattern of any length repeated across a span: 7 or 5 against the 16-step bar drifts every bar.
  const cycle = (fn, t0, t1, pattern) => { let k = 0; for (let t = t0; t < t1; t += S16, k++) { const c = pattern[k % pattern.length]; if (c !== '.') fn(t, c, k); } };
  const hornHit = (t, n, len, vel) => { horn.note(`${n}2`, t, Math.min(len, 2.2 * TPB), vel); horn.note(n === 'D' ? 'A2' : n === 'Eb' ? 'Bb2' : 'G2', t + 20, Math.min(len, 2.2 * TPB), vel - 8); };

  const FORM = [['Open', 1], ['Void', 6], ['Fragments', 9], ['Pulse', 10], ['Cut', 1], ['Climax', 10], ['Collapse', 3], ['Coda', 8]];
  const sections = {}, at = {};
  let bar = 0;
  for (const [name, len] of FORM) { sections[name] = [bar + 1, bar + len]; at[name] = bar * BAR; bar += len; }
  const B = (name, beats = 0) => at[name] + beats * TPB;

  // Open: everything at once for two beats, then gone.
  hornHit(B('Open'), 'D', 2 * TPB, 118); wail.note('D5', B('Open'), 2 * TPB, 100); bend([wail], B('Open'), 2 * TPB, { s: -100, f: -100 });
  gongDown.note(62, B('Open') + 20, 3 * BAR, 115); perc.note(52, B('Open'), 2 * BAR, 115); pulse.note(45, B('Open'), TPB, 120); padChord(B('Open'), ['D3', 'Eb3', 'A3'], 2 * TPB, 100);

  // Void: a faint sub, wind, metal at irregular times (seeded), the detuned bowed pair beating.
  subNote(B('Void', 2), 'D', 5.5 * BAR, 55);
  for (const p of ['A5', 'D6']) shimmer.note(p, B('Void', 6), 2 * BAR, 45);
  bowed.note('A4', B('Void', 9), 2.8 * BAR, 70); bowedDet.note('A4', B('Void', 9), 2.8 * BAR, 70);
  let t = B('Void', 1.5);
  for (const [inst, k] of [[metal, 86], [bell, 86], [anvilLow, 63], [bell, 91], [metal, 91], [phil, 76], [bell, 84]]) {
    if (inst === phil) phil.note(k, t, 2 * BAR, 60); else inst.note(k, t, TPB, 70 + r() * 20);
    t += (1.75 + r() * 2.5) * TPB; // 1.75-4.25 beats apart: no grid to predict
  }
  throat.note('D2', B('Void', 14), 2.5 * BAR, 70);
  throat.automate('plugin:a:freq', WHISTLE.slice(0, 5).map(([beat, n]) => [B('Void', 14 + beat), 73.42 * n]));

  // Fragments: the duduk in pieces, the drone moving where a listener won't expect (D, then C minor, then Eb).
  dudukLine(B('Fragments', 1), F1, 86);
  dudukLine(B('Fragments', 10.5), F2, 90);
  dudukLine(B('Fragments', 21), F3, 84);
  dudukLine(B('Fragments', 29), F1.slice(0, 2), 80, 3); // an echo of F1 a minor third up, cut short
  padChord(B('Fragments'), ['D3', 'A3'], 2.5 * BAR, 55); subNote(B('Fragments'), 'D', 2.5 * BAR, 70);
  padChord(B('Fragments', 10), ['C3', 'Eb3', 'G3'], 2.5 * BAR, 60); subNote(B('Fragments', 10), 'C', 2.5 * BAR, 72);
  padChord(B('Fragments', 20), ['Eb3', 'G3', 'Bb3'], 2 * BAR, 62); subNote(B('Fragments', 20), 'Eb', 2 * BAR, 74);
  padChord(B('Fragments', 28), ['D3', 'A3', 'D4'], 2 * BAR, 58); subNote(B('Fragments', 28), 'D', 2 * BAR, 70);
  bell.note(86, B('Fragments', 9.75), TPB, 80); anvilLow.note(63, B('Fragments', 19.5), TPB, 85); metal.note(93, B('Fragments', 27.25), TPB, 75);
  [0, 6.5, 15, 23.5, 31].forEach(b => pulse.note(36, B('Fragments', b), TPB / 2, 90)); // heartbeats, irregular

  // Pulse: toms in 7, surdo in 5, a 4/4 heartbeat; the cello ostinato in 5; the throat singer whistles; it all swells.
  const P0 = B('Pulse'), P1 = B('Cut');
  const grow = tt => (tt - P0) / (P1 - P0);
  cycle((tt, c) => pulse.note(45, tt, S16, (c === 'X' ? 104 : 86) + h.v() + grow(tt) * 14), P0 + 4 * BAR, P1, 'X..x..x');
  cycle(tt => phil.note(62, tt, S16, 70 + h.v() + grow(tt) * 20), P0 + 6 * BAR, P1, 'x...x');
  for (let i = 0; i < 10; i++) pulse.note(36, P0 + i * BAR, TPB / 2, 92 + i);
  const OST5 = ['D2', 'D3', 'A2', 'D3', 'Eb3'];
  cycle((tt, c, k) => ost.note(midi(OST5[k % 5]), tt, S16 * 0.95, 66 + grow(tt) * 24 + h.v()), P0 + 2 * BAR, P1, 'xxxxx');
  for (let i = 0; i < 10; i += 2) { padChord(P0 + i * BAR, i < 6 ? ['D3', 'A3', 'D4'] : ['D3', 'Eb3', 'A3'], 2 * BAR, 62 + i * 2); subNote(P0 + i * BAR, 'D', 2 * BAR, 78 + i); }
  throat.note('D2', P0, 8 * BAR, 80);
  throat.automate('plugin:a:freq', WHISTLE.concat(WHISTLE.map(([b, n]) => [b + 16, n]), WHISTLE.map(([b, n]) => [b + 32, n === 12 ? 13 : n])).map(([b, n]) => [P0 + b * TPB, 73.42 * n]));
  line([[wail, 0, -60]], P0 + 4 * BAR, F4, 78, 12);
  dudukLine(P0 + 7 * BAR, F2.slice(0, 4), 92, 12);
  [[5.25, 86], [6.75, 91], [8.5, 98], [9.25, 93]].forEach(([b, p]) => metal.note(p, P0 + b * BAR, TPB, 85));
  for (let i = 5; i < 10; i += 2) anvil.note(63, P0 + i * BAR + 2.5 * TPB, TPB, 85 + i);

  // Cut: silence for a beat and a half, one heartbeat, and the climax enters off the beat.
  pulse.note(36, B('Cut', 2.5), TPB / 2, 115);
  const C0 = B('Cut', 3.5), CM = B('Climax', 20), C1 = B('Collapse');

  // Climax: toms accent 3+3+3+3+2+2 eighths (2 bars), the horn blasts on two of the groups, cello the fragments;
  // at the midpoint it all lifts to Eb.
  const GROUPS = [0, 3, 6, 9, 12, 14];
  for (let tt = C0, k = 0; tt < C1 - TPB; k++) {
    const g = GROUPS[k % 6], next = GROUPS[(k + 1) % 6] || 16, len = (next - g) * TPB / 2;
    if (g === 0 || g === 9) hornHit(tt, tt < CM ? 'D' : 'Eb', 2.2 * TPB, 100 + (g === 0 ? 8 : 0) + h.v());
    pulse.note(45, tt, S16, g === 0 || g === 9 ? 112 : 98); if (g === 0) { perc.note(51, tt, BAR, 96); pulse.note(36, tt, TPB / 2, 116); }
    tt += len;
  }
  // (no surdo here: muting it raised the Climax's aesthetics most, PQ 5.6 to 6.5)
  cycle((tt, c, k) => ost.note(midi(OST5[k % 5]) + (tt >= CM ? 1 : 0), tt, S16 * 0.95, 70 + h.v()), C0, C1, 'xxxxx');
  for (let tt = C0; tt < C1; tt += 2 * BAR) { const up = tt >= CM, len = Math.min(2 * BAR, C1 - tt); padChord(tt, up ? ['Eb3', 'Bb3', 'Eb4'] : ['D3', 'A3', 'D4'], len, 86); subNote(tt, up ? 'Eb' : 'D', len, 100); }
  line([[cello, 0, 20]], C0 + TPB / 2, F2, 98, -12);
  line([[cello, 0, 20]], C0 + 2.5 * BAR, F1, 100, -12);
  line([[wail, 0, -60]], C0 + 2.5 * BAR, F1, 84, 12);
  line([[cello, 0, 20]], CM, F2, 104, -11);          // the lift: a semitone up
  dudukLine(CM, F2, 100, 13);
  line([[cello, 0, 20]], CM + 2.5 * BAR, F4, 104, -11);
  line([[wail, 0, -60]], CM + 2.5 * BAR, F4, 88, 13);
  [0.5, 3.25, 5.75, 8.5].forEach(b => anvilLow.note(63, C0 + b * BAR, TPB, 100));
  [[1.5, 98], [4.25, 103], [6.5, 98], [7.75, 105]].forEach(([b, p]) => metal.note(p, C0 + b * BAR, TPB, 90));
  for (const p of ['A5', 'D6']) shimmer.note(p, CM, 2 * BAR, 75);

  // Collapse: one last Eb chord; every pitched group bends down 3 semitones over 2 bars while the drums thin out.
  const K0 = B('Collapse');
  [116, 104, 92].forEach((v, k) => hornHit(K0 + k * 2.2 * TPB, 'Eb', 2.2 * TPB, v));
  padChord(K0, ['Eb3', 'Bb3', 'Eb4'], 3 * BAR, 84); subNote(K0, 'Eb', 2.5 * BAR, 96);
  cello.note('Eb3', K0, 2.2 * TPB, 100); cello.note('Eb3', K0 + 2.2 * TPB, 2.2 * TPB, 92); wail.note('Eb5', K0, 2.5 * BAR, 86);
  gongDown.note(62, K0, 3 * BAR, 112); perc.note(53, K0, 2 * BAR, 100);
  for (const x of [horn, cello, wail]) x.automate('plugin:a:semitones', [[0, 0], [K0 + BAR, 0], [K0 + 3 * BAR, -3], [B('Coda') + 10, 0]]);
  [0, 1.5, 2.75, 3.75, 4.5, 5.75].forEach((b, k) => pulse.note(45, K0 + b * TPB, S16, 110 - k * 8));

  // Coda: the duduk alone over D, ending on Eb (bII) that never resolves; a last heartbeat after the silence.
  subNote(B('Coda'), 'D', 6 * BAR, 66); padChord(B('Coda'), ['D3', 'A3'], 6 * BAR, 50);
  bowed.note('D4', B('Coda', 4), 2.8 * BAR, 60); bowedDet.note('D4', B('Coda', 4), 2.8 * BAR, 60);
  dudukLine(B('Coda', 2), F1, 80);
  dudukLine(B('Coda', 11), [[0, 'Eb4', 6, { s: -100, m: -30 }]], 76); // Eb4 held, sagging, unresolved
  bell.note(86, B('Coda', 19), TPB, 70);
  pulse.note(36, B('Coda', 27), TPB / 2, 90);

  // The bed (sub, pads) carries the shape: near silence in the Void, gone in the Cut (its release would ring), full
  // in the Climax, fading through the Collapse. dB offsets, ramps between points.
  const bed = [[0, 0], [B('Void') - 10, 0], [B('Void', 4), -16], [B('Fragments') - 10, -16], [B('Fragments', 4), -9], [B('Pulse'), -8], [B('Cut') - TPB, 0],
    [B('Cut') - 10, 0], [B('Cut'), -60], [C0 - 10, -60], [C0, -2], [K0 + BAR, -2], [B('Coda'), -10], [B('Coda', 24), -16]];
  for (const x of [sub, pad, pad2]) x.automate('volume', bed);
  return { session: s, endTicks: (bar + 2) * BAR, sections, ref: 'refs/dune-pauls-dream.profile.json' };
}
