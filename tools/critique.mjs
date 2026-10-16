// Melody critique from a piece's notes (no samples, no rendering):
//   node tools/critique.mjs pieces/<name>.mjs <Instrument> [--harmony Piano,Violas] [--json]
// Reads session.instruments[…].notes (ticks, TPB per beat), takes the instrument's top line (grace notes dropped),
// and reports tools/lib/theory.mjs stats against targets for the whole line and per section where it plays.
// Harmony for the chord-tone check is inferred from the other pitched instruments (or --harmony): the pitch
// classes sounding at the beat or struck within it (catches arpeggios), plus the fifth above the lowest of them
// (voicings often drop it).
// Then, per other instrument: parallel fifths/octaves against the lead, and register crowding.

import path from 'node:path';
import { pathToFileURL } from 'node:url';
import { TPB } from './lib/session.mjs';
import { fromNotes, critique, parallelsAgainst, registerAgainst, melodyStats, noteName } from './lib/theory.mjs';

const args = process.argv.slice(2);
const opt = k => { const i = args.indexOf(k); return i < 0 ? null : args[i + 1]; };
const [file, instName] = args.filter((a, i) => !a.startsWith('--') && !['--harmony'].includes(args[i - 1]));
if (!file || !instName) { console.error('usage: node tools/critique.mjs pieces/<name>.mjs <Instrument> [--harmony A,B] [--json]'); process.exit(1); }

const { default: piece } = await import(pathToFileURL(path.resolve(file)));
const { session, sections = {} } = piece();
const beats = session.bar / TPB;
const percussive = i => !!(i.zones?.[0]?.exact || i.synth?.plugin === 'drum_synth');
const lead = session.instruments.find(i => i.name === instName);
if (!lead) { console.error(`no instrument ${instName}; have ${session.instruments.map(i => i.name).join(', ')}`); process.exit(1); }
const others = session.instruments.filter(i => i !== lead && !percussive(i) && i.notes.length);
const hNames = opt('--harmony')?.split(',');
const hInst = hNames ? session.instruments.filter(i => hNames.includes(i.name)) : others;

// t (beats) → pitch classes of the accompaniment.
const harmony = t => {
  const a = t * TPB, pcs = new Set();
  let low = null;
  for (const i of hInst) for (const n of i.notes)
    if ((n.start <= a + 60 && n.start + n.length > a) || (n.start >= a && n.start < a + TPB)) { pcs.add(n.pitch % 12); if (low == null || n.pitch < low) low = n.pitch; }
  if (low != null) pcs.add((low + 7) % 12);
  return pcs.size ? { pcs, sym: [...pcs].sort((x, y) => x - y).map(p => noteName(p + 60).replace(/-?\d+$/, '')).join('') } : null;
};

const json = args.includes('--json');
const report = { piece: file, instrument: instName, beats, whole: null, sections: {}, against: {} };
const line = fromNotes(lead.notes, { beats });
report.whole = critique(`${instName}, whole piece`, line, { harmony, beats, print: !json });

for (const [name, [b0, b1]] of Object.entries(sections)) {
  const seg = fromNotes(lead.notes, { beats, from: (b0 - 1) * session.bar, to: b1 * session.bar });
  if (seg.length < 6) continue;
  report.sections[name] = critique(`${instName}, ${name} (bars ${b0}-${b1})`, seg, { harmony, beats, print: !json });
}

// Section contrast: neighbours that sit in the same register at the same density read as one long section.
const named = Object.entries(report.sections);
if (!json && named.length > 1) {
  console.log('\n== Section contrast (median pitch, notes per active bar, on-beat %)');
  named.forEach(([n, r], k) => {
    const s = r.stats;
    let note = '';
    if (k) {
      const p = named[k - 1][1].stats;
      if (Math.abs(s.medianMidi - p.medianMidi) < 2 && Math.abs(s.notesPerBar / p.notesPerBar - 1) < 0.15) note = '  ! little contrast with the previous section';
    }
    console.log(`  ${n.padEnd(12)} ${s.median.padEnd(4)} ${String(s.notesPerBar).padEnd(5)} ${s.onBeatPct}%${note}`);
  });
}

// Against each other pitched part: parallels with its top line (and the lowest line for the lowest part), crowding.
const lowest = others.reduce((m, i) => { const lo = Math.min(...i.notes.map(n => n.pitch)); return !m || lo < m.lo ? { i, lo } : m; }, null)?.i;
if (!json) console.log('\n== Against other parts (parallel P5/P8 with their top line; lead on the same pitch class; other part above / within 2 st of the lead)');
for (const o of others) {
  const top = fromNotes(o.notes, { beats, lowest: o === lowest });
  const par = parallelsAgainst(line, top, { beats });
  const all = o.notes.map(n => ({ p: n.pitch, t: n.start / TPB, d: n.length / TPB }));
  const reg = registerAgainst(line, [all], { beats });
  report.against[o.name] = { ...par, ...reg };
  if (json || !par.simultaneities) continue;
  const ex = par.parallels.slice(0, 3).map(x => `bar ${x.bar}.${x.beat} ${x.type} ${x.lead.join('>')} vs ${x.other.join('>')}`).join('; ');
  console.log(`  ${o.name.padEnd(12)} ${o === lowest ? "(bass line) " : ""}${par.simultaneities} shared onsets, parallels ${par.parallels.length}${ex ? ` (${ex})` : ''}  same pc ${par.doublingPct}%  above ${reg.abovePct}%  near ${reg.nearPct}%`);
}
if (json) process.stdout.write(JSON.stringify(report, null, 1));
