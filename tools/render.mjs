// Renders a piece: node tools/render.mjs pieces/<name>.mjs
// Writes work/<name>.txt (generated script), out/<name>.scraft and out/<name>.wav, verifies the
// predicted clip ids against SoundCraft's output, then prints measurements (tools/measure.py).

import { mkdirSync, writeFileSync } from 'node:fs';
import { spawnSync } from 'node:child_process';
import path from 'node:path';
import { pathToFileURL } from 'node:url';
import { ensureFiles } from './assets.mjs';

const CLI = 'C:/Program Files/SoundCraft/soundcraft-cli.exe';
// Ask the shell for the real interpreter once: shims such as pyenv-win's python.bat can't be spawned directly.
const PY = process.env.PYTHON ?? spawnSync('python -c "import sys; print(sys.executable)"', { shell: true, encoding: 'utf8' }).stdout?.trim();
const python = args => {
  const r = spawnSync(PY || 'python', args, { stdio: 'inherit' });
  if (r.error || r.status !== 0) { console.error(`measure.py failed: ${r.error?.message ?? `exit ${r.status}`}`); process.exitCode = 1; }
};
const piecePath = path.resolve(process.argv[2]);
const name = path.basename(piecePath, '.mjs');
const root = path.resolve(path.dirname(new URL(import.meta.url).pathname.replace(/^\/([A-Za-z]:)/, '$1')), '..');
const { default: piece } = await import(pathToFileURL(piecePath));
const { session, endTicks, sections, ref } = piece(); // ref: optional refs/<name>.profile.json to compare the mix with
const { script, expectedClips, trackCount } = session.build(endTicks);

// Samples not on disk yet come from R2 (tools/assets.mjs).
const samples = [...script.matchAll(/"path":"([^"]+)"/g)].map(m => path.relative(root, m[1]).split(path.sep).join('/'));
const unavailable = await ensureFiles(samples);
if (unavailable.length) { console.error(`${unavailable.length} samples missing locally and in R2, first: ${unavailable[0]}`); process.exit(1); }

for (const d of ['work', 'out']) mkdirSync(path.join(root, d), { recursive: true });
const scriptPath = path.join(root, 'work', `${name}.txt`);
writeFileSync(scriptPath, script);
console.log(`${name}: ${trackCount} zone tracks, ${script.split('\n').length} commands`);

const t0 = Date.now();
const r = spawnSync(CLI, ['script', scriptPath, '--save', path.join(root, 'out', `${name}.scraft`), '--bounce', path.join(root, 'out', `${name}.wav`)], { encoding: 'utf8', maxBuffer: 1 << 28 });
if (r.status !== 0) { console.error(r.stderr || r.stdout); process.exit(1); }
const clips = [...r.stdout.matchAll(/^midi\.new_clip: \{"clip":(\d+)/gm)].map(m => +m[1]);
if (clips.join() !== expectedClips.join()) { console.error(`clip ids differ: expected ${expectedClips.slice(0, 5)}…, got ${clips.slice(0, 5)}…`); process.exit(1); }
const bounce = r.stdout.split('\n').find(l => l.includes('"lufs"'));
console.log(bounce, `(${((Date.now() - t0) / 1000).toFixed(0)} s)`);
// The maximizer limits sample peaks; inter-sample peaks can still pass and clip after MP3 encoding.
const tp = JSON.parse(bounce).true_peak_db;
if (tp > -0.95) console.warn(`TRUE PEAK: ${tp.toFixed(2)} dBTP, above -1 dBTP: lower the maximizer ceiling by ${(tp + 1).toFixed(1)} dB`);

const bpm = session.bpm, beats = session.bar / 960;
const args = ['-I', path.join(root, 'tools', 'measure.py'), path.join(root, 'out', `${name}.wav`), String(bpm), String(beats)];
if (sections) args.push(JSON.stringify(sections));
if (ref) args.push('--ref', path.join(root, ref));
python(args);

// --stems: re-bounce each instrument group alone (the others muted) and compare levels per section.
if (process.argv.includes('--stems')) {
  const groups = session.instruments.map(i => `${i.name} grp`);
  const stems = [];
  for (const g of groups) {
    const file = path.join(root, 'work', `${name}.stem.${g.split(' ')[0]}.wav`);
    spawnSync(CLI, ['run', '--in', path.join(root, 'out', `${name}.scraft`), '--cmd', `mix.mute=${JSON.stringify({ tracks: groups.filter(x => x !== g), mute: true })}`, '--bounce', file], { encoding: 'utf8' });
    stems.push(g.split(' ')[0], file);
  }
  python(['-I', path.join(root, 'tools', 'measure.py'), '--stems', String(bpm), String(beats), JSON.stringify(sections ?? {}), ...stems]);
}
