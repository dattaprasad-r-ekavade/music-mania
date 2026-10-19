// Builds YouTube-ready videos: node video/make.mjs golden-hour [neon-bhairav ...]   (no names = every scene)
// 1. Remotion renders the 60 s seamless pixel-art loop (work/video/<name>.loop.mp4).
// 2. ffmpeg repeats the loop for the length of out/<name>.wav (pulled from R2 if missing), adds the audio,
//    fades the picture in and out: out/<name>.video.mp4.
// 3. A thumbnail (out/<name>.thumb.jpg, 1280x720) and an upload text (out/<name>.youtube.txt).
// 4. Uploads all three to R2 (out/ is not in git).

import { spawnSync } from 'node:child_process';
import { existsSync, mkdirSync, writeFileSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const HERE = path.dirname(fileURLToPath(import.meta.url)), ROOT = path.resolve(HERE, '..');
const run = (cmd, args, opts = {}) => {
  const r = spawnSync(cmd, args, { stdio: 'inherit', shell: process.platform === 'win32', cwd: opts.cwd ?? ROOT });
  if (r.status !== 0) { console.error(`${cmd} ${args.slice(0, 3).join(' ')} failed`); process.exit(1); }
};
const q = s => `"${s}"`; // shell: true on Windows needs quoted paths

const INFO = {
  'golden-hour': { title: 'Golden Hour', mood: 'a riverside promenade at sunset', tags: 'lofi, sunset, pixel art, piano, strings, study music, relaxing' },
  'neon-bhairav': { title: 'Neon Bhairav', mood: 'a cyberpunk Indian city at night, built on raga Bhairav', tags: 'cyberpunk, synthwave, indian fusion, raga, pixel art, night city' },
  'pahadi-winter': { title: 'Pahadi Winter', mood: 'a Himalayan ridge at dawn, in raga Pahadi', tags: 'himalaya, winter, bansuri, raga pahadi, pixel art, calm, study music' },
};
const CREDIT = 'Piano: Salamander Grand Piano by Alexander Holm (CC BY 3.0). Orchestral samples: VSCO 2 Community Edition by Versilian Studios and Simon Dalzell. Additional samples: Versilian Community Sample Library (VCSL) by Versilian Studios.';

const names = process.argv.slice(2).length ? process.argv.slice(2) : Object.keys(INFO);
mkdirSync(path.join(ROOT, 'work', 'video'), { recursive: true });
for (const name of names) {
  const info = INFO[name];
  if (!info) { console.error(`no scene for ${name}`); process.exit(1); }
  const wav = path.join(ROOT, 'out', `${name}.wav`);
  if (!existsSync(wav)) run('node', [q('tools/assets.mjs'), 'pull', `out/${name}.wav`]);
  const loop = path.join(ROOT, 'work', 'video', `${name}.loop.mp4`);
  run('npx', ['remotion', 'render', 'src/index.js', name, q(loop), '--codec=h264', '--crf=16', '--log=error'], { cwd: HERE });

  const probe = spawnSync('ffprobe', ['-v', 'error', '-show_entries', 'format=duration', '-of', 'csv=p=0', wav], { encoding: 'utf8' });
  const dur = parseFloat(probe.stdout);
  const video = path.join(ROOT, 'out', `${name}.video.mp4`);
  run('ffmpeg', ['-loglevel', 'error', '-y', '-stream_loop', '-1', '-i', q(loop), '-i', q(wav), '-t', dur.toFixed(3), '-map', '0:v:0', '-map', '1:a:0',
    '-vf', q(`fade=t=in:st=0:d=1.5,fade=t=out:st=${(dur - 3).toFixed(2)}:d=3`), '-c:v', 'libx264', '-preset', 'medium', '-crf', '20', '-pix_fmt', 'yuv420p',
    '-c:a', 'aac', '-b:a', '320k', '-movflags', '+faststart', q(video)]);

  const still = path.join(ROOT, 'work', 'video', `${name}.thumb.png`), thumb = path.join(ROOT, 'out', `${name}.thumb.jpg`);
  run('npx', ['remotion', 'still', 'src/index.js', name, q(still), '--frame=900', '--log=error'], { cwd: HERE });
  run('ffmpeg', ['-loglevel', 'error', '-y', '-i', q(still), '-vf', 'scale=1280:720:flags=neighbor', '-q:v', '2', q(thumb)]);

  const mm = `${Math.floor(dur / 60)}:${String(Math.round(dur % 60)).padStart(2, '0')}`;
  writeFileSync(path.join(ROOT, 'out', `${name}.youtube.txt`), [
    `TITLE: ${info.title} | pixel art lofi ambience | Music Mania`,
    '',
    `${info.title} (${mm}): an original instrumental, with a looping pixel-art scene of ${info.mood}.`,
    'Put it on while you work, study or unwind.',
    '',
    'Composed and arranged as code and rendered with SoundCraft; visuals made with Remotion.',
    'Made with AI assistance (Claude) under the creator\'s direction. Tick YouTube\'s "altered or synthetic content" box if it applies.',
    '',
    CREDIT,
    '',
    `TAGS: ${info.tags}`,
  ].join('\n'));

  run('node', [q('tools/assets.mjs'), 'push', `out/${name}.video.mp4`, `out/${name}.thumb.jpg`, `out/${name}.youtube.txt`]);
  console.log(`${name}: ${video} (${mm})`);
}
