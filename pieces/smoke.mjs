// Pipeline smoke test: 4 bars of piano, cellos, harp through groups, a shared reverb and a master limiter.
import { Session, TPB } from '../tools/lib/session.mjs';
export default function () {
  const s = new Session({ bpm: 76 });
  const B = s.bar;
  s.reverb('Hall', 'plate_reverb', { decay: 2.4, pre_delay: 20 });
  const pno = s.instrument('Piano', { zones: 'piano', sampler: { attack: 0.5, release: 450, velocity: 35 }, sends: { Hall: -10 } });
  const vc = s.instrument('Cellos', { zones: 'cellos', sampler: { attack: 300, release: 700, velocity: 40 }, sends: { Hall: -6 }, volume: -6 });
  const hp = s.instrument('Harp', { zones: 'harp', sampler: { attack: 0.5, release: 1500 }, sends: { Hall: -6 }, volume: -6 });
  ['Eb3', 'Bb3', 'G4', 'Bb4'].forEach((n, i) => pno.note(n, 0, B - 20, 50 + i * 5));
  [['G5', 0, 2], ['F5', 2, 1], ['Eb5', 3, 1]].forEach(([n, b, l]) => pno.note(n, b * TPB, l * TPB - 10, 80));
  vc.note('Eb3', 0, 2 * B - 20, 70);
  ['Eb3', 'G3', 'Bb3', 'Eb4', 'G4', 'Bb4', 'Eb5'].forEach((n, i) => hp.note(n, B + i * TPB / 4, B, 80));
  s.master('maximizer', { threshold: -3, ceiling: -1 });
  return { session: s, endTicks: 2 * B, sections: { All: [1, 3] } };
}
