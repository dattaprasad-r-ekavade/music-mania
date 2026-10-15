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


# Instruments added for the themed collection. Same idea, with less hand work:
#   octave 'auto' = measure every file and use the most common octave offset between name and sound;
#   velocity ranges are split evenly between the layers found, quietest first;
#   files differing only in `r` are round robins (alternated by session.mjs on repeated notes);
#   tune / trim: apply measured fine-tune and level evening (sustained sounds only).
V = r'_(?P<n>[A-G])(?P<a>#?)(?P<o>\d)_v(?P<l>\d)'
AUTO = {
    'violins_spic': dict(glob='vsco2/Strings/Violin Section/Spic/*.wav', rx=V + r'_rr(?P<r>\d)\.wav$', t0=0.05),
    'violins_pizz': dict(glob='vsco2/Strings/Violin Section/Pizz/*.wav', rx=V + r'_rr(?P<r>\d)\.wav$', t0=0.05),
    'violins_trem': dict(glob='vsco2/Strings/Violin Section/Trem/*.wav', rx=V + r'\.wav$', t0=0.5, tune=True, trim=True),
    'violas_spic': dict(glob='vsco2/Strings/Viola Section/spic/*.wav', rx=V + r'_rr(?P<r>\d)\.wav$', t0=0.05),
    'cellos_spic': dict(glob='vsco2/Strings/Cello Section/spic/*.wav', rx=V + r'_RR(?P<r>\d)\.wav$', t0=0.05),
    'cellos_pizz': dict(glob='vsco2/Strings/Cello Section/pizzT/*.wav', rx=V + r'_RR(?P<r>\d)\.wav$', t0=0.05),
    'cellos_trem': dict(glob='vsco2/Strings/Cello Section/trem/*.wav', rx=V + r'_1\.wav$', t0=0.5, tune=True, trim=True),
    'horns': dict(glob='vsco2/Brass/F Horn/sus/*.wav', rx=V + r'_1\.wav$', t0=0.5, tune=True, trim=True),
    'horns_stac': dict(glob='vsco2/Brass/F Horn/stac/*.wav', rx=V + r'_rr(?P<r>\d)\.wav$', t0=0.06),
    'trombones': dict(glob='vsco2/Brass/Tenor Trombone/sus/*.wav', rx=V + r'_1\.wav$', t0=0.5, tune=True, trim=True),
    'trombones_stac': dict(glob='vsco2/Brass/Tenor Trombone/stac/*.wav', rx=V + r'_rr(?P<r>\d)\.wav$', t0=0.06),
    'trumpet': dict(glob='vsco2/Brass/Trumpet/sus/*.wav', rx=V + r'_rr1\.wav$', t0=0.5, tune=True, trim=True),
    'trumpet_harmon': dict(glob='vsco2/Brass/Trumpet/harmonM-sus/*.wav', rx=V + r'_rr1\.wav$', t0=0.5, tune=True, trim=True),
    'trumpet_stac': dict(glob='vsco2/Brass/Trumpet/stac/*.wav', rx=V + r'_rr(?P<r>\d)\.wav$', t0=0.06),
    'tuba': dict(glob='vsco2/Brass/Tuba/sus/*.wav', rx=V + r'_rr1_Mid\.wav$', t0=0.5, tune=True, trim=True),
    'tuba_stac': dict(glob='vsco2/Brass/Tuba/stac/*.wav', rx=V + r'_rr(?P<r>\d)_Sum\.wav$', t0=0.06),
    'oboe': dict(glob='vsco2/Woodwinds/Oboe/Vib/*.wav', rx=V + r'_Main\.wav$', t0=0.5, tune=True, trim=True),
    'clarinet': dict(glob='vsco2/Woodwinds/Clarinet/susLong/*.wav', rx=V + r'_rr1_sum\.wav$', t0=0.5, tune=True, trim=True),
    'marimba': dict(glob='vsco2/Percussion/Marimba/*.wav', rx=r'_(?P<n>[A-G])(?P<a>#?)(?P<o>\d)_(?P<l>loud)_01\.wav$', t0=0.03),
    'xylo': dict(glob='vsco2/Percussion/Xylo/*.wav', rx=r'_(?P<n>[A-G])(?P<a>#?)(?P<o>\d)_(?P<l>ff)_01_far\.wav$', t0=0.02),
    'glock': dict(glob='vsco2/Percussion/Glock/*.wav', rx=r'glock_(?P<l>medium)_(?P<n>[A-G])(?P<a>#?)(?P<o>\d)\.wav$', octave=12),  # sounds 2 octaves over written; files are named 1 under
}
LAYER_ORDER = ['ppp', 'pp', 'p', 'mp', 'mf', 'f', 'ff', 'fff', 'loud']

# Percussion kit: MIDI key -> (glob, regex with optional layer `l` and round robin `r`).
P = 'vsco2/Percussion/'
KIT = {
    36: (P + 'BDrumNewhit_v*_rr*_Sum.wav', r'_v(?P<l>\d)_rr(?P<r>\d)'),            # concert bass drum
    38: (P + 'Snare2-HitSN_v*_rr*_Sum.wav', r'_v(?P<l>\d)_rr(?P<r>\d)'),           # snare
    39: (P + 'Snare2-rollSN_v*_rr1_Sum.wav', r'_v(?P<l>\d)'),                          # snare roll
    41: (P + 'Tumba-HitN_v*_rr*_Sum.wav', r'_v(?P<l>\d)_rr(?P<r>\d)'),            # low conga (tumba)
    43: (P + 'Conga-HitN_v*_rr*_Sum.wav', r'_v(?P<l>\d)_rr(?P<r>\d)'),            # conga
    45: (P + 'Quinto-HitN_v*_rr*_Sum.wav', r'_v(?P<l>\d)_rr(?P<r>\d)'),           # high conga (quinto)
    46: (P + 'Conga-Tap1_v*_rr*_Sum.wav', r'_v(?P<l>\d)_rr(?P<r>\d)'),            # conga slap/tap
    47: (P + 'Quinto-Tap1_v*_rr*_Sum.wav', r'_v(?P<l>\d)_rr(?P<r>\d)'),           # quinto tap
    49: (P + 'cymbal-crash1_*_rr*.wav', r'_(?P<l>pp|mp|mf|ff)_rr(?P<r>\d)'),     # crash
    51: (P + 'susCymb1-hit_*_rr*.wav', r'-hit_(?P<l>pp|mp|f|fff)_rr(?P<r>\d)'),  # suspended cymbal
    52: (P + 'gongHit_*.wav', r'gongHit_(?P<l>p|mf|f|fff)\.wav'),                 # gong
    53: (P + 'susCymb1-cresc-Long_v1.wav', r'(?P<l>Long)'),                        # cymbal swell (long)
    55: (P + 'susCymb1-cresc-Median_v1.wav', r'(?P<l>Median)'),                    # cymbal swell (medium)
    54: (P + 'Tamb1-Hit_v*_rr*_Sum.wav', r'_v(?P<l>\d)_rr(?P<r>\d)'),             # tambourine
    56: (P + 'Cowbell1_Hit_v*_rr*_Sum.wav', r'_v(?P<l>\d)_rr(?P<r>\d)'),          # cowbell
    58: (P + 'LogDrumLo_MedM_v*_rr*_Sum.wav', r'_v(?P<l>\d)_rr(?P<r>\d)'),        # log drum low
    59: (P + 'LogDrumHi_MedM_v*_rr*_Sum.wav', r'_v(?P<l>\d)_rr(?P<r>\d)'),        # log drum high
    60: (P + 'Claves1_Hit_v*_rr*_Sum.wav', r'_v(?P<l>\d)_rr(?P<r>\d)'),           # claves
    61: (P + 'Triangle3-Hit_v*_rr*_Sum.wav', r'_v(?P<l>\d)_rr(?P<r>\d)'),         # triangle
    62: (P + 'Sleighbells_Hit_v1_rr*_Mid.wav', r'_v(?P<l>\d)_rr(?P<r>\d)'),                    # sleigh bells
    63: (P + 'Anvil_Hit1_v*_Sum.wav', r'_v(?P<l>\d)'),                             # anvil
    64: (P + 'Timpani/Timpani1_Hit_v*_rr*_Sum.wav', r'_v(?P<l>\d)_rr(?P<r>\d)'),  # timpani 1 (lowest)..5
    65: (P + 'Timpani/Timpani2_Hit_v*_rr*_Sum.wav', r'_v(?P<l>\d)_rr(?P<r>\d)'),
    66: (P + 'Timpani/Timpani3_Hit_v*_rr*_Sum.wav', r'_v(?P<l>\d)_rr(?P<r>\d)'),
    67: (P + 'Timpani/Timpani4_Hit_v*_rr*_Sum.wav', r'_v(?P<l>\d)_rr(?P<r>\d)'),
    68: (P + 'Timpani/Timpani5_Hit_v*_rr*_Sum.wav', r'_v(?P<l>\d)_rr(?P<r>\d)'),
    69: (P + 'Timpani/Rolls/Timpani1_Roll_v5_rr1_Sum.wav', r'_v(?P<l>\d)'),        # timpani rolls
    70: (P + 'Timpani/Rolls/Timpani3_Roll_v5_rr1_Sum.wav', r'_v(?P<l>\d)'),
}


def layer_key(l):
    return (LAYER_ORDER.index(l), 0) if l in LAYER_ORDER else (0, int(l)) if l.isdigit() else (99, l)


def vel_ranges(layers):
    ls = sorted(set(layers), key=layer_key)
    return {l: (1 + round(127 * i / len(ls)), round(127 * (i + 1) / len(ls))) for i, l in enumerate(ls)}


def build_auto(name, spec, flagged):
    files = []
    for path in sorted(glob.glob(os.path.join(ROOT, spec['glob']))):
        m = re.search(spec['rx'], os.path.basename(path))
        if m:
            named = 12 * (int(m['o']) + 1) + PC[m['n']] + (1 if m['a'] else 0)
            x, sr = sf.read(path)
            files.append((path, m, named, x, sr))
    measured = {}
    if spec.get('octave') is None:
        offs = []
        for path, m, named, x, sr in files:
            try:
                v = 69 + 12 * np.log2(f0(x, sr, spec['t0'], 0.25) / 440)
                if np.isfinite(v):
                    measured[path] = v
                    offs.append(round((v - named) / 12) * 12)
            except Exception:
                pass
        octave = max(set(offs), key=offs.count)
    else:
        octave = spec['octave']
    vr = vel_ranges([m['l'] for _, m, _, _, _ in files])
    out = []
    for path, m, named, x, sr in files:
        root = named + octave
        cents = 0.0
        if spec.get('tune') and path in measured:
            cents = (measured[path] - root) * 100
            near = round(measured[path])
            if abs(cents) > 50 and abs(measured[path] - near) < 0.3 and abs(near - root) <= 2:
                flagged.append(f'{name} {os.path.basename(path)}: named {root}, plays {near}; root corrected')
                root, cents = near, (measured[path] - near) * 100   # mislabelled file
            if abs(cents) > 50:
                flagged.append(f'{name} {os.path.basename(path)}: named {root}, measured {measured[path]:.2f}')
                cents = 0.0
        lo, hi = vr[m['l']]
        mono = x.mean(1) if x.ndim > 1 else x
        z = {'path': os.path.relpath(path, ROOT).replace('\\', '/'), 'root': root, 'layer': m['l'], 'vel_low': lo, 'vel_high': hi,
             'fine_tune': round(-cents, 1), 'seconds': round(len(x) / sr, 2),
             'rms_db': float(20 * np.log10(np.sqrt(np.mean(mono[int(0.4 * sr):int(2 * sr)] ** 2)) + 1e-9))}
        if 'r' in m.groupdict() and m['r']:
            z['rr'] = int(m['r'])
        out.append(z)
    if spec.get('trim'):
        for layer in {z['layer'] for z in out}:
            zs = [z for z in out if z['layer'] == layer]
            med = float(np.median([z['rms_db'] for z in zs]))
            for z in zs:
                z['level_trim'] = round(max(-6.0, min(6.0, med - z['rms_db'])), 1)
    for z in out:
        z.pop('rms_db')
    return out, octave


def build_kit():
    out = []
    for key, (pattern, rx) in KIT.items():
        files = [(p, re.search(rx, os.path.basename(p))) for p in sorted(glob.glob(os.path.join(ROOT, pattern)))]
        files = [(p, m) for p, m in files if m]
        if not files:
            raise FileNotFoundError(pattern)
        vr = vel_ranges([m['l'] for _, m in files])
        # Kit recordings sit at very different levels (congas far below the bass drum). Trim each key so its
        # loudest layer peaks at -3 dBFS, keeping the differences between its own layers.
        peaks = {p: 20 * np.log10(np.abs(sf.read(p)[0]).max() + 1e-9) for p, _ in files}
        trim = round(max(-12.0, min(12.0, -3 - max(peaks.values()))), 1)
        for p, m in files:
            info = sf.info(p)
            z = {'path': os.path.relpath(p, ROOT).replace('\\', '/'), 'root': key, 'layer': m['l'], 'vel_low': vr[m['l']][0],
                 'vel_high': vr[m['l']][1], 'fine_tune': 0, 'seconds': round(info.duration, 2), 'exact': True, 'level_trim': trim}
            if 'r' in m.groupdict() and m['r']:
                z['rr'] = int(m['r'])
            out.append(z)
    return out


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
    for inst, spec in AUTO.items():
        out, octave = build_auto(inst, spec, flagged)
        zones[inst] = out
        print(f'{inst}: {len(out)} zones, roots {min(z["root"] for z in out)}-{max(z["root"] for z in out)}, octave offset {octave:+d}, '
              f'layers {sorted({z["layer"] for z in out}, key=layer_key)}' + (', round robins' if any('rr' in z for z in out) else ''))
    zones['perc'] = build_kit()
    print(f'perc: {len(zones["perc"])} zones on keys {sorted({z["root"] for z in zones["perc"]})}')
    with open(os.path.join(ROOT, 'zones.json'), 'w') as f:
        json.dump(zones, f, indent=1)
    for line in flagged:
        print('FLAGGED (kept untuned):', line)


if __name__ == '__main__':
    sys.exit(main())
