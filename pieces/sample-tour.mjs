// Sample tour: a listening test of the libraries added 2026-10-21 (Iowa MIS, Philharmonia), not a release.
// Render: node tools/render.mjs pieces/sample-tour.mjs --stems
// Each instrument plays the same short phrase on its own (2 bars, sections named after the zone), at sampler level 0,
// so per-section RMS compares the libraries' raw levels. First an A/B over the old VSCO horn gap (C4-D5).

import { Session, TPB } from '../tools/lib/session.mjs';

// [zone, centre note, kind]: 'sus' = held notes, 'pluck' = eighth-note arpeggio, 'kit' = one hit per key
const TOUR = [
  ['horns', 65, 'scale'], ['horns_iowa', 65, 'scale'],
  ['horns_iowa', 60, 'sus'], ['trumpet_iowa', 72, 'sus'], ['trombone_iowa', 55, 'sus'], ['tuba_iowa', 41, 'sus'],
  ['flute_iowa', 79, 'sus'], ['flute_plain', 79, 'sus'], ['alto_flute', 72, 'sus'], ['bass_flute', 62, 'sus'], ['oboe_iowa', 72, 'sus'],
  ['cor_anglais', 67, 'sus'], ['soprano_sax', 72, 'sus'], ['alto_sax', 64, 'sus'], ['clarinet_iowa', 67, 'sus'], ['bassoon', 50, 'sus'], ['bass_clarinet', 55, 'sus'],
  ['violin_solo', 76, 'sus'], ['viola_solo', 64, 'sus'], ['cello_solo', 52, 'sus'], ['bass_arco', 38, 'sus'],
  ['violin_solo_pizz', 69, 'pluck'], ['cello_solo_pizz', 50, 'pluck'], ['bass_pizz', 38, 'pluck'],
  ['mandolin', 72, 'pluck'], ['mandolin_trem', 72, 'sus'], ['guitar', 57, 'pluck'], ['banjo', 64, 'pluck'],
  ['vibes_bow', 70, 'sus'], ['marimba_yarn', 67, 'pluck'], ['marimba_roll', 67, 'sus'], ['crotales', 96, 'pluck'], ['thai_gong', 66, 'pluck'],
  ['phil_perc', 0, 'kit'],
];
const SUS = [[-5, 2], [0, 2], [4, 1], [2, 1], [0, 2]];           // beats
const PLUCK = [-5, 0, 4, 7, 4, 0, -5, 0, -3, 0, 4, 7, 4, 0, -5, 0]; // eighths

export default function () {
  const s = new Session({ bpm: 90 });
  const BAR = s.bar;
  s.reverb('Room', 'room_reverb', { decay: 1.2, pre_delay: 10, damping: 9000, size: 45, low_cut: 250 });
  s.master('maximizer', { threshold: 0, ceiling: -1 });
  const sections = {};
  const insts = {};
  let bar = 0;
  TOUR.forEach(([zone, c, kind], i) => {
    const key = `${zone}${kind === 'scale' ? ' gap' : ''}`;
    const name = key.replace(/[^a-z]/gi, '');
    insts[key] ??= s.instrument(name, { zones: zone, oneShot: kind !== 'sus' && kind !== 'scale', sampler: { attack: kind === 'sus' ? 30 : 0.5, release: 400, velocity: 50 }, sends: { Room: -10 }, maxShift: 7 }); // VSCO horn needs 7 over its gap
    const inst = insts[key], t0 = bar * BAR;
    if (kind === 'scale') for (let k = 0; k <= 14; k++) inst.note(60 + k, t0 + k * TPB / 2, TPB / 2 - 30, 90);      // C4..D5 chromatic, eighths
    if (kind === 'sus') { let t = t0; for (const [d, b] of SUS) { inst.note(c + d, t, b * TPB - 40, 90); t += b * TPB; } }
    if (kind === 'pluck') PLUCK.forEach((d, k) => inst.note(c + d, t0 + k * TPB / 2, TPB / 2, 90));
    if (kind === 'kit') for (let k = 60; k <= 83; k++) inst.note(k, t0 + (k - 60) * TPB, TPB, 100);           // 24 keys, one per beat
    const len = kind === 'kit' ? 6 : 2;
    sections[`${i + 1} ${key}`] = [bar + 1, bar + len];
    bar += len + 1;  // a bar of silence between instruments
  });
  return { session: s, endTicks: (bar + 1) * BAR, sections };
}
