// Renders a piece: node tools/render.mjs pieces/<name>.mjs
// Writes work/<name>.txt (generated script), out/<name>.scraft and out/<name>.wav, verifies the
// predicted clip ids against SoundCraft's output, then prints measurements (tools/measure.py).

import { mkdirSync, writeFileSync } from 'node:fs';
import { spawnSync } from 'node:child_process';
import path from 'node:path';
import { pathToFileURL } from 'node:url';

const CLI = 'C:/Program Files/SoundCraft/soundcraft-cli.exe';
const piecePath = path.resolve(process.argv[2]);
const name = path.basename(piecePath, '.mjs');
const root = path.resolve(path.dirname(new URL(import.meta.url).pathname.replace(/^\/([A-Za-z]:)/, '$1')), '..');
const { default: piece } = await import(pathToFileURL(piecePath));
const { session, endTicks, sections } = piece();
const { script, expectedClips, trackCount } = session.build(endTicks);

for (const d of ['work', 'out']) mkdirSync(path.join(root, d), { recursive: true });
const scriptPath = path.join(root, 'work', `${name}.txt`);
writeFileSync(scriptPath, script);
console.log(`${name}: ${trackCount} zone tracks, ${script.split('\n').length} commands`);

const t0 = Date.now();
const r = spawnSync(CLI, ['script', scriptPath, '--save', path.join(root, 'out', `${name}.scraft`), '--bounce', path.join(root, 'out', `${name}.wav`)], { encoding: 'utf8', maxBuffer: 1 << 28 });
if (r.status !== 0) { console.error(r.stderr || r.stdout); process.exit(1); }
const clips = [...r.stdout.matchAll(/^midi\.new_clip: \{"clip":(\d+)/gm)].map(m => +m[1]);
if (clips.join() !== expectedClips.join()) { console.error(`clip ids differ: expected ${expectedClips.slice(0, 5)}…, got ${clips.slice(0, 5)}…`); process.exit(1); }
console.log(r.stdout.split('\n').filter(l => l.includes('"lufs"')).join('\n'), `(${((Date.now() - t0) / 1000).toFixed(0)} s)`);

const bpm = session.bpm, beats = session.bar / 960;
const args = ['-I', path.join(root, 'tools', 'measure.py'), path.join(root, 'out', `${name}.wav`), String(bpm), String(beats)];
if (sections) args.push(JSON.stringify(sections));
spawnSync('python', args, { stdio: 'inherit' });

// --stems: re-bounce each instrument group alone (the others muted) and compare levels per section.
if (process.argv.includes('--stems')) {
  const groups = session.instruments.map(i => `${i.name} grp`);
  const stems = [];
  for (const g of groups) {
    const file = path.join(root, 'work', `${name}.stem.${g.split(' ')[0]}.wav`);
    spawnSync(CLI, ['run', '--in', path.join(root, 'out', `${name}.scraft`), '--cmd', `mix.mute=${JSON.stringify({ tracks: groups.filter(x => x !== g), mute: true })}`, '--bounce', file], { encoding: 'utf8' });
    stems.push(g.split(' ')[0], file);
  }
  spawnSync('python', ['-I', path.join(root, 'tools', 'measure.py'), '--stems', String(bpm), String(beats), JSON.stringify(sections ?? {}), ...stems], { stdio: 'inherit' });
}
