"""Learns the reusable facts of a reference track: tempo, bars, key, chords, form, drum grids and mix profile.

Usage: python -I tools/analyze.py REF.wav|mp3 [--name NAME] [--stems [--separator roformer|demucs] [--overlap 1|2]]

Writes refs/<name>.profile.json. With --stems it also separates the track, transcribes the melodic
stems to MIDI (Basic Pitch) and adds melody and bass statistics plus a 'separator' field. Stems and
MIDI never go to git (they are derived from someone else's recording); they are cached per separator:
  --separator demucs (default)    Demucs htdemucs: drums, bass, vocals, other -> refs/<name>/htdemucs/*.wav.
                                  The lead shares 'other' with piano and guitar.
  --separator roformer            EXPERIMENTAL, NOT WORKING (2026-10-16): BS-RoFormer SW (6 stems) through
                                  audio-separator 0.47 on torch 2.10 CPU sends everything, vocals included,
                                  to 'other' (Viperx-1297 returned silence). ~7x real time on a laptop CPU.
                                  Stems would go to refs/<name>/roformer/*.flac.
MIDI goes next to the stems, and refs/<name>/*.mid mirrors the latest run (input for similarity.py).

What a profile is for: form and bar counts, tempo, harmonic habits (Roman numerals), drum grids in the
`drums()` string format of tools/lib/music.mjs, and per-section mix targets for measure.py --ref.
It deliberately keeps no melody, only statistics about it. Writing an original melody stays our job.
"""
import argparse, json, os, shutil, sys, warnings
from collections import Counter
import numpy as np, soundfile as sf
from scipy.signal import butter, lfilter, resample_poly, sosfilt

warnings.filterwarnings('ignore')
import librosa

ROOT = os.path.join(os.path.dirname(os.path.abspath(__file__)), '..')
sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
from measure import clicks  # noqa: E402  (shared click detector)

NAMES = ['C', 'Db', 'D', 'Eb', 'E', 'F', 'Gb', 'G', 'Ab', 'A', 'Bb', 'B']
ROMAN = ['I', 'bII', 'II', 'bIII', 'III', 'IV', '#IV', 'V', 'bVI', 'VI', 'bVII', 'VII']
# Krumhansl-Kessler key profiles.
KK_MAJ = np.array([6.35, 2.23, 3.48, 2.33, 4.38, 4.09, 2.52, 5.19, 2.39, 3.66, 2.29, 2.88])
KK_MIN = np.array([6.33, 2.68, 3.52, 5.38, 2.60, 3.53, 2.54, 4.75, 3.98, 2.69, 3.34, 3.17])
BANDS = [63, 125, 250, 500, 1000, 2000, 4000, 8000, 16000]
db = lambda x: float(20 * np.log10(max(float(x), 1e-9)))


def load(path):
    """Stereo float at 48 kHz (decodes MP3 etc. through librosa/ffmpeg when soundfile can't)."""
    try:
        x, sr = sf.read(path, always_2d=True)
    except Exception:
        y, sr = librosa.load(path, sr=None, mono=False)
        x = np.atleast_2d(y).T
    if x.shape[1] == 1: x = np.repeat(x, 2, 1)
    if sr != 48000: x = resample_poly(x, 48000, sr, axis=0); sr = 48000
    return x[:, :2], sr


# --- Loudness (ITU-R BS.1770 K-weighting at 48 kHz) ---------------------------------------------
def k_weight(x):
    x = lfilter([1.53512485958697, -2.69169618940638, 1.19839281085285], [1, -1.69065929318241, 0.73248077421585], x, axis=0)
    return lfilter([1.0, -2.0, 1.0], [1, -1.99004745483398, 0.99007225036621], x, axis=0)


def lufs(x, sr, gated=True):
    z = k_weight(x) ** 2
    if not gated: return -0.691 + 10 * np.log10(z.mean(0).sum() + 1e-12)
    n, hop = int(0.4 * sr), int(0.1 * sr)
    blocks = np.array([z[i:i + n].mean(0).sum() for i in range(0, max(1, len(z) - n), hop)])
    l = -0.691 + 10 * np.log10(blocks + 1e-12)
    keep = blocks[l > -70]
    if not len(keep): return -70.0
    rel = -0.691 + 10 * np.log10(keep.mean()) - 10
    keep = blocks[(l > -70) & (l > rel)]
    return float(-0.691 + 10 * np.log10(keep.mean()))


def true_peak(x):
    return db(np.abs(resample_poly(x, 4, 1, axis=0)).max())


def octave_bands(mono, sr):
    spec = np.abs(np.fft.rfft(mono)) ** 2
    f = np.fft.rfftfreq(len(mono), 1 / sr)
    lv = [10 * np.log10(spec[(f >= b / 2 ** 0.5) & (f < b * 2 ** 0.5)].sum() + 1e-20) for b in BANDS]
    return {str(b): round(l - lv[4], 1) for b, l in zip(BANDS, lv)}


def mix_profile(seg, sr):
    m = seg.mean(1); s = (seg[:, 0] - seg[:, 1]) / 2
    rms = np.sqrt(np.mean(m ** 2))
    return {'lufs': round(lufs(seg, sr, gated=False), 1), 'rms_db': round(db(rms), 1),
            'crest_db': round(db(np.abs(m).max()) - db(rms), 1),
            'width_db': round(db(np.sqrt(np.mean(s ** 2))) - db(rms), 1), 'bands': octave_bands(m, sr)}


# --- Rhythm -------------------------------------------------------------------------------------
def beats_and_bars(y, sr, beats_per_bar=4, max_bpm=140):
    """Beat times, the tempo, and which beat starts each bar (the phase with the most low-end onsets).
    Trackers often lock onto 8th notes in slow music: above max_bpm, every other beat is dropped
    (keeping the parity with more low-end onsets)."""
    onset = librosa.onset.onset_strength(y=y, sr=sr)
    tempo, beats = librosa.beat.beat_track(onset_envelope=onset, sr=sr, units='frames', trim=False)
    tempo = float(np.atleast_1d(tempo)[0])
    low = librosa.onset.onset_strength(y=sosfilt(butter(4, 150, 'lp', fs=sr, output='sos'), y), sr=sr)
    while len(beats) > 4 and 60 / np.median(np.diff(librosa.frames_to_time(beats, sr=sr))) > max_bpm:
        beats = beats[int(np.argmax([low[beats[0::2]].mean(), low[beats[1::2]].mean()]))::2]
    phase = int(np.argmax([low[beats[p::beats_per_bar]].mean() if len(beats[p::beats_per_bar]) else 0 for p in range(beats_per_bar)]))
    t = librosa.frames_to_time(beats, sr=sr)
    # Tempo from the median beat interval is steadier than the tracker's global estimate.
    bpm = float(60 / np.median(np.diff(t))) if len(t) > 2 else tempo
    return t, bpm, phase


def grid_times(beat_t, bar_starts, steps=16, bpb=4):
    """16 step times per bar, interpolated between the bar's beats."""
    out = []
    for b in bar_starts:
        if b + bpb >= len(beat_t): break
        bt = beat_t[b:b + bpb + 1]
        out.append([bt[k // (steps // bpb)] + (bt[k // (steps // bpb) + 1] - bt[k // (steps // bpb)]) * (k % (steps // bpb)) / (steps // bpb) for k in range(steps)])
    return np.array(out)


def drum_grids(y, sr, grid):
    """Kick / snare / hat patterns per bar as 'X.x.' strings (X accent, x hit), from band-limited onsets."""
    bands = {36: butter(4, 120, 'lp', fs=sr, output='sos'), 38: butter(4, [180, 2500], 'bp', fs=sr, output='sos'), 42: butter(4, 7000, 'hp', fs=sr, output='sos')}
    hop = 256
    out = {}
    for key, sos in bands.items():
        env = librosa.onset.onset_strength(y=sosfilt(sos, y), sr=sr, hop_length=hop)
        env = env / (np.percentile(env, 99) + 1e-9)
        frames = np.clip(librosa.time_to_frames(grid, sr=sr, hop_length=hop), 0, len(env) - 1)
        # Strongest onset within +-2 frames of each step.
        v = np.max([env[np.clip(frames + d, 0, len(env) - 1)] for d in range(-2, 3)], axis=0)
        out[key] = [''.join('X' if s > 0.6 else 'x' if s > 0.3 else '.' for s in bar) for bar in v]
    return out


# --- Harmony ------------------------------------------------------------------------------------
DIATONIC = {'major': {(0, ''), (2, 'm'), (4, 'm'), (5, ''), (7, ''), (9, 'm')},
            'minor': {(0, 'm'), (3, ''), (5, 'm'), (7, 'm'), (7, ''), (8, ''), (10, '')}}


def key_of(chroma, bar_chords):
    """Key profile correlation plus how many bar chords are diatonic to the key, plus how often the tonic
    chord itself appears. Extended chords (m9, maj9, 13) smear the chroma, so the chords break the tie
    between keys that share most notes (Db major vs F minor)."""
    c = chroma.mean(1)
    chords = [x for x in bar_chords if x is not None] or [(0, '')]
    scored = []
    for k in range(12):
        for p, mode in ((KK_MAJ, 'major'), (KK_MIN, 'minor')):
            rel = [((r - k) % 12, q) for r, q in chords]
            fit = np.mean([x in DIATONIC[mode] for x in rel])
            tonic = np.mean([x == (0, '' if mode == 'major' else 'm') for x in rel])
            scored.append((np.corrcoef(c, np.roll(p, k))[0, 1] + fit + tonic, k, mode, fit))
    best = max(scored)
    return {'tonic': NAMES[best[1]], 'mode': best[2], 'pc': best[1], 'diatonic_pct': round(float(best[3]) * 100), 'score': round(float(best[0]), 2)}


def chords_per_beat(chroma_beats):
    """Major/minor triad (or N) per beat: template match smoothed with a Viterbi pass."""
    labels, T = [], []
    for root in range(12):
        for q, ivs in (('', (0, 4, 7)), ('m', (0, 3, 7))):
            t = np.zeros(12); t[[(root + i) % 12 for i in ivs]] = [1, 0.8, 0.9]
            labels.append((root, q)); T.append(t / np.linalg.norm(t))
    T = np.array(T)
    c = chroma_beats / (np.linalg.norm(chroma_beats, axis=0, keepdims=True) + 1e-9)
    sim = T @ c                                                     # 24 x beats
    energy = chroma_beats.sum(0)
    p = np.exp(sim * 12); p /= p.sum(0, keepdims=True)
    path = librosa.sequence.viterbi_discriminative(p, librosa.sequence.transition_loop(24, 0.8))
    return [None if energy[i] < 0.05 * energy.max() else labels[k] for i, k in enumerate(path)]


def chord_name(c): return 'N' if c is None else NAMES[c[0]] + c[1]


def roman(c, key_pc):
    if c is None: return 'N'
    r = ROMAN[(c[0] - key_pc) % 12]
    return r.lower() if c[1] == 'm' else r


# --- Form ---------------------------------------------------------------------------------------
def sections(bar_feats, min_len=4, kernel=8, same=0.7):
    """Boundaries from a checkerboard novelty curve over the bar self-similarity matrix, labelled A, B, …
    by similarity of the sections' mean features."""
    F = (bar_feats - bar_feats.mean(0)) / (bar_feats.std(0) + 1e-9)
    F /= np.linalg.norm(F, axis=1, keepdims=True) + 1e-9
    S = F @ F.T
    n, k = len(S), kernel
    ker = np.kron(np.array([[1, -1], [-1, 1]]), np.ones((k, k)))
    nov = np.array([(S[i - k:i + k, i - k:i + k] * ker).sum() if k <= i <= n - k else 0 for i in range(n)])
    peaks = []
    for i in np.argsort(-nov):
        if nov[i] <= 0 or nov[i] < 0.4 * nov.max(): break
        if all(abs(i - p) >= min_len for p in peaks) and min_len <= i <= n - min_len: peaks.append(int(i))
    # Snap to an even bar when that costs little novelty: phrases come in 2s and 4s.
    peaks = sorted({p if p % 2 == 0 or nov[p - 1] < 0.8 * nov[p] and nov[min(p + 1, n - 1)] < 0.8 * nov[p] else p + (1 if nov[min(p + 1, n - 1)] >= nov[p - 1] else -1) for p in peaks})
    bounds = [0] + peaks + [n]
    segs, protos = [], []
    for a, b in zip(bounds, bounds[1:]):
        v = F[a:b].mean(0); v /= np.linalg.norm(v) + 1e-9
        match = max(((float(v @ p), i) for i, p in enumerate(protos) if float(v @ p) > same), default=(0, None))[1]
        if match is None: protos.append(v); match = len(protos) - 1
        segs.append({'label': chr(65 + match), 'bars': [a + 1, b]})
    return segs


# --- Notes (with --stems) -----------------------------------------------------------------------
# Separators: stems are cached per separator in refs/<name>/<dir>/ (separation is the slow part).
#   demucs:   Demucs htdemucs, 4 stems (lead instruments share 'other' with piano and guitar).
#   roformer: BS-RoFormer SW (jarredou), 6 stems via python-audio-separator; vocals SDR 11.3 vs 8-9 for
#             htdemucs, and piano and guitar get their own stems, so a horn or flute lead is left in 'other'.
SEPARATORS = {'demucs': ('htdemucs', 'wav', ('drums', 'bass', 'other', 'vocals')),
              'roformer': ('roformer', 'flac', ('drums', 'bass', 'other', 'vocals', 'guitar', 'piano'))}
ROFORMER_MODEL = 'BS-Roformer-SW.ckpt'   # 699 MB, downloaded once into MODEL_DIR
MODEL_DIR = os.environ.get('AUDIO_SEPARATOR_MODEL_DIR', os.path.join(os.path.expanduser('~'), '.cache', 'audio-separator-models'))


def separate(path, outdir, separator='demucs', overlap=1):
    sub, ext, names = SEPARATORS[separator]
    d = os.path.join(outdir, sub)
    stems = {s: os.path.join(d, f'{s}.{ext}') for s in names}
    if all(os.path.exists(p) for p in stems.values()): return stems
    if separator == 'demucs':
        from demucs.separate import main as demucs_main
        demucs_main(['-n', 'htdemucs', '-o', outdir, '--filename', '{stem}.{ext}', path])
        return stems
    import logging
    from audio_separator.separator import Separator
    # overlap=1 (no overlapping 9.3 s windows) halves the CPU time of the model's default 2.
    sep = Separator(log_level=logging.WARNING, model_file_dir=MODEL_DIR, output_dir=d, output_format='FLAC',
                    mdxc_params={'segment_size': 256, 'override_model_segment_size': False, 'batch_size': 1, 'overlap': overlap, 'pitch_shift': 0})
    sep.load_model(ROFORMER_MODEL)
    sep.separate(path, custom_output_names={s: s for s in names})
    missing = [p for p in stems.values() if not os.path.exists(p)]
    if missing: raise RuntimeError(f'separator did not write {missing}')
    return stems


def transcribe(wav, mid):
    from basic_pitch.inference import predict
    from basic_pitch import ICASSP_2022_MODEL_PATH
    # Stricter than the defaults: separated stems carry bleed and harmonics that become ghost notes.
    _, midi, notes = predict(wav, ICASSP_2022_MODEL_PATH, onset_threshold=0.6, frame_threshold=0.35, minimum_note_length=100)
    midi.write(mid)
    return sorted((float(s), float(e), int(p)) for s, e, p, *_ in notes)


def skyline(notes):
    """Monophonic top line: at each onset keep the highest note starting within 50 ms."""
    out = []
    for s, e, p in notes:
        if out and s - out[-1][0] < 0.05:
            if p > out[-1][2]: out[-1] = (s, e, p)
        else: out.append((s, e, p))
    return out


def line_stats(notes, beat_t, bar_starts):
    if len(notes) < 8: return None
    p = np.array([n[2] for n in notes]); iv_all = np.diff(p)
    # A jump of exactly an octave is mostly the transcriber hearing a harmonic; keep it out of the shape stats.
    octave = np.abs(iv_all) == 12
    iv = iv_all[~octave]
    beat_len = float(np.median(np.diff(beat_t)))
    gaps = np.array([b[0] - a[1] for a, b in zip(notes, notes[1:])])
    phrases = np.split(np.arange(len(notes)), np.where(gaps > beat_len)[0] + 1)
    bar_t = beat_t[bar_starts]
    per_bar = np.histogram([n[0] for n in notes], bins=bar_t)[0] if len(bar_t) > 1 else [len(notes)]
    # Onset position within the beat (0, 1/4, 1/2, 3/4): how much the line syncopates.
    pos = Counter(int(round(((n[0] - beat_t[max(0, np.searchsorted(beat_t, n[0]) - 1)]) / beat_len) * 4)) % 4 for n in notes)
    return {
        'range': [librosa.midi_to_note(int(np.percentile(p, 5)), unicode=False), librosa.midi_to_note(int(np.percentile(p, 95)), unicode=False)], 'median': librosa.midi_to_note(int(np.median(p)), unicode=False),
        'steps_pct': round(float(np.mean(np.abs(iv) <= 2) * 100)), 'leaps_pct': round(float(np.mean(np.abs(iv) >= 5) * 100)),
        'repeats_pct': round(float(np.mean(iv == 0) * 100)), 'octave_jumps_pct': round(float(np.mean(octave) * 100)),
        'intervals': {str(k): v for k, v in sorted(Counter(int(np.clip(i, -12, 12)) for i in iv).items())},
        'notes_per_bar': round(float(np.mean(per_bar)), 1), 'phrase_notes': round(float(np.mean([len(x) for x in phrases])), 1),
        'onset_in_beat_pct': {k: round(pos[i] / len(notes) * 100) for i, k in enumerate(['on', 'e', '&', 'a'])},
    }


def main():
    ap = argparse.ArgumentParser()
    ap.add_argument('ref'); ap.add_argument('--name'); ap.add_argument('--stems', action='store_true')
    ap.add_argument('--separator', choices=sorted(SEPARATORS), default='demucs', help='stem separator for --stems (cached per separator)')
    ap.add_argument('--overlap', type=int, default=1, help='RoFormer overlapping windows (2 = model default, twice the time)')
    ap.add_argument('--beats-per-bar', type=int, default=4)
    ap.add_argument('--max-bpm', type=float, default=140, help='fold faster beat tracks down by half (raise for fast genres)')
    a = ap.parse_args()
    name = a.name or os.path.splitext(os.path.basename(a.ref))[0]
    os.makedirs(os.path.join(ROOT, 'refs'), exist_ok=True)

    x, sr = load(a.ref)
    mono = x.mean(1)
    y = librosa.resample(mono, orig_sr=sr, target_sr=22050); ysr = 22050
    beat_t, bpm, phase = beats_and_bars(y, ysr, a.beats_per_bar, a.max_bpm)
    bpb = a.beats_per_bar
    bar_starts = list(range(phase, len(beat_t) - 1, bpb))
    hop = 512
    beat_f = librosa.time_to_frames(beat_t, sr=ysr, hop_length=hop)
    harm, perc = librosa.effects.hpss(y)
    chroma = librosa.feature.chroma_cqt(y=harm, sr=ysr, hop_length=hop)
    cb = librosa.util.sync(chroma, beat_f, aggregate=np.median)[:, 1:]   # one column per beat
    beat_chords = chords_per_beat(cb)[:len(beat_t)]
    bar_chords = [Counter(beat_chords[b:b + bpb]).most_common(1)[0][0] for b in bar_starts]
    key = key_of(chroma, bar_chords)

    # Bar-level features for form: chroma, timbre and level.
    mfcc = librosa.feature.mfcc(y=y, sr=ysr, n_mfcc=13, hop_length=hop)
    rms = librosa.feature.rms(y=y, hop_length=hop)
    bar_f = librosa.time_to_frames(beat_t[bar_starts], sr=ysr, hop_length=hop)
    feats = np.vstack([librosa.util.sync(chroma, bar_f), librosa.util.sync(mfcc, bar_f), 3 * librosa.amplitude_to_db(librosa.util.sync(rms, bar_f)) / 20])[:, 1:].T
    form = sections(feats[:len(bar_starts)])

    grid = grid_times(beat_t, bar_starts, 16, bpb)
    stems = None
    if a.stems:
        sdir = os.path.join(ROOT, 'refs', name)
        stems = separate(os.path.abspath(a.ref), sdir, a.separator, a.overlap)
        perc, _ = librosa.load(stems['drums'], sr=ysr)
    grids = drum_grids(perc, ysr, grid)

    t_bar = lambda i: beat_t[bar_starts[min(i, len(bar_starts) - 1)]]
    for s in form:
        a0, b0 = s['bars']
        t0, t1 = t_bar(a0 - 1), (t_bar(b0) if b0 < len(bar_starts) else len(mono) / sr)
        s['seconds'] = [round(float(t0), 2), round(float(t1), 2)]
        s['mix'] = mix_profile(x[int(t0 * sr):int(t1 * sr)], sr)
        ch = bar_chords[a0 - 1:b0]
        s['chords'] = [chord_name(c) for c in ch]
        s['roman'] = [roman(c, key['pc']) for c in ch]
        s['drums'] = {k: [p for p, _ in Counter(v[a0 - 1:b0]).most_common(2)] for k, v in grids.items()}

    prog = Counter(tuple(roman(c, key['pc']) for c in bar_chords[i:i + 4]) for i in range(0, len(bar_chords) - 3, 2))
    profile = {
        'source': os.path.basename(a.ref), 'seconds': round(len(mono) / sr, 1),
        'bpm': round(bpm, 1), 'beats_per_bar': bpb, 'bars': len(bar_starts), 'first_downbeat_s': round(float(beat_t[phase]), 3),
        'key': {k: v for k, v in key.items() if k != 'pc'},
        'loudness': {'lufs': round(lufs(x, sr), 1), 'true_peak_db': round(true_peak(x), 1), 'clicks': len(clicks(mono, sr))},
        'mix': mix_profile(x, sr),
        'progressions': [{'roman': list(p), 'count': n} for p, n in prog.most_common(6)],
        'chord_use': {k: v for k, v in Counter(roman(c, key['pc']) for c in bar_chords).most_common()},
        'form': form,
    }
    if stems:
        profile['separator'] = a.separator
        lines = {}
        sdir = os.path.join(ROOT, 'refs', name)
        for s in ('vocals', 'other', 'piano', 'guitar', 'bass'):
            top = os.path.join(sdir, f'{s}.mid')
            if s not in stems:   # a stem this separator lacks: drop a stale copy from another separator
                if os.path.exists(top): os.remove(top)
                continue
            # MIDI is kept per separator; refs/<name>/*.mid mirrors the latest run (similarity.py input).
            mid = os.path.join(os.path.dirname(stems[s]), f'{s}.mid')
            notes = transcribe(stems[s], mid)
            shutil.copyfile(mid, top)
            st = line_stats(skyline(notes) if s != 'bass' else notes, beat_t, bar_starts)
            if st: lines[s] = st
        profile['lines'] = lines
    out = os.path.join(ROOT, 'refs', f'{name}.profile.json')
    with open(out, 'w', encoding='utf-8') as f: json.dump(profile, f, indent=1)
    print(f'{name}: {profile["bpm"]} BPM, {key["tonic"]} {key["mode"]} ({key["diatonic_pct"]}% diatonic), {len(bar_starts)} bars, '
          f'{profile["loudness"]["lufs"]} LUFS, form ' + ' '.join(f'{s["label"]}{s["bars"][1] - s["bars"][0] + 1}' for s in form))
    print(f'  top progressions: ' + ' | '.join('-'.join(p['roman']) + f' x{p["count"]}' for p in profile['progressions'][:3]))
    print(f'  wrote {os.path.relpath(out, ROOT)}')


if __name__ == '__main__':
    main()
