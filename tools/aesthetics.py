"""Audiobox Aesthetics scores (Meta, CC-BY 4.0 weights): a learned stand-in for a listener's first impression.

Usage: python -I tools/aesthetics.py FILE.wav [FILE.wav ...] [--bpm B --beats 4 --sections JSON] [--json]

Four axes on a 1-10 scale: CE content enjoyment, CU content usefulness, PC production complexity,
PQ production quality. Whole file, plus per section when bars are given. Runs on CPU (~30 s per 4-minute track).

Calibration (2026-10-21, RULES 4d): Golden Hour CE 7.63 / PQ 7.95, Sandhya 7.52 / 8.13, Tum Hi Ho 7.43 / 8.22.
A 60 s clip low-passed and crushed lost 0.9 PQ and 0.5 CE; resampled to 8 kHz lost 0.4 PQ and 0.3 CE. So the
scale is compressed: treat differences under ~0.2 as noise, and trust it only after it agrees with the owner's
A/B choices (tools/feedback.py report). An independent review doubts it for music; it is one signal among several.
"""
import json, sys, warnings
import soundfile as sf

warnings.filterwarnings('ignore')
AXES = ('CE', 'CU', 'PC', 'PQ')
_pred = None


def score(x, sr):
    """x: frames x channels float32 array."""
    global _pred
    import torch
    from audiobox_aesthetics.infer import initialize_predictor
    if _pred is None:
        _pred = initialize_predictor()
    r = _pred.forward([{'path': torch.from_numpy(x.T.copy()), 'sample_rate': sr}])[0]
    return {k: round(float(r[k]), 2) for k in AXES}


def score_file(path, bpm=None, beats=4, sections=None):
    x, sr = sf.read(path, dtype='float32', always_2d=True)
    out = {'whole': score(x, sr)}
    if bpm and sections:
        bar = int(sr * 60 / bpm * beats)
        out['sections'] = {name: score(x[(a - 1) * bar:b * bar], sr) for name, (a, b) in sections.items() if b * bar <= len(x) + bar}
    return out


def main():
    args, opts = [], {}
    it = iter(sys.argv[1:])
    for a in it:
        if a in ('--bpm', '--beats', '--sections'):
            opts[a[2:]] = next(it)
        elif a == '--json':
            opts['json'] = True
        else:
            args.append(a)
    secs = json.loads(opts['sections']) if 'sections' in opts else None
    res = {f: score_file(f, float(opts['bpm']) if 'bpm' in opts else None, float(opts.get('beats', 4)), secs) for f in args}
    if opts.get('json'):
        print(json.dumps(res))
        return
    print('Aesthetics (1-10; CE enjoyment, CU usefulness, PC complexity, PQ quality; differences < 0.2 are noise):')
    for f, r in res.items():
        print(f'  {f.replace(chr(92), "/").split("/")[-1]:28s} ' + '  '.join(f'{k} {r["whole"][k]:.2f}' for k in AXES))
        for name, s in r.get('sections', {}).items():
            print(f'    {name:26s} ' + '  '.join(f'{k} {s[k]:.2f}' for k in AXES))


if __name__ == '__main__':
    main()
