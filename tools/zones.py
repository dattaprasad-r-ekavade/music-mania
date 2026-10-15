"""Builds samples/zones.json: one entry per sample zone, with the note it really plays.

Usage: python -I tools/zones.py

Root notes come from the file name plus a per-library octave offset (VSCO names most
instruments an octave below sounding pitch; measured, see README of this folder).
Each sample's pitch is then measured; if it is within 50 cents of the named note the
deviation becomes `fine_tune`, otherwise the zone is flagged and kept untuned.
Sustained instruments also get `level_trim` (dB, within +/-6): VSCO samples vary by up to 10 dB
from note to note, which makes a sustained line bump unevenly.
"""
import glob, json, os, re, sys
import numpy as np, soundfile as sf

ROOT = os.path.join(os.path.dirname(os.path.abspath(__file__)), '..', 'samples')
PC = {'C': 0, 'D': 2, 'E': 4, 'F': 5, 'G': 7, 'A': 9, 'B': 11}

# name: (glob, regex with groups note/acc/oct/layer, octave offset, {layer: (vel_low, vel_high)}, measure-at seconds).
# Measure-at None = don't measure: the piano keeps Salamander's own 'retuned' offsets (Data/tune_ret.txt; a real
# piano is stretch-tuned, which measuring would undo) and the harp's plucked attacks fool the pitch detector.
# Piano layers are a subset of Salamander's 16, with velocity ranges following its own map (Data/notes.txt).
INSTRUMENTS = {
    'piano': ('salamander/Samples/*.flac', r'^(?P<n>[A-G])(?P<a>#?)(?P<o>\d)v(?P<l>\d+)\.flac$', 0,
              {'4': (1, 46), '7': (47, 64), '10': (65, 88), '13': (89, 112), '16': (113, 127)}, None),
    'violins': ('vsco2/Strings/Violin Section/susVib/*.wav', r'_(?P<n>[A-G])(?P<a>#?)(?P<o>\d)_v(?P<l>\d)\.wav$', 12,
                {'1': (1, 80), '2': (81, 127)}, 0.6),
    'violas': ('vsco2/Strings/Viola Section/susvib/*.wav', r'_(?P<n>[A-G])(?P<a>#?)(?P<o>\d)_v(?P<l>\d)_1\.wav$', 12,
               {'1': (1, 80), '2': (81, 127)}, 0.6),
    'cellos': ('vsco2/Strings/Cello Section/susvib/*.wav', r'_(?P<n>[A-G])(?P<a>#?)(?P<o>\d)_v(?P<l>\d)_1\.wav$', 12,
               {'1': (1, 80), '3': (81, 127)}, 0.6),
    'harp': ('vsco2/Strings/Harp/*.wav', r'_(?P<n>[A-G])(?P<a>#?)(?P<o>\d)_(?P<l>mp|mf|f)\.wav$', 0,
             {'mp': (1, 127), 'mf': (1, 127), 'f': (1, 127)}, None),
    'flute': ('vsco2/Woodwinds/Flute/susvib/*.wav', r'_(?P<n>[A-G])(?P<a>#?)(?P<o>\d)_v(?P<l>\d)_1\.wav$', 12,
              {'1': (1, 127)}, 0.6),
}


def f0(x, sr, t0, dur=0.5):
    """Fundamental by normalised autocorrelation, taking the shortest strong lag (avoids octave-down errors)."""
    if x.ndim > 1:
        x = x.mean(1)
    seg = x[int(t0 * sr):int((t0 + dur) * sr)]
    seg = (seg - seg.mean()) * np.hanning(len(seg))
    n = len(seg)
    spec = np.fft.rfft(seg, 2 * n)
    ac = np.fft.irfft(spec * np.conj(spec))
    r = ac / ac[0]
    lo, hi = max(2, int(sr / 5000)), int(sr / 25)
    best = r[lo:hi].max()
    peaks = (l for l in range(lo + 1, hi - 1) if r[l] > 0.85 * best and r[l] >= r[l - 1] and r[l] >= r[l + 1])
    lag = next(peaks, lo + int(np.argmax(r[lo:hi])))
    y0, y1, y2 = r[lag - 1], r[lag], r[lag + 1]
    return sr / (lag + 0.5 * (y0 - y2) / (y0 - 2 * y1 + y2))


def salamander_tuning():
    """Root note -> cents from Data/tune_ret.txt; region N plays the Nth sample from A0 in minor thirds."""
    tunes = re.findall(r'\$TUNE(\d+) (-?\d+)', open(os.path.join(ROOT, 'salamander/Data/tune_ret.txt')).read())
    return {21 + 3 * (int(i) - 1): int(c) for i, c in tunes}


def main():
    zones, flagged = {}, []
    piano_tune = salamander_tuning()
    for inst, (pattern, rx, octave, layers, t0) in INSTRUMENTS.items():
        out = []
        for path in sorted(glob.glob(os.path.join(ROOT, pattern))):
            m = re.search(rx, os.path.basename(path))
            if not m or m['l'] not in layers:
                continue
            root = 12 * (int(m['o']) + 1) + PC[m['n']] + (1 if m['a'] else 0) + octave
            x, sr = sf.read(path)
            if t0 is None:
                cents = -piano_tune.get(root, 0) if inst == 'piano' else 0
            else:
                measured = 69 + 12 * np.log2(f0(x, sr, t0) / 440)
                cents = (measured - root) * 100
                if abs(cents) > 50:
                    flagged.append(f'{inst} {os.path.basename(path)}: named {root}, measured {measured:.2f}')
                    cents = 0
            lo, hi = layers[m['l']]
            out.append({'path': os.path.relpath(path, ROOT).replace('\\', '/'), 'root': root, 'layer': m['l'],
                        'vel_low': lo, 'vel_high': hi, 'fine_tune': round(-cents, 1),
                        'seconds': round(len(x) / sr, 2),
                        'rms_db': float(20 * np.log10(np.sqrt(np.mean(x.mean(1)[int(0.4 * sr):int(2 * sr)] ** 2)) + 1e-9))})
        if t0 is not None:  # sustained instruments: even out sample-to-sample level within each layer
            for layer in {z['layer'] for z in out}:
                zs = [z for z in out if z['layer'] == layer]
                med = float(np.median([z['rms_db'] for z in zs]))
                for z in zs:
                    z['level_trim'] = round(max(-6.0, min(6.0, med - z['rms_db'])), 1)
        for z in out:
            z.pop('rms_db', None)
        zones[inst] = out
        print(f'{inst}: {len(out)} zones, roots {min(z["root"] for z in out)}-{max(z["root"] for z in out)}')
    with open(os.path.join(ROOT, 'zones.json'), 'w') as f:
        json.dump(zones, f, indent=1)
    for line in flagged:
        print('FLAGGED (kept untuned):', line)


if __name__ == '__main__':
    sys.exit(main())
