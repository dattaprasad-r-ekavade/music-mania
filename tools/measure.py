"""Measures a render, since Claude can't listen to it.

Usage: python -I tools/measure.py FILE.wav BPM BEATS_PER_BAR ['{"Section": [first_bar, last_bar], ...}'] [--ref refs/<name>.profile.json]

Prints peak and per-bar RMS, flags bars that jump or drop sharply against their neighbours,
summarises each section (level, brightness, width), lists click-like spikes and checks the tail.
"""
import json, os, sys
import numpy as np, soundfile as sf
from scipy.signal import butter, sosfilt


def db(x):
    return 20 * np.log10(max(x, 1e-9))


def clicks(mono, sr):
    """Sample positions of click-like spikes: high-passed spikes far above the local high-frequency level."""
    hp = sosfilt(butter(4, 6000, 'hp', fs=sr, output='sos'), mono)
    win = int(sr * 0.02)
    env = np.sqrt(np.convolve(hp ** 2, np.ones(win) / win, mode='same')) + 1e-6
    ratio = np.abs(hp) / env
    spikes = np.where((ratio > 7) & (np.abs(hp) > 10 ** (-50 / 20)))[0]
    groups = [s for i, s in enumerate(spikes) if i == 0 or s - spikes[i - 1] > sr * 0.05]
    # A click dies at once; a drum or pluck attack keeps ringing. Keep spikes whose next 2-10 ms are quiet.
    after = lambda s: np.sqrt(np.mean(hp[s + int(sr * 0.002):s + int(sr * 0.01)] ** 2)) + 1e-9
    return [s for s in groups if s + int(sr * 0.01) < len(hp) and np.abs(hp[s]) / after(s) > 6]


def stems(bpm, beats, sections, pairs):
    """Per-section RMS of each solo stem, so buried or dominant parts show up, and clicks per stem,
    so a click in a sustained part isn't lost among drum attacks in the full mix."""
    print('Stem RMS dBFS per section (-99 = silent), and click-like spikes per stem:')
    print(f'  {"":10s}' + ''.join(f'{k:>8s}' for k in sections) + f'{"clicks":>8s}  first at')
    for name, path in zip(pairs[::2], pairs[1::2]):
        x, sr = sf.read(path)
        m, bar = x.mean(1), int(sr * 60 / bpm * beats)
        row = []
        for a, b in sections.values():
            r = np.sqrt(np.mean(m[(a - 1) * bar:b * bar] ** 2))
            row.append(db(r) if r > 1e-6 else -99)
        c = clicks(m, sr)
        print(f'  {name:10s}' + ''.join(f'{v:8.1f}' for v in row) + f'{len(c):8d}  ' + ', '.join(f'bar {g // bar + 1}' for g in c[:4]))


def compare(x, sr, bpm, beats, sections, ref_path):
    """Our mix against a reference profile (tools/analyze.py): whole track, then section by section in order
    when both have the same number of sections."""
    sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
    from analyze import lufs, mix_profile
    ref = json.load(open(ref_path, encoding='utf-8'))
    ours = mix_profile(x, sr)
    print(f'Against {os.path.basename(ref_path)} (ours / reference / difference; |diff| > 3 dB flagged):')
    rows = [('LUFS', lufs(x, sr), ref['loudness']['lufs']), ('width dB', ours['width_db'], ref['mix']['width_db']), ('crest dB', ours['crest_db'], ref['mix']['crest_db'])]
    rows += [(f'{b} Hz', ours['bands'][b], ref['mix']['bands'][b]) for b in ours['bands'] if b != '1000']
    for name, a, b in rows:
        print(f'  {name:10s} {a:7.1f} {b:7.1f} {a - b:+6.1f}' + ('  <--' if abs(a - b) > 3 else ''))
    if sections and len(sections) == len(ref['form']):
        bar = int(sr * 60 / bpm * beats)
        print('  Section level relative to the loudest section (ours / reference):')
        ours_s = [mix_profile(x[(a - 1) * bar:b * bar], sr)['lufs'] for a, b in sections.values()]
        ref_s = [s['mix']['lufs'] for s in ref['form']]
        for (name, _), o, r, s in zip(sections.items(), ours_s, ref_s, ref['form']):
            d = (o - max(ours_s)) - (r - max(ref_s))
            print(f'    {name:10s} {o - max(ours_s):+6.1f} {r - max(ref_s):+6.1f}  ({s["label"]}, {s["bars"][1] - s["bars"][0] + 1} bars)' + ('  <--' if abs(d) > 3 else ''))
    elif sections:
        print(f'  ({len(sections)} sections here, {len(ref["form"])} in the reference: no section comparison)')


def main():
    ref = None
    if '--ref' in sys.argv:
        i = sys.argv.index('--ref'); ref = sys.argv[i + 1]; del sys.argv[i:i + 2]
    if sys.argv[1] == '--stems':
        return stems(float(sys.argv[2]), float(sys.argv[3]), json.loads(sys.argv[4]), sys.argv[5:])
    path, bpm, beats = sys.argv[1], float(sys.argv[2]), float(sys.argv[3])
    sections = json.loads(sys.argv[4]) if len(sys.argv) > 4 else {}
    x, sr = sf.read(path)
    mono = x.mean(1)
    bar = int(sr * 60 / bpm * beats)
    nbars = int(np.ceil(len(mono) / bar))
    print(f'{len(mono) / sr:.1f} s, {nbars} bars of {bar / sr:.2f} s; peak {db(np.abs(x).max()):.1f} dBFS')

    rms = np.array([db(np.sqrt(np.mean(mono[i * bar:(i + 1) * bar] ** 2))) for i in range(nbars)])
    print('Per-bar RMS dBFS (8 per row):')
    for i in range(0, nbars, 8):
        print(f'  {i + 1:3d}: ' + ' '.join(f'{v:6.1f}' for v in rms[i:i + 8]))

    for i in range(1, nbars - 1):
        if rms[i] - rms[i - 1] > 6:
            print(f'  JUMP: bar {i + 1} is {rms[i] - rms[i - 1]:.1f} dB louder than bar {i}')
        if rms[i] < min(rms[i - 1], rms[i + 1]) - 8:
            print(f'  DROP: bar {i + 1} is {min(rms[i - 1], rms[i + 1]) - rms[i]:.1f} dB below its neighbours')

    if sections:
        print('Sections: RMS dBFS | spectral centroid Hz | low<250 / mid / high>4k energy % | side/mid dB')
        for name, (a, b) in sections.items():
            seg = x[(a - 1) * bar:b * bar]
            m = seg.mean(1); s = (seg[:, 0] - seg[:, 1]) / 2
            spec = np.abs(np.fft.rfft(m * np.hanning(len(m)))) ** 2
            f = np.fft.rfftfreq(len(m), 1 / sr)
            tot = spec.sum()
            lo, hi = spec[f < 250].sum() / tot * 100, spec[f > 4000].sum() / tot * 100
            print(f'  {name:12s} bars {a:3d}-{b:3d}: {db(np.sqrt(np.mean(m ** 2))):6.1f} | {(f * spec).sum() / tot:6.0f} | '
                  f'{lo:4.1f} / {100 - lo - hi:4.1f} / {hi:4.1f} | {db(np.sqrt(np.mean(s ** 2))) - db(np.sqrt(np.mean(m ** 2))):6.1f}')

    groups = clicks(mono, sr)
    print(f'Click-like spikes: {len(groups)}' + ('' if not groups else ' at ' + ', '.join(
        f'{g / sr:.2f}s (bar {g // bar + 1})' for g in groups[:12])))

    # Tonal balance: octave bands relative to 1 kHz. A balanced acoustic mix sits roughly at
    # +3..+6 dB at 125 Hz and -8..-12 dB at 4 kHz; far below that sounds dull, above it harsh.
    spec = np.abs(np.fft.rfft(mono)) ** 2
    f = np.fft.rfftfreq(len(mono), 1 / sr)
    bands = [63, 125, 250, 500, 1000, 2000, 4000, 8000, 16000]
    lv = [10 * np.log10(spec[(f >= b / 2 ** 0.5) & (f < b * 2 ** 0.5)].sum() + 1e-20) for b in bands]
    print('Octave bands, dB re 1 kHz: ' + ' '.join(f'{b}:{l - lv[4]:+.0f}' for b, l in zip(bands, lv)))

    tail = mono[-int(sr * 0.05):]
    print(f'Last 50 ms: {db(np.sqrt(np.mean(tail ** 2))):.1f} dBFS (should be near silence)')
    if ref: compare(x, sr, bpm, beats, sections, ref)


if __name__ == '__main__':
    main()
