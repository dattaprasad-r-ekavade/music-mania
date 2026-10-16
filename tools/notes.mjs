// Prints a piece's notes as JSON, for tools/similarity.py:
//   node tools/notes.mjs pieces/<name>.mjs > work/<name>.notes.json
// { bpm, instruments: { name: { percussive, notes: [[midi, start_beats, length_beats, velocity], …] } } }

import path from 'node:path';
import { pathToFileURL } from 'node:url';
import { TPB } from './lib/session.mjs';

const { default: piece } = await import(pathToFileURL(path.resolve(process.argv[2])));
const { session } = piece();
const instruments = {};
for (const inst of session.instruments)
  instruments[inst.name] = {
    percussive: !!(inst.zones?.[0]?.exact || inst.synth?.plugin === 'drum_synth'),
    notes: inst.notes.map(n => [n.pitch, n.start / TPB, n.length / TPB, n.velocity]).sort((a, b) => a[1] - b[1]),
  };
process.stdout.write(JSON.stringify({ bpm: session.bpm, instruments }));
