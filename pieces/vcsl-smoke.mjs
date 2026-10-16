// VCSL smoke test: every instrument added from VCSL, two bars each in turn over a soft upright,
// so a render shows whether each one loads, sits at a usable level and stays in tune.
// Render: node tools/render.mjs pieces/vcsl-smoke.mjs --stems
import { Session, TPB } from '../tools/lib/session.mjs';

export default function () {
  const s = new Session({ bpm: 84 });
  const B = s.bar;
  s.reverb('Hall', 'plate_reverb', { decay: 2.2, pre_delay: 20, damping: 9000 });
  const up = s.instrument('Upright', { zones: 'upright', sampler: { attack: 0.5, release: 400 }, sends: { Hall: -12 }, volume: -4 });
  const vib = s.instrument('Vibes', { zones: 'vibes', oneShot: true, sampler: { attack: 0.5, release: 900 }, sends: { Hall: -10 } });
  const sax = s.instrument('Sax', { zones: 'tenor_sax_vib', sampler: { attack: 30, release: 300 }, sends: { Hall: -10 } });
  const dt = s.instrument('DanTranh', { zones: 'dan_tranh', oneShot: true, sampler: { attack: 0.5, release: 900 }, sends: { Hall: -10 } });
  const kal = s.instrument('Kalimba', { zones: 'kalimba', oneShot: true, sampler: { attack: 0.5, release: 900 }, sends: { Hall: -10 } });
  const hand = s.instrument('Hand', { zones: 'hand', oneShot: true, sampler: { attack: 0.5, release: 300 }, sends: { Hall: -16 } });
  s.master('maximizer', { threshold: -3, ceiling: -1.5 });

  const chords = [['D3', 'F3', 'A3', 'C4'], ['G2', 'F3', 'B3', 'E4'], ['C3', 'E3', 'G3', 'B3'], ['A2', 'G3', 'C#4', 'E4']];
  for (let bar = 0; bar < 10; bar++) chords[bar % 4].forEach((n, i) => up.note(n, bar * B + i * 30, B - 60, 46 + i * 2));
  const line = ['A4', 'C5', 'E5', 'D5', 'C5', 'A4', 'G4', 'E4'];
  const play = (inst, bar, vel, len = TPB / 2) => line.forEach((n, i) => inst.note(n, bar * B + i * TPB / 2, len, vel));
  play(vib, 0, 70, TPB);
  play(dt, 2, 80, TPB);
  play(kal, 4, 90, TPB);
  line.forEach((n, i) => sax.note(n, 6 * B + i * TPB, TPB - 40, 80));   // half speed: a sustained lead
  // Hand drums: a keherwa-like 8-beat cycle on darbuka (60 doum, 62 tek), frame drum and bongos.
  for (let bar = 0; bar < 8; bar++)
    [[60, 0], [62, 1], [64, 1.5], [62, 2], [65, 3], [70, 3.5]].forEach(([k, beat]) => hand.note(k, bar * B + beat * TPB, TPB / 2, beat === 0 ? 96 : 70));
  return { session: s, endTicks: 12 * B, sections: { Vibes: [1, 2], DanTranh: [3, 4], Kalimba: [5, 6], Sax: [7, 9], Tail: [10, 12] } };
}
