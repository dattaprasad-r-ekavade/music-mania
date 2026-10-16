"""How close does a render sound to reference tracks? Learned audio embeddings, since Claude can't listen.

Usage: python -I tools/embed.py embed FILE.wav|mp3 [--model clap|mert] [--sections JSON|FILE] [--no-vocals]
       python -I tools/embed.py similar OURS.wav REF.wav [REF.wav ...] [--model clap|mert] [--sections ...] [--no-vocals]
       python -I tools/embed.py text FILE.wav [FILE.wav ...] "prompt" ["prompt" ...] [--no-vocals]

--no-vocals uses a reference's Demucs stems (refs/<name>/htdemucs/drums+bass+other.wav, from analyze.py --stems)
instead of the mix, cached as <name>.novox.<model>.npz. Our pieces are instrumentals; a sung reference otherwise
differs from them mostly by having a voice.

Models (Hugging Face transformers, CPU):
  clap  laion/clap-htsat-unfused: LAION CLAP (HTSAT audio + RoBERTa text, LAION-Audio-630K incl. music). 48 kHz mono,
        one 512-d unit vector per 10 s window, hop 2 s. Shares a space with text, so `text` works. ~590 MB.
        Not laion/larger_clap_music: its transformers conversion is broken (every input gives nearly the same
        embedding, text scores ~0; HF discussion #2), and the original laion_clap music checkpoint is 2.35 GB.
  mert  m-a-p/MERT-v1-95M: self-supervised music model (timbre, pitch, rhythm). 24 kHz mono, 5 s windows, hop 2.5 s,
        time-mean of each of its 13 layers; compared on the layer average. ~380 MB. Runs the repo's pinned remote code.

embed caches frames as refs/<name>.<model>.npz (files under refs/) or work/<name>.<model>.npz (everything else), with
per-section means. Sections: --sections ('{"Name": [start_s, end_s]}' or a profile JSON), else refs/<name>.profile.json
form for references, else pieces/<name>.mjs (bars, via node) for renders. A cache is reused while the audio's size and
mtime match.

similar prints, for ours vs each reference and between references (for scale):
  cos   cosine of mean embeddings (CLAP: raw, its space is already normalised; MERT: after subtracting the pooled mean of
        all compared files, otherwise every pair scores ~0.99; that makes MERT cos depend on the set: use its FD);
  FD    Frechet distance between Gaussians fitted to the frame embeddings (FAD-style). A song gives ~50-130 frames
        against 512/768 dimensions, so the covariances are rank-deficient (regularised with 1e-6 I): FD is biased upward
        and only comparable within one model and similar lengths. Read it against the ref-vs-ref numbers.
and per-section cos of ours vs the closest reference (its whole mean and its best-matching section).

text (CLAP only) scores each prompt as 100 x cosine(audio, text) minus the mean over neutral control prompts, so 0 means
"no more like this than like 'music'". Several files rank each prompt across pieces.
"""
import argparse, json, os, subprocess, sys, warnings
import numpy as np, soundfile as sf
from scipy.linalg import sqrtm
from scipy.signal import resample_poly

warnings.filterwarnings('ignore')
os.environ.setdefault('HF_HUB_DISABLE_SYMLINKS_WARNING', '1')
ROOT = os.path.abspath(os.path.join(os.path.dirname(os.path.abspath(__file__)), '..'))

MODELS = {
    # refs/pr/3 of clap-htsat-unfused: the same weights as main, as safetensors (download only those).
    'clap': dict(repo='laion/clap-htsat-unfused', rev='79b58ed25fc00386262a2bea4b19fd21dc4310a0', weights='model.safetensors',
                 sr=48000, win=10.0, hop=2.0),
    'mert': dict(repo='m-a-p/MERT-v1-95M', rev='12af15fef9d0ac838c3f475bfbbf26d2060dd4f5', weights='pytorch_model.bin',
                 sr=24000, win=5.0, hop=2.5),
}
CONTROLS = ['music', 'a piece of music', 'an audio recording', 'a song']
CACHE_VERSION = 1


# --- Audio --------------------------------------------------------------------------------------
def read(path):
    try:
        x, fs = sf.read(path, always_2d=True, dtype='float32')
    except Exception:
        import librosa
        y, fs = librosa.load(path, sr=None, mono=False)
        x = np.atleast_2d(y).T
    return x.mean(1), fs


def load_mono(paths, sr):
    """Mono float32 at sr (several files are summed: stems), whole-file RMS normalised to -20 dBFS
    (references are mastered 5-10 dB hotter than ours)."""
    parts = [read(p) for p in paths]
    fs = parts[0][1]
    n = min(len(m) for m, _ in parts)
    m = sum(m[:n] for m, _ in parts)
    if fs != sr:
        g = np.gcd(int(fs), sr)
        m = resample_poly(m, sr // g, int(fs) // g)
    rms = np.sqrt(np.mean(m ** 2)) + 1e-9
    return (m * (0.1 / rms)).astype(np.float32)


def windows(y, sr, win, hop):
    """Start/end seconds of analysis windows; the last one is kept if it is at least half a window."""
    n, w, h = len(y), int(win * sr), int(hop * sr)
    starts = list(range(0, max(1, n - w + 1), h))
    if n > w and n - (starts[-1] + w) > w // 2: starts.append(n - w)
    # Skip windows 50 dB below the file's average level (silent tails, gaps).
    return [(s, min(s + w, n)) for s in starts if np.sqrt(np.mean(y[s:s + w] ** 2)) > 0.1 * 10 ** (-50 / 20)]


# --- Models -------------------------------------------------------------------------------------
_loaded = {}


def model_dir(key):
    """Local snapshot of the pinned revision (downloads once)."""
    from huggingface_hub import snapshot_download
    m = MODELS[key]
    pats = ['*.json', '*.txt', '*.py', m['weights']]
    try:
        return snapshot_download(m['repo'], revision=m['rev'], local_files_only=True)
    except Exception:
        return snapshot_download(m['repo'], revision=m['rev'], allow_patterns=pats)


def get(key):
    if key in _loaded: return _loaded[key]
    import torch, transformers
    transformers.logging.set_verbosity_error(); transformers.logging.disable_progress_bar()
    torch.manual_seed(0)
    d = model_dir(key)
    if key == 'clap':
        from transformers import ClapModel, ClapProcessor
        mdl, proc = ClapModel.from_pretrained(d).eval(), ClapProcessor.from_pretrained(d)
    else:
        from transformers import AutoModel, Wav2Vec2FeatureExtractor
        mdl, proc = AutoModel.from_pretrained(d, trust_remote_code=True).eval(), Wav2Vec2FeatureExtractor.from_pretrained(d)
    _loaded[key] = (mdl, proc)
    return _loaded[key]


def tensor(o):
    """transformers 5 returns output objects from get_*_features; 4.x returned tensors."""
    return o if hasattr(o, 'shape') else o.pooler_output


def frames_for(y, key):
    """(frames, times): CLAP (n, 512) unit vectors; MERT (n, 13, 768) per-layer time means."""
    import torch
    m = MODELS[key]
    mdl, proc = get(key)
    spans = windows(y, m['sr'], m['win'], m['hop'])
    out = []
    with torch.inference_mode():
        for i in range(0, len(spans), 8):
            segs = [y[a:b] for a, b in spans[i:i + 8]]
            if key == 'clap':
                # Windows are exactly 10 s (or shorter at the end, repeat-padded): rand_trunc never draws.
                f = proc.feature_extractor(segs, sampling_rate=m['sr'], return_tensors='pt', padding='repeatpad', truncation='rand_trunc')
                e = tensor(mdl.get_audio_features(input_features=f['input_features']))
                out.append(torch.nn.functional.normalize(e, dim=-1).numpy())
            else:
                for s in segs:  # one at a time: lengths differ at the end and padding would leak into the mean
                    f = proc(s, sampling_rate=m['sr'], return_tensors='pt')
                    h = mdl(f['input_values'], output_hidden_states=True).hidden_states
                    out.append(torch.stack([l[0].mean(0) for l in h]).numpy()[None])
    times = np.array([(a / m['sr'], b / m['sr']) for a, b in spans])
    return np.concatenate(out).astype(np.float32), times


# --- Sections -----------------------------------------------------------------------------------
def sections_for(path, arg=None):
    """{name: (start_s, end_s)} or {} when unknown."""
    name = os.path.splitext(os.path.basename(path))[0]
    if arg:
        d = json.load(open(arg, encoding='utf8')) if os.path.isfile(arg) else json.loads(arg)
        if 'form' not in d: return {k: tuple(v) for k, v in d.items()}
        return from_form(d['form'])
    prof = os.path.join(ROOT, 'refs', f'{name}.profile.json')
    piece = os.path.join(ROOT, 'pieces', f'{name}.mjs')
    under_refs = os.path.abspath(path).startswith(os.path.join(ROOT, 'refs'))
    if os.path.isfile(piece) and not under_refs:
        js = ("import(require('url').pathToFileURL(process.argv[1])).then(m => { const p = m.default(); "
              "console.log(JSON.stringify({ bpm: p.session.bpm, beats: p.session.bar / 960, sections: p.sections })); })")
        r = subprocess.run(['node', '-e', js, piece], capture_output=True, text=True, cwd=ROOT)
        try:
            p = json.loads(r.stdout.strip().splitlines()[-1])
            bar = 60 / p['bpm'] * p['beats']
            return {k: ((a - 1) * bar, b * bar) for k, (a, b) in (p['sections'] or {}).items()}
        except Exception:
            pass
    if os.path.isfile(prof): return from_form(json.load(open(prof, encoding='utf8')).get('form', []))
    return {}


def from_form(form):
    """Profile form -> {'A 1-8': (s, e)}; labels repeat, bar ranges keep them apart."""
    return {f"{f['label']} {f['bars'][0]}-{f['bars'][1]}": tuple(f['seconds']) for f in form}


def section_means(frames, times, secs):
    """Mean embedding per section over windows whose centre falls inside it."""
    c = times.mean(1)
    out = {}
    for k, (a, b) in secs.items():
        sel = (c >= a) & (c < b)
        if not sel.any(): sel = np.abs(c - (a + b) / 2) == np.abs(c - (a + b) / 2).min()  # short sections: nearest window
        out[k] = frames[sel].mean(0)
    return out


# --- Cache --------------------------------------------------------------------------------------
def cache_path(path, key, novox=False):
    name = os.path.splitext(os.path.basename(path))[0] + ('.novox' if novox else '')
    under_refs = os.path.abspath(path).startswith(os.path.join(ROOT, 'refs') + os.sep)
    return os.path.join(ROOT, 'refs' if under_refs else 'work', f'{name}.{key}.npz')


def novox_stems(path):
    """refs/<name>/htdemucs/{drums,bass,other}.wav (analyze.py --stems), or None."""
    d = os.path.join(os.path.dirname(os.path.abspath(path)), os.path.splitext(os.path.basename(path))[0], 'htdemucs')
    st = [os.path.join(d, f'{s}.wav') for s in ('drums', 'bass', 'other')]
    return st if all(os.path.isfile(s) for s in st) else None


def embed(path, key, sec_arg=None, quiet=False, novox=False):
    """Cached frames, times and section means for one file. novox: the file's Demucs stems minus vocals, when present."""
    srcs = novox_stems(path) if novox else None
    novox = bool(srcs)
    srcs = srcs or [path]
    stamp = f'{CACHE_VERSION}|{MODELS[key]["rev"]}|' + '|'.join(f'{os.stat(p).st_size}|{int(os.stat(p).st_mtime)}' for p in srcs)
    cp = cache_path(path, key, novox)
    secs = sections_for(path, sec_arg)
    if os.path.isfile(cp):
        z = np.load(cp, allow_pickle=False)
        if str(z['stamp']) == stamp:
            frames, times = z['frames'].astype(np.float32), z['times']
            return dict(frames=frames, times=times, sections=section_means(frames, times, secs), cache=cp, novox=novox)
    if not quiet: print(f'embedding {os.path.relpath(path, ROOT)}{" (no vocals)" if novox else ""} with {key} ...', file=sys.stderr)
    y = load_mono(srcs, MODELS[key]['sr'])
    frames, times = frames_for(y, key)
    sm = section_means(frames, times, secs)
    os.makedirs(os.path.dirname(cp), exist_ok=True)
    np.savez_compressed(cp, stamp=stamp, model=MODELS[key]['repo'], frames=frames.astype(np.float16), times=times,
                        section_names=np.array(list(sm), dtype=str),
                        section_bounds=np.array([secs[k] for k in sm]).reshape(-1, 2),
                        section_means=np.array(list(sm.values())).astype(np.float32) if sm else np.zeros((0,)))
    return dict(frames=frames, times=times, sections=sm, cache=cp, novox=novox)


# --- Metrics ------------------------------------------------------------------------------------
def vec(x, key):
    """One vector per frame/section: MERT averages its layers."""
    return x.mean(-2) if key == 'mert' else x


def cos(a, b):
    return float(a @ b / (np.linalg.norm(a) * np.linalg.norm(b) + 1e-12))


def frechet(a, b):
    """Frechet distance between Gaussians fitted to two frame sets (rows = frames)."""
    mu1, mu2 = a.mean(0), b.mean(0)
    eps = 1e-6 * np.eye(a.shape[1])
    s1, s2 = np.cov(a, rowvar=False) + eps, np.cov(b, rowvar=False) + eps
    cs = sqrtm(s1 @ s2)
    if np.iscomplexobj(cs): cs = cs.real
    return float(((mu1 - mu2) ** 2).sum() + np.trace(s1 + s2 - 2 * cs))


def short(p):
    return os.path.splitext(os.path.basename(p))[0]


def cmd_similar(a):
    key = a.model
    paths = [a.ours] + a.refs
    E = {p: embed(p, key, a.sections, novox=False) if p == a.ours else embed(p, key, novox=a.no_vocals) for p in paths}
    F = {p: vec(E[p]['frames'], key).astype(np.float64) for p in paths}
    centre = np.concatenate(list(F.values())).mean(0) if key == 'mert' else 0
    M = {p: (F[p] - centre).mean(0) for p in paths}
    rows = sorted(((cos(M[a.ours], M[r]), frechet(F[a.ours], F[r]), r) for r in a.refs), reverse=True)
    print(f'{key}: {short(a.ours)} ({len(F[a.ours])} frames) vs references (cos higher = closer; FD lower = closer)')
    print(f'  {"reference":22s}{"cos":>8s}{"FD":>10s}{"frames":>8s}')
    for c, d, r in rows: print(f'  {short(r):22s}{c:8.3f}{d:10.3f}{len(F[r]):8d}')
    if len(a.refs) > 1:
        print('references against each other (scale: what "same style, different song" looks like):')
        pairs = [(i, j) for i in a.refs for j in a.refs if i < j]
        for i, j in pairs: print(f'  {short(i):18s}{short(j):18s}{cos(M[i], M[j]):8.3f}{frechet(F[i], F[j]):10.3f}')
        rc = [cos(M[i], M[j]) for i, j in pairs]; rd = [frechet(F[i], F[j]) for i, j in pairs]
        print(f'  ref-ref mean: cos {np.mean(rc):.3f}, FD {np.mean(rd):.3f}; ours-ref mean: cos {np.mean([r[0] for r in rows]):.3f}, '
              f'FD {np.mean([r[1] for r in rows]):.3f}')
    so = E[a.ours]['sections']
    if so:
        best = rows[0][2]
        rs = {k: vec(v, key) - centre for k, v in E[best]['sections'].items()}
        print(f'per section, {short(a.ours)} vs closest reference {short(best)} (cos to its whole mean; best-matching section):')
        for k, v in so.items():
            v = vec(v, key) - centre
            line = f'  {k:14s}{cos(v, M[best]):8.3f}'
            if rs:
                bk = max(rs, key=lambda s: cos(v, rs[s]))
                line += f'   {bk} {cos(v, rs[bk]):.3f}'
            print(line)


def cmd_text(a):
    import torch
    files = [x for x in a.items if os.path.isfile(x)]
    prompts = [x for x in a.items if not os.path.isfile(x)]
    if not files or not prompts: sys.exit('text: give at least one audio file and one prompt')
    mdl, proc = get('clap')
    with torch.inference_mode():
        t = proc.tokenizer(prompts + CONTROLS, padding=True, return_tensors='pt')
        T = torch.nn.functional.normalize(tensor(mdl.get_text_features(**t)), dim=-1).numpy()
    A = {}
    for f in files:
        m = embed(f, 'clap', novox=a.no_vocals)['frames'].mean(0)
        A[f] = m / np.linalg.norm(m)
    S = {f: 100 * (T @ A[f]) for f in files}  # cos x 100
    rel = {f: S[f][:len(prompts)] - S[f][len(prompts):].mean() for f in files}
    print('CLAP text-audio: 100 x cosine minus the control mean (controls: ' + ', '.join(f'"{c}"' for c in CONTROLS) + ')')
    print(f'  {"":34s}' + ''.join(f'{short(f)[:13]:>14s}' for f in files))
    print(f'  {"(control mean, raw)":34s}' + ''.join(f'{S[f][len(prompts):].mean():14.1f}' for f in files))
    for i, p in enumerate(prompts):
        vals = [rel[f][i] for f in files]
        top = int(np.argmax(vals)) if len(files) > 1 else -1
        print(f'  {p[:34]:34s}' + ''.join(f'{v:13.1f}{"*" if j == top else " "}' for j, v in enumerate(vals)))
    if len(files) > 1: print('  * highest for that prompt across files')


def main():
    ap = argparse.ArgumentParser(description=__doc__.split('\n')[0])
    sub = ap.add_subparsers(dest='cmd', required=True)
    e = sub.add_parser('embed'); e.add_argument('file'); e.add_argument('--model', default='clap', choices=MODELS)
    e.add_argument('--sections'); e.add_argument('--no-vocals', action='store_true')
    s = sub.add_parser('similar'); s.add_argument('ours'); s.add_argument('refs', nargs='+')
    s.add_argument('--model', default='clap', choices=MODELS); s.add_argument('--sections')
    s.add_argument('--no-vocals', action='store_true', help='references: their Demucs drums+bass+other, when present')
    t = sub.add_parser('text'); t.add_argument('items', nargs='+'); t.add_argument('--no-vocals', action='store_true')
    a = ap.parse_args()
    if a.cmd == 'embed':
        r = embed(a.file, a.model, a.sections, novox=a.no_vocals)
        f = r['frames']
        print(f'{short(a.file)}: {len(f)} windows of {MODELS[a.model]["win"]:.0f} s, dim {f.shape[1:]}, '
              f'{r["times"][-1][1]:.0f} s covered -> {os.path.relpath(r["cache"], ROOT)}')
        if r['sections']: print('  sections: ' + ', '.join(r['sections']))
    elif a.cmd == 'similar': cmd_similar(a)
    else: cmd_text(a)


if __name__ == '__main__':
    main()
