// Mass Entry: South Indian action-film theme (original composition).
// Render: node tools/render.mjs pieces/mass-entry.mjs --stems
// 144 BPM, D Phrygian dominant (the "mass hero" mode, close to raga Vakulabharanam); the Hero theme turns to D minor.
// VSCO horn samples skip C4-D5 and trombone shorts have 7-semitone gaps, hence maxShift 7 on those.
// Oboe stands in for the nadaswaram; congas / tumba / quinto play thavil-style patterns in a 3-3-2 "teen maar" feel.
// Form: Intro 8 | Build 8 | Hook 16 | Call 16 | Hero 16 (half-time) | Thavil 8 | Rise 8 | Hook 16 (+ trumpet) | Hero 8 | Outro 8

import { Session, TPB, ZONES, rng } from '../tools/lib/session.mjs';
import { barChords, voice, bassNote, human, melody, checkBars, drums } from '../tools/lib/music.mjs';

const H = {
  hook: ['D', 'D', 'Eb', 'D', 'D', 'D', 'Eb', 'D', 'Gm', 'Gm', 'Eb', 'D', 'Cm', 'Eb', 'D', 'D'],
  call: ['Gm', 'D', 'Gm', 'D', 'Cm', 'Gm', 'Eb', 'D', 'Gm', 'D', 'Gm', 'D', 'Cm', 'Gm', 'Eb', 'D'],
  hero: ['Dm', 'Dm', 'Bb', 'A', 'Dm', 'F', 'Gm', 'A', 'Bb', 'Gm', 'C', 'A', 'Bb', 'F', 'Gm A', 'Dm'],
};
const HOOK = [
  [['A4', .75], ['A4', .75], ['D5', .5], ['Eb5', 1], ['D5', 1]], [['F#5', .5], ['G5', .5], ['F#5', .5], ['Eb5', .5], ['D5', 2]],
  [['G5', .75], ['G5', .75], ['Bb5', .5], ['A5', 1], ['G5', 1]], [['F#5', .5], ['G5', .5], ['F#5', .5], ['Eb5', .5], ['D5', 2]],
  [['A4', .75], ['A4', .75], ['D5', .5], ['Eb5', 1], ['F#5', 1]], [['G5', .5], ['A5', .5], ['Bb5', .5], ['A5', .5], ['G5', .5], ['F#5', .5], ['Eb5', .5], ['F#5', .5]],
  [['G5', 1.5], ['F#5', .5], ['Eb5', 1], ['D5', 1]], [['D5', 3], [null, 1]],
  [['D5', .75], ['D5', .75], ['G5', .5], ['A5', 1], ['Bb5', 1]], [['A5', .5], ['G5', .5], ['F#5', .5], ['G5', .5], ['D5', 2]],
  [['Eb5', .75], ['Eb5', .75], ['G5', .5], ['Bb5', 1], ['G5', 1]], [['F#5', .5], ['G5', .5], ['A5', 1], ['F#5', 2]],
  [['G5', .75], ['G5', .75], ['Eb5', .5], ['C5', 1], ['Eb5', 1]], [['G5', .5], ['A5', .5], ['Bb5', 1], ['A5', .5], ['G5', .5], ['F#5', .5], ['Eb5', .5]],
  [['F#5', 1], ['Eb5', .5], ['D5', .5], ['C5', .5], ['Eb5', .5], ['D5', 1]], [['D5', 4]],
];
const ANSWER = [ // oboe replies in the even bars of the Call section
  [[null, 1], ['F#5', .5], ['G5', .5], ['A5', .5], ['G5', .5], ['F#5', 1]], [[null, 1], ['A5', .5], ['Bb5', .5], ['A5', .5], ['G5', .5], ['F#5', 1]],
  [[null, 1], ['Bb5', .5], ['A5', .5], ['G5', 1], ['D5', 1]], [[null, 1], ['Eb5', .5], ['F#5', .5], ['D5', 2]],
];
const HERO = [
  [['D4', 2], ['F4', 2]], [['A4', 3], ['G4', 1]], [['F4', 2], ['E4', 1], ['D4', 1]], [['A3', 4]],
  [['D4', 2], ['F4', 2]], [['A4', 2], ['C5', 2]], [['Bb4', 2], ['A4', 1], ['G4', 1]], [['A4', 4]],
  [['Bb4', 2], ['A4', 2]], [['G4', 2], ['F4', 2]], [['E4', 2], ['F4', 1], ['G4', 1]], [['A4', 4]],
  [['Bb4', 2], ['C5', 2]], [['D5', 3], ['C5', 1]], [['Bb4', 2], ['A4', 2]], [['D4', 4]],
];
checkBars('hook', HOOK); checkBars('hero', HERO); ANSWER.forEach((b, i) => checkBars('answer' + i, [b]));

const FORM = [['Intro', 8], ['Build', 8], ['Hook', 16], ['Call', 16], ['Hero', 16], ['Thavil', 8], ['Rise', 8], ['Hook2', 16], ['Hero2', 8], ['Outro', 8]];
const HARM = { Intro: Array(8).fill('D5'), Build: Array(8).fill('D5'), Hook: H.hook, Call: H.call, Hero: H.hero, Thavil: Array(8).fill('D5'),
  Rise: ['D5', 'D5', 'Eb', 'Eb', 'D5', 'D5', 'Eb', 'D'], Hook2: H.hook, Hero2: H.hero.slice(0, 8), Outro: ['D', 'D', 'Eb', 'D', 'D', 'D', 'D', 'D'] };

export default function () {
  const s = new Session({ bpm: 144 });
  const BAR = s.bar, S16 = TPB / 4;
  const h = human(rng(144));
  const eq = (type, freq, gain = 0, q = 0.7) => ({ plugin: 'eq_1band', params: { type, freq, gain, q } });
  const one = { attack: 0.5, release: 250, velocity: 55 };

  s.reverb('Hall', 'plate_reverb', { decay: 1.9, pre_delay: 15, damping: 9000, size: 70, low_cut: 250 });
  const perc = s.instrument('Perc', { zones: 'perc', oneShot: true, sampler: { ...one, release: 600, velocity: 60 }, sends: { Hall: -14 }, volume: -4 });
  const kit = s.instrument('Drums', { synth: { plugin: 'drum_synth', params: { level: -6, kick_decay: 520, kick_tune: -3, snare_snappy: 75, snare_decay: 240, hat_decay: 45, open_hat_decay: 300, tom_tune: -4, tom_decay: 380, cymbal_decay: 2200 } },
    inserts: [{ plugin: 'compressor', params: { threshold: -18, ratio: 3, attack: 6, release: 120, makeup: 3 } }], sends: { Hall: -18 }, volume: -5 });
  const bass = s.instrument('Bass', { synth: { plugin: 'subtractive_synth', params: { osc1_wave: 0, osc2_wave: 1, osc2_semitones: -12, osc2_detune: 0, osc_mix: 55, cutoff: 520, resonance: 25, filter_env_amount: 45, filter_decay: 160, filter_sustain: 15, amp_attack: 2, amp_decay: 250, amp_sustain: 70, amp_release: 80, level: -8 } },
    inserts: [{ plugin: 'saturator', params: { drive: 6, mix: 55 } }, eq(3, 30)], volume: 1 });
  const vnS = s.instrument('VlnSpic', { zones: 'violins_spic', oneShot: true, sampler: { ...one, level: 8 }, sends: { Hall: -10 }, volume: -6, pan: -0.3, inserts: [eq(3, 180)] });
  const vaS = s.instrument('VlaSpic', { zones: 'violas_spic', oneShot: true, sampler: { ...one, level: 8 }, sends: { Hall: -10 }, volume: -8, pan: 0.2, inserts: [eq(3, 120)] });
  const vcS = s.instrument('VcSpic', { zones: 'cellos_spic', oneShot: true, sampler: { ...one, level: 6 }, sends: { Hall: -12 }, volume: -6, pan: 0.3, inserts: [eq(3, 50)] });
  const vnT = s.instrument('VlnTrem', { zones: 'violins_trem', sampler: { attack: 400, release: 600, velocity: 40, level: 10 }, sends: { Hall: -8 }, volume: 1, pan: -0.25, inserts: [eq(3, 200)] });
  const vcT = s.instrument('VcTrem', { zones: 'cellos_trem', sampler: { attack: 500, release: 700, velocity: 40, level: 12 }, sends: { Hall: -8 }, volume: 8, pan: 0.25, inserts: [eq(3, 45)] });
  const tbS = s.instrument('TbnStab', { zones: 'trombones_stac', oneShot: true, maxShift: 7, sampler: { ...one, level: 6 }, sends: { Hall: -9 }, volume: -6, pan: 0.15 });
  const hnS = s.instrument('HornStab', { zones: 'horns_stac', oneShot: true, maxShift: 7, sampler: { ...one, level: 6 }, sends: { Hall: -8 }, volume: -14, pan: -0.15 });
  const hn = s.instrument('Horns', { zones: 'horns', maxShift: 7, sampler: { attack: 60, release: 500, velocity: 45, level: 6 }, sends: { Hall: -6 }, volume: 0, pan: -0.1 });
  const tb = s.instrument('Trombones', { zones: 'trombones', sampler: { attack: 60, release: 450, velocity: 45, level: 12 }, sends: { Hall: -7 }, volume: 6, pan: 0.15 });
  const ob = s.instrument('Oboe', { zones: 'oboe', sampler: { attack: 25, release: 220, velocity: 45, level: 8 }, sends: { Hall: -8 }, volume: 4, inserts: [eq(2, 4500, 2)] });
  const tp = s.instrument('Trumpet', { zones: 'trumpet', sampler: { attack: 30, release: 250, velocity: 45, level: 4 }, sends: { Hall: -8 }, volume: -5, pan: 0.1 });
  s.master('eq_1band', { type: 0, freq: 500, gain: -2.5, q: 0.8 });
  s.master('maximizer', { threshold: -3, ceiling: -1.5 }); // dense mix: keep inter-sample peaks under 0 dBTP

  // Percussion kit keys (zones.py): 36 concert bass drum, 38 snare, 39 snare roll, 41 tumba, 43 conga, 45 quinto,
  // 46 conga slap, 49 crash, 52 gong, 53/55 cymbal swells, 54 tambourine, 64-68 timpani hits (low..high), 69/70 rolls.
  const sec = k => ZONES.perc.find(z => z.root === k).seconds;
  const swellInto = (t, key = 55) => perc.note(key, t - (sec(key) - 0.25) * TPB * 144 / 60, sec(key) * TPB * 144 / 60, 90);

  // String spiccato ostinato on the chord root: 16ths with 3-3-2 accents and Phrygian-dominant neighbours.
  const OST = [0, 0, 1, 0, 0, 0, -2, 0, 0, 0, 1, 0, 4, 1, 0, -2];
  const ACC = [1, 0, 0, 1, 0, 0, 1, 0, 1, 0, 0, 1, 0, 0, 1, 0];
  const ostinato = (inst, t0, ch, base, vel) => OST.forEach((o, i) => inst.note(base + ((ch.root - base % 12 + 12) % 12) + o, t0 + i * S16 + h.t(5), S16, vel + (ACC[i] ? 18 : 0) + h.v(4)));
  const groove = (t0, vel = 100) => {
    drums(kit, t0, { 36: 'X..x..x.X..x..x.', 38: '....X.......X..x', 42: 'x.o.x.o.x.o.x.oo' }, { vel, h });
    drums(perc, t0, { 36: 'X.......X.......', 41: 'X..x..X.x..x..x.', 43: '..x..x....x..x.x', 45: 'o.o.oo.oo.o.oo.o' }, { vel: vel - 15, h });
  };
  const halfTime = (t0, vel = 100) => {
    drums(kit, t0, { 36: 'X.........x.....', 38: '........X.......', 42: 'x...x...x...x...' }, { vel, h });
    drums(perc, t0, { 36: 'X.......o.......', 64: 'X.......x.......' }, { vel: vel - 10, h });
  };
  const stabs = (t0, ch, vel, pattern = 'X..X..X.X.......') => {
    const tbV = voice(ch, 3, 46, 62), hnV = voice(ch, 2, 60, 72);
    [...pattern].forEach((c, i) => { if (c === '.') return;
      const v = vel + (c === 'X' ? 10 : 0);
      tbV.forEach(p => tbS.note(p, t0 + i * S16, S16 * 2, v + h.v()));
      hnV.forEach(p => hnS.note(p, t0 + i * S16 + 10, S16 * 2, v - 4 + h.v()));
    });
  };
  const bassLine = (t0, ch, vel, pattern = 'X.x.x.X.x.x.X.x.') => {
    const r = bassNote(ch, 26, 37);
    [...pattern].forEach((c, i) => { if (c !== '.') bass.note(i === 12 ? r + 12 : r, t0 + i * S16, S16 * 1.6, (c === 'X' ? vel + 12 : vel) + h.v()); });
  };
  let padV = null;
  const pad = (t0, ch, vel, beats = 4) => {
    padV = voice(ch, 2, 62, 76, padV);
    padV.forEach(p => vnT.note(p, t0 + 15, beats * TPB - 40, vel));
    vcT.note(bassNote(ch, 38, 50), t0, beats * TPB - 40, vel);
  };

  const sections = {};
  let bar = 0;
  for (const [name, len] of FORM) {
    sections[name] = [bar + 1, bar + len];
    const harm = HARM[name];
    for (let i = 0; i < len; i++) {
      const t0 = (bar + i) * BAR;
      const chs = barChords(harm[i]);
      const ch = chs[0].ch;
      switch (name) {
        case 'Intro':
          if (i === 0) { perc.note(52, t0, 6 * BAR, 100); perc.note(69, t0, 2 * BAR, 70); }
          if (i === 4) perc.note(69, t0, 2 * BAR, 85);
          if (i % 2 === 0) perc.note(36, t0, BAR, 85 + i * 3);
          vcT.note(38, t0, BAR - 30, 46 + i * 2);
          if (i >= 4) vnT.note(i < 6 ? 69 : 74, t0, BAR - 30, 40 + i * 3);
          bass.note(26, t0, BAR - 20, 70 + i * 3);
          if (i === 7) { swellInto(t0 + BAR); stabs(t0, ch, 90, '............X..X'); }
          break;
        case 'Build':
          ostinato(vnS, t0, ch, 62, 62 + i * 3);
          if (i >= 4) ostinato(vcS, t0, ch, 38, 60 + i * 3);
          drums(perc, t0, i < 4 ? { 36: 'X.......X.......', 41: 'X..x..x.x.......' } : { 36: 'X.......X.......', 41: 'X..x..X.x..x..x.', 43: '..x..x....x..x.x' }, { vel: 80 + i * 3, h });
          if (i >= 2) drums(kit, t0, { 42: 'x.o.x.o.x.o.x.oo' }, { vel: 70 + i * 4, h });
          bassLine(t0, ch, 78 + i * 2, i < 4 ? 'X.......X.......' : 'X.x.x.X.x.x.X.x.');
          if (i % 2 === 1) stabs(t0, ch, 82 + i * 2, '........X..X..X.');
          if (i === 7) { swellInto(t0 + BAR, 53); drums(kit, t0 + BAR / 2, { 45: 'x.x.x.x.', 50: '.x.x.x.x' }, { vel: 105, h }); }
          break;
        case 'Hook': case 'Hook2':
          groove(t0, name === 'Hook2' ? 108 : 100);
          ostinato(vnS, t0, ch, 62, 72); ostinato(vaS, t0, ch, 55, 66);
          bassLine(t0, ch, 88);
          if (i % 2 === 0) stabs(t0, ch, name === 'Hook2' ? 100 : 92);
          if (i % 8 === 0) perc.note(49, t0, 2 * BAR, 100);
          if (name === 'Hook2') pad(t0, ch, 58);
          break;
        case 'Call':
          groove(t0, 96);
          bassLine(t0, ch, 86, 'X..x..X.X..x..x.');
          if (i % 2 === 0) stabs(t0, ch, 104, 'X..X..X.X..X..X.');
          else ostinato(vnS, t0, ch, 62, 66);
          ostinato(vcS, t0, ch, 38, 64);
          if (i === 15) swellInto(t0 + BAR);
          break;
        case 'Hero': case 'Hero2':
          if (name === 'Hero2') groove(t0, 100); else halfTime(t0, i < 2 ? 85 : 98);
          for (const { ch: c, at, beats } of chs) {
            pad(t0 + at * TPB, c, name === 'Hero2' ? 64 : 54 + Math.min(i, 6), beats);
            bass.note(bassNote(c, 26, 37), t0 + at * TPB, beats * TPB - 30, 92);
          }
          if (i % 4 === 0) perc.note(i % 8 === 0 ? 52 : 49, t0, 3 * BAR, name === 'Hero' && i === 0 ? 110 : 85);
          if (name === 'Hero2') ostinato(vcS, t0, ch, 38, 66);
          break;
        case 'Thavil': {
          // Thavil-style solo: call (bars 1, 3, 5) and answer (2, 4, 6), then a roll into the Rise.
          const calls = [
            { 41: 'X..x..X.x.x.X...', 43: '..x..x.....x..x.' }, { 45: 'X.xx.xX.x.xxX.x.', 46: '....x.......x...' },
            { 41: 'X.x.X..xX.x.X..x', 43: '.x...x...x...x..' }, { 45: 'XxxXxxXxXxxXxxXx' },
            { 41: 'X..X..X.X..X..X.', 43: 'x.x..x.xx.x..x.x' }, { 45: 'X.X.XX.XX.X.XX.X', 46: '..x....x..x....x' },
            { 41: 'X.x.x.X.x.x.X.x.', 43: '.x.x.x.x.x.x.x.x', 45: 'x.x.x.x.x.x.x.x.' }, { 41: 'XxXxXxXxXxXxXxXx', 43: 'xXxXxXxXxXxXxXxX' },
          ];
          drums(perc, t0, calls[i], { vel: 92 + (i >= 6 ? (i - 5) * 6 : 0), h });
          drums(kit, t0, { 36: 'X.......X.......' }, { vel: 95, h });
          vcT.note(38, t0, BAR - 30, 50); // no bass drone here: the hand drums carry the section
          break;
        }
        case 'Rise':
          ostinato(vnS, t0, ch, 62 + Math.floor(i / 2) * 2, 66 + i * 4); ostinato(vaS, t0, ch, 55, 62 + i * 4);
          ostinato(vcS, t0, ch, 38, 62 + i * 4);
          drums(kit, t0, { 36: 'X.......X.......', 42: 'x.x.x.x.x.x.x.x.' }, { vel: 80 + i * 4, h });
          if (i >= 4) perc.note(39, t0, BAR, 55 + (i - 4) * 18);
          bassLine(t0, ch, 80 + i * 3, 'X.x.x.x.X.x.x.x.');
          if (i === 7) { swellInto(t0 + BAR); drums(kit, t0, { 45: 'x.x.x.x.xxxxxxxx', 50: '.x.x.x.xxxxxxxxx' }, { vel: 108, h }); }
          break;
        case 'Outro':
          if (i < 4) { groove(t0, 104); ostinato(vnS, t0, ch, 62, 74); bassLine(t0, ch, 90); if (i % 2 === 0) stabs(t0, ch, 100); }
          else if (i < 7) {
            stabs(t0, ch, 108, 'X..X..X.........');
            drums(perc, t0, { 36: 'X..X..X.........', 64: 'X..X..X.........' }, { vel: 105, h });
            drums(kit, t0, { 36: 'X..X..X.........' }, { vel: 110, h });
            bass.note(26, t0, TPB * 2, 100);
          } else {
            stabs(t0, ch, 115, 'X...............');
            perc.note(52, t0, 3 * BAR, 115); perc.note(36, t0, 2 * BAR, 120); perc.note(64, t0, 2 * BAR, 120);
            kit.note(49, t0, 2 * BAR, 115); bass.note(26, t0, BAR, 105);
          }
          break;
      }
    }
    const t0 = bar * BAR;
    if (name === 'Hook') melody(ob, t0, HOOK, 78, { h, lift: 0.4 });
    if (name === 'Hook2') { melody(ob, t0, HOOK, 82, { h, lift: 0.4 }); melody(tp, t0, HOOK, 74, { h, shift: -12, lift: 0.3 }); }
    if (name === 'Call') ANSWER.concat(ANSWER).forEach((b, k) => melody(ob, t0 + (2 * k + 1) * BAR, [b], 80, { h, lift: 0.4 }));
    if (name === 'Hero' || name === 'Hero2') {
      const bars = name === 'Hero' ? HERO : HERO.slice(0, 8);
      melody(hn, t0, bars, name === 'Hero' ? 70 : 78, { h, legato: 40, lift: 0.3 });
      melody(tb, t0, bars, name === 'Hero' ? 64 : 74, { h, legato: 40, shift: -12, lift: 0.3 });
    }
    if (name === 'Outro') melody(ob, t0, HOOK.slice(0, 4), 82, { h, lift: 0.4 });
    bar += len;
  }
  return { session: s, endTicks: (bar + 5) * BAR, sections }; // the gong needs ~8 s to ring out
}
