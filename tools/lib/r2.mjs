// Minimal Cloudflare R2 client (S3 API, AWS Signature V4), no dependencies.
// Reads R2_ENDPOINT, R2_ACCESS_KEY_ID, R2_SECRET_ACCESS_KEY, R2_BUCKET_NAME from the environment or .env.

import { createHash, createHmac } from 'node:crypto';
import { readFileSync, existsSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import path from 'node:path';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../..');

export function loadEnv() {
  const env = { ...process.env };
  const file = path.join(ROOT, '.env');
  if (existsSync(file))
    for (const line of readFileSync(file, 'utf8').split(/\r?\n/)) {
      const m = /^\s*([A-Z0-9_]+)\s*=\s*(.*?)\s*$/.exec(line);
      if (m && env[m[1]] == null) env[m[1]] = m[2].replace(/^(['"])(.*)\1$/, '$2');
    }
  return env;
}

const sha256 = d => createHash('sha256').update(d).digest('hex');
const hmac = (k, d) => createHmac('sha256', k).update(d).digest();
// S3 keys: encode each path segment, keep the slashes.
const encodeKey = key => key.split('/').map(s => encodeURIComponent(s).replace(/[!'()*]/g, c => '%' + c.charCodeAt(0).toString(16).toUpperCase())).join('/');

export function r2(env = loadEnv()) {
  for (const k of ['R2_ENDPOINT', 'R2_ACCESS_KEY_ID', 'R2_SECRET_ACCESS_KEY', 'R2_BUCKET_NAME'])
    if (!env[k]) throw new Error(`${k} missing (set it in .env)`);
  const endpoint = new URL(env.R2_ENDPOINT.replace(/\/+$/, ''));
  const bucket = env.R2_BUCKET_NAME;

  async function request(method, key = '', { query = {}, body, headers = {} } = {}) {
    const now = new Date().toISOString().replace(/[-:]|\.\d{3}/g, '');
    const date = now.slice(0, 8), scope = `${date}/auto/s3/aws4_request`;
    const canonicalPath = `/${bucket}${key ? '/' + encodeKey(key) : ''}`;
    const qs = Object.keys(query).sort().map(k => `${encodeURIComponent(k)}=${encodeURIComponent(query[k])}`).join('&');
    const payloadHash = body ? sha256(body) : sha256('');
    const h = { host: endpoint.host, 'x-amz-content-sha256': payloadHash, 'x-amz-date': now, ...headers };
    const names = Object.keys(h).map(k => k.toLowerCase()).sort();
    const lower = Object.fromEntries(Object.entries(h).map(([k, v]) => [k.toLowerCase(), String(v).trim()]));
    const canonical = [method, canonicalPath, qs, names.map(n => `${n}:${lower[n]}\n`).join(''), names.join(';'), payloadHash].join('\n');
    const toSign = ['AWS4-HMAC-SHA256', now, scope, sha256(canonical)].join('\n');
    const kSigning = hmac(hmac(hmac(hmac('AWS4' + env.R2_SECRET_ACCESS_KEY, date), 'auto'), 's3'), 'aws4_request');
    h.authorization = `AWS4-HMAC-SHA256 Credential=${env.R2_ACCESS_KEY_ID}/${scope}, SignedHeaders=${names.join(';')}, Signature=${hmac(kSigning, toSign).toString('hex')}`;
    delete h.host;
    const res = await fetch(`${endpoint.origin}${canonicalPath}${qs ? '?' + qs : ''}`, { method, headers: h, body });
    if (!res.ok && !(method === 'HEAD' && res.status === 404)) throw new Error(`R2 ${method} ${key || bucket}: ${res.status} ${(await res.text()).slice(0, 300)}`);
    return res;
  }

  return {
    bucket,
    // Every object under prefix: [{ key, size, etag }].
    async list(prefix = '') {
      const out = [];
      let token;
      do {
        const query = { 'list-type': '2', prefix, ...(token ? { 'continuation-token': token } : {}) };
        const xml = await (await request('GET', '', { query })).text();
        for (const m of xml.matchAll(/<Contents>([\s\S]*?)<\/Contents>/g))
          out.push({ key: decodeXml(/<Key>(.*?)<\/Key>/.exec(m[1])[1]), size: +/<Size>(\d+)<\/Size>/.exec(m[1])[1], etag: /<ETag>(.*?)<\/ETag>/.exec(m[1])[1].replace(/&quot;|"/g, '') });
        token = /<IsTruncated>true<\/IsTruncated>/.test(xml) ? decodeXml(/<NextContinuationToken>(.*?)<\/NextContinuationToken>/.exec(xml)[1]) : null;
      } while (token);
      return out;
    },
    async head(key) { const r = await request('HEAD', key); return r.status === 404 ? null : { size: +r.headers.get('content-length'), etag: r.headers.get('etag')?.replace(/"/g, '') }; },
    async get(key) { return Buffer.from(await (await request('GET', key)).arrayBuffer()); },
    async put(key, body, contentType = 'application/octet-stream') { await request('PUT', key, { body, headers: { 'content-type': contentType } }); },
    async del(key) { await request('DELETE', key); },
  };
}

const decodeXml = s => s.replace(/&lt;/g, '<').replace(/&gt;/g, '>').replace(/&quot;/g, '"').replace(/&apos;/g, "'").replace(/&amp;/g, '&');
