// Large files live in Cloudflare R2 (bucket in .env), not in git or on a full disk.
//
//   node tools/assets.mjs status                          objects and size per top-level prefix in R2
//   node tools/assets.mjs mirror OWNER/REPO PREFIX [DIR…]  copy a GitHub repo (or some of its folders) into R2 under PREFIX,
//                                                         one file at a time in memory (nothing written to disk)
//   node tools/assets.mjs push PATH…                      upload local files or folders (key = repo-relative path)
//   node tools/assets.mjs pull PREFIX                     download every object under PREFIX to the same local path
//   node tools/assets.mjs need pieces/<name>.mjs…         download only the samples these pieces use
//   node tools/assets.mjs prune                           delete the local sample cache (samples/*/ folders), keeping zones.json
//
// Keys mirror repo paths: samples/salamander/…, samples/vsco2/…, samples/vcsl/…, out/<name>.wav.
// render.mjs calls ensureFiles() so a render fetches its missing samples by itself.

import { createHash } from 'node:crypto';
import { existsSync, mkdirSync, readdirSync, readFileSync, rmSync, statSync, writeFileSync } from 'node:fs';
import { fileURLToPath, pathToFileURL } from 'node:url';
import path from 'node:path';
import { r2 } from './lib/r2.mjs';

export const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const rel = p => path.relative(ROOT, path.resolve(p)).split(path.sep).join('/');
const md5 = b => createHash('md5').update(b).digest('hex');
const mb = n => `${(n / 1e6).toFixed(1)} MB`;
const TYPES = { wav: 'audio/wav', mp3: 'audio/mpeg', flac: 'audio/flac', aif: 'audio/aiff', json: 'application/json', txt: 'text/plain', sfz: 'text/plain' };
const typeOf = key => TYPES[key.split('.').pop().toLowerCase()] ?? 'application/octet-stream';

// Run fn over items with a few requests in flight; retries each item twice.
async function pool(items, n, fn) {
  let i = 0, failed = [];
  await Promise.all(Array.from({ length: n }, async () => {
    while (i < items.length) {
      const item = items[i++];
      for (let attempt = 0; ; attempt++) {
        try { await fn(item); break; } catch (e) { if (attempt === 2) { failed.push(item); console.error(String(e.message ?? e)); break; } }
      }
    }
  }));
  return failed;
}

// Download any of these repo-relative paths that are missing locally. Returns the paths still missing.
export async function ensureFiles(paths, client = null) {
  const missing = [...new Set(paths)].filter(p => !existsSync(path.join(ROOT, p)));
  if (!missing.length) return [];
  client ??= r2();
  let bytes = 0;
  const failed = await pool(missing, 8, async p => {
    const body = await client.get(p);
    mkdirSync(path.dirname(path.join(ROOT, p)), { recursive: true });
    writeFileSync(path.join(ROOT, p), body);
    bytes += body.length;
  });
  console.log(`fetched ${missing.length - failed.length} files (${mb(bytes)}) from R2`);
  return failed;
}

// Repo-relative sample paths a piece loads (from its generated script).
export async function samplesFor(piecePath) {
  const { default: piece } = await import(pathToFileURL(path.resolve(piecePath)));
  const { session, endTicks } = piece();
  const warn = console.warn; console.warn = () => {};
  try { return [...session.build(endTicks).script.matchAll(/"path":"([^"]+)"/g)].map(m => rel(m[1])); } finally { console.warn = warn; }
}

const walk = p => statSync(p).isDirectory() ? readdirSync(p).flatMap(f => walk(path.join(p, f))) : [p];

async function main() {
  const [cmd, ...args] = process.argv.slice(2);
  const c = r2();
  if (cmd === 'status') {
    const by = {};
    for (const o of await c.list()) { const k = o.key.split('/').slice(0, o.key.startsWith('samples/') ? 2 : 1).join('/'); (by[k] ??= [0, 0])[0]++; by[k][1] += o.size; }
    for (const [k, [n, s]] of Object.entries(by)) console.log(`${k.padEnd(24)} ${String(n).padStart(6)} files ${(s / 1e9).toFixed(2).padStart(7)} GB`);
  } else if (cmd === 'mirror') {
    const [repo, prefix, ...dirs] = args;
    const tree = await (await fetch(`https://api.github.com/repos/${repo}/git/trees/HEAD?recursive=1`)).json();
    if (!tree.tree || tree.truncated) throw new Error(`GitHub tree for ${repo}: ${tree.message ?? 'truncated'}`);
    const have = new Map((await c.list(prefix + '/')).map(o => [o.key, o.size]));
    const todo = tree.tree.filter(x => x.type === 'blob' && (!dirs.length || dirs.some(d => x.path.startsWith(d + '/'))) && have.get(`${prefix}/${x.path}`) !== x.size);
    console.log(`${repo}: ${todo.length} files to copy (${mb(todo.reduce((s, x) => s + x.size, 0))}), ${have.size} already in R2`);
    let done = 0, bytes = 0;
    const failed = await pool(todo, 8, async x => {
      const url = `https://raw.githubusercontent.com/${repo}/HEAD/${x.path.split('/').map(encodeURIComponent).join('/')}`;
      const res = await fetch(url);
      if (!res.ok) throw new Error(`GET ${x.path}: ${res.status}`);
      const body = Buffer.from(await res.arrayBuffer());
      if (body.length !== x.size) throw new Error(`${x.path}: got ${body.length} bytes, expected ${x.size}`);
      await c.put(`${prefix}/${x.path}`, body, typeOf(x.path));
      bytes += body.length;
      if (++done % 100 === 0) console.log(`  ${done}/${todo.length} (${mb(bytes)})`);
    });
    console.log(`copied ${done} files (${mb(bytes)}); failed ${failed.length}${failed.length ? ': ' + failed.slice(0, 5).map(x => x.path).join(', ') : ''}`);
    if (failed.length) process.exitCode = 1;
  } else if (cmd === 'push') {
    const files = args.flatMap(a => walk(path.resolve(a)));
    let sent = 0, bytes = 0;
    const failed = await pool(files, 4, async f => {
      const key = rel(f), body = readFileSync(f), head = await c.head(key);
      if (head && head.size === body.length && head.etag === md5(body)) return; // same content already there
      await c.put(key, body, typeOf(key));
      sent++; bytes += body.length;
    });
    console.log(`uploaded ${sent} of ${files.length} files (${mb(bytes)}); failed ${failed.length}`);
    if (failed.length) process.exitCode = 1;
  } else if (cmd === 'pull') {
    const keys = (await c.list(args[0])).map(o => o.key);
    const failed = await ensureFiles(keys, c);
    if (failed.length) process.exitCode = 1;
  } else if (cmd === 'need') {
    const paths = (await Promise.all(args.map(samplesFor))).flat();
    const failed = await ensureFiles(paths, c);
    console.log(`${new Set(paths).size} sample files needed, ${failed.length} unavailable`);
    if (failed.length) process.exitCode = 1;
  } else if (cmd === 'prune') {
    for (const d of readdirSync(path.join(ROOT, 'samples'))) {
      const p = path.join(ROOT, 'samples', d);
      if (!statSync(p).isDirectory()) continue;
      // Only a folder R2 holds in full can be fetched again.
      const remote = new Set((await c.list(`samples/${d}/`)).map(o => o.key));
      const local = walk(p).map(rel);
      const unsafe = local.filter(k => !remote.has(k));
      if (unsafe.length) { console.log(`kept samples/${d}/: ${unsafe.length} files not in R2 (first: ${unsafe[0]})`); continue; }
      rmSync(p, { recursive: true }); console.log(`removed samples/${d}/ (${local.length} files)`);
    }
  } else {
    console.log(readFileSync(fileURLToPath(import.meta.url), 'utf8').split('\n').slice(0, 12).join('\n'));
  }
}

if (process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url)) await main();
