"""Draws a mix as PNGs, so Claude can look at what it can't hear (open them with the Read tool).

Usage:
  python -I tools/visualize.py mix OUT.png FILE.wav --bpm B [--beats 4] [--sections JSON] [--ref refs/<name>.profile.json]
  python -I tools/visualize.py stems OUT.png --bpm B [--beats 4] [--sections JSON] NAME=FILE.wav ...
  python -I tools/visualize.py roll OUT.png pieces/<name>.mjs [--lead NAME] [--instruments A,B] [--bars a-b] [--sections JSON]
  python -I tools/visualize.py compare OUT.png A.wav B.wav [--labels a,b] [--bpm 92,95.7] [--beats 4]

mix:     log-frequency spectrogram, per-bar RMS and short-term loudness with measure.py's JUMP/DROP flags,
         octave bands vs 1 kHz per section against the RULES §5 targets (and a reference profile), stereo width.
stems:   per-instrument RMS per bar in stacked lanes on one dB scale, the loudest other stem dashed,
         and a section table of each stem against the loudest one.
roll:    piano roll from tools/notes.mjs; red marks where another part's top note is above the lead.
compare: octave-band curves, loudness and width of two mixes overlaid (before/after, ours vs reference).
Sections are '{"Name": [first_bar, last_bar], ...}'. Time axes are in bars (bar 1 starts at x = 1).
"""
import argparse, json, os, subprocess, sys
import numpy as np, soundfile as sf
from scipy.fft import next_fast_len, rfft
from scipy.signal import lfilter, resample_poly
import matplotlib
matplotlib.use('Agg')
import matplotlib.pyplot as plt
from matplotlib.collections import PolyCollection, LineCollection
from matplotlib.colors import to_rgba

ROOT = os.path.join(os.path.dirname(os.path.abspath(__file__)), '..')
BANDS = [63, 125, 250, 500, 1000, 2000, 4000, 8000, 16000]
TARGET = {125: (0, 6), 4000: (-12, -8)}  # RULES §5: about +3 at 125 Hz, -8..-12 at 4 kHz (dB re 1 kHz)
INK, GRID, ACC, ACC2 = '#222222', '#c8c8c8', '#d7191c', '#1f5fa8'
# Instrument colours for the roll: no red, which marks problems.
PALETTE = ['#1f77b4', '#ff7f0e', '#2ca02c', '#9467bd', '#8c564b', '#e377c2', '#7f7f7f', '#bcbd22', '#17becf',
           '#393b79', '#637939', '#8c6d31', '#5254a3', '#6b6ecf']
NAMES = ['C', 'C#', 'D', 'Eb', 'E', 'F', 'F#', 'G', 'Ab', 'A', 'Bb', 'B']
plt.rcParams.update({'font.size': 15, 'axes.titlesize': 18, 'axes.titleweight': 'bold', 'axes.titlelocation': 'left',
                     'axes.labelsize': 15, 'figure.facecolor': 'white', 'axes.facecolor': 'white',
                     'axes.edgecolor': '#888888', 'axes.spines.top': False, 'axes.spines.right': False,
                     'legend.fontsize': 13, 'legend.frameon': False})
db = lambda x: 20 * np.log10(np.maximum(x, 1e-9))


# --- Analysis --------------------------------------------------------------------------------------
def load(path):
    """Stereo float32 at 48 kHz (the K-weighting coefficients assume 48 kHz)."""
    x, sr = sf.read(path, always_2d=True, dtype='float32')
    if x.shape[1] == 1: x = np.repeat(x, 2, 1)
    if sr != 48000: x = resample_poly(x, 48000, sr, axis=0).astype(np.float32)
    return x[:, :2], 48000


def k_power(x):
    """Per-sample K-weighted power summed over channels (ITU-R BS.1770, 48 kHz)."""
    y = lfilter([1.53512485958697, -2.69169618940638, 1.19839281085285], [1, -1.69065929318241, 0.73248077421585], x, axis=0)
    y = lfilter([1.0, -2.0, 1.0], [1, -1.99004745483398, 0.99007225036621], y, axis=0)
    return (y ** 2).sum(1)


def windowed_mean(p, n, hop):
    c = np.concatenate([[0], np.cumsum(p, dtype=np.float64)])
    starts = np.arange(0, max(1, len(p) - n + 1), hop)
    return starts, (c[np.minimum(starts + n, len(p))] - c[starts]) / n


def loudness(x, sr):
    """Integrated LUFS (gated) and the short-term (3 s) curve as (centre seconds, LUFS)."""
    p = k_power(x)
    _, blocks = windowed_mean(p, int(0.4 * sr), int(0.1 * sr))
    l = -0.691 + 10 * np.log10(blocks + 1e-12)
    keep = blocks[l > -70]
    integ = -70.0
    if len(keep):
        rel = -0.691 + 10 * np.log10(keep.mean()) - 10
        keep = blocks[(l > -70) & (l > rel)]
        integ = float(-0.691 + 10 * np.log10(keep.mean()))
    s, st = windowed_mean(p, 3 * sr, sr // 4)
    return integ, (s + 1.5 * sr) / sr, -0.691 + 10 * np.log10(st + 1e-12)


def per_bar(sig, bar):
    """RMS dB per bar, the last bar partial, as measure.py counts them."""
    n = int(np.ceil(len(sig) / bar))
    return np.array([db(np.sqrt(np.mean(sig[i * bar:(i + 1) * bar] ** 2))) for i in range(n)])


def jumps_drops(rms):
    """measure.py's flags: JUMP > 6 dB vs the previous bar, DROP > 8 dB below both neighbours (1-based bars)."""
    out = []
    for i in range(1, len(rms) - 1):
        if rms[i] - rms[i - 1] > 6: out.append(('JUMP', i + 1, rms[i] - rms[i - 1]))
        if rms[i] < min(rms[i - 1], rms[i + 1]) - 8: out.append(('DROP', i + 1, min(rms[i - 1], rms[i + 1]) - rms[i]))
    return out


def octave_bands(mono, sr):
    """dB re 1 kHz per octave band, the same FFT-sum as measure.py and analyze.py."""
    n = next_fast_len(len(mono), real=True)  # zero-padded: an awkward length makes the FFT 50x slower
    spec = np.abs(rfft(mono, n)) ** 2
    f = np.fft.rfftfreq(n, 1 / sr)
    lv = [10 * np.log10(spec[(f >= b / 2 ** 0.5) & (f < b * 2 ** 0.5)].sum() + 1e-20) for b in BANDS]
    return np.array(lv) - lv[4]


def width(x, bar):
    """Side/mid dB per bar (NaN where the mix is near silent: noise reads as wide)."""
    m, s = x.mean(1), (x[:, 0] - x[:, 1]) / 2
    mr = per_bar(m, bar)
    return np.where(mr > -60, per_bar(s, bar) - mr, np.nan)


def spectrogram(mono, sr, nfft=4096, hop=1024, nbins=150, lo=30, hi=16000):
    """Power in dB on log-spaced bins lo..hi; returns (dB [bins, frames], bin edges Hz, hop seconds)."""
    f = np.fft.rfftfreq(nfft, 1 / sr)
    edges = np.geomspace(lo, hi, nbins + 1)
    W = np.zeros((len(f), nbins), np.float32)
    for j in range(nbins):
        idx = np.where((f >= edges[j]) & (f < edges[j + 1]))[0]
        if not len(idx): idx = [np.argmin(np.abs(f - np.sqrt(edges[j] * edges[j + 1])))]
        W[idx, j] = 1 / len(idx)
    win = np.hanning(nfft).astype(np.float32)
    pad = np.concatenate([np.zeros(nfft // 2, np.float32), mono, np.zeros(nfft, np.float32)])
    nfr = (len(mono) + hop - 1) // hop
    out = np.empty((nfr, nbins), np.float32)
    frames = np.lib.stride_tricks.sliding_window_view(pad, nfft)[::hop][:nfr]
    for i in range(0, nfr, 1024):
        out[i:i + 1024] = (np.abs(np.fft.rfft(frames[i:i + 1024] * win, axis=1)) ** 2) @ W
    return 10 * np.log10(out.T + 1e-12), edges, hop / sr


# --- Drawing helpers ---------------------------------------------------------------------------------
def headline(fig, text, lines=1):
    """Figure title pinned just above the top panel (suptitle alone leaves a gap on tall figures)."""
    h = fig.get_figheight()
    fig.subplots_adjust(top=1 - (1.0 + 0.35 * lines) / h)
    fig.suptitle(text, fontsize=18 if lines == 1 else 16, fontweight='bold', x=0.125, ha='left', y=1 - 0.15 / h, va='top')


def parse_sections(s):
    return json.loads(s) if s else {}


def draw_sections(axes, sections, names_on=None, xmax=None):
    """Vertical lines at each section start on every axis; names above names_on."""
    for name, (a, b) in sections.items():
        for ax in axes: ax.axvline(a, color=INK, lw=1.4, alpha=0.7, zorder=5)
        if names_on is not None:
            names_on.text(a + 0.3, 1.01, name, transform=names_on.get_xaxis_transform(), fontsize=15,
                          fontweight='bold', va='bottom', ha='left', color=INK, clip_on=False)
    if sections and xmax:
        last = max(b for a, b in sections.values()) + 1
        for ax in axes: ax.axvline(last, color=INK, lw=1.4, alpha=0.7, zorder=5)


def bar_ticks(ax, nbars, every=None, first=1):
    every = every or (4 if nbars <= 64 else 8)
    ax.set_xticks(np.arange(first, first + nbars + 1, every))
    ax.set_xticks(np.arange(first, first + nbars + 1), minor=True)
    ax.grid(axis='x', which='major', color=GRID, lw=0.8)
    ax.tick_params(axis='x', which='minor', length=3)


def band_heat(ax, vals, xedges, title, cmap='RdBu_r', lim=18, targets=True, fmt='{:+.0f}'):
    """Rows = octave bands (63 at the bottom), columns = sections spanning their bars; values printed in cells."""
    ax.pcolormesh(xedges, np.arange(len(BANDS) + 1), vals.T, cmap=cmap, vmin=-lim, vmax=lim, shading='flat')
    for j in range(vals.shape[0]):
        xc, wcol = (xedges[j] + xedges[j + 1]) / 2, xedges[j + 1] - xedges[j]
        for i, b in enumerate(BANDS):
            v = vals[j, i]
            if b == 1000 and targets: continue
            bad = targets and b in TARGET and not (TARGET[b][0] <= v <= TARGET[b][1])
            ax.text(xc, i + 0.5, fmt.format(v), ha='center', va='center', fontsize=13 if wcol / (xedges[-1] - xedges[0]) > 0.05 else 10,
                    color='white' if abs(v) > lim * 0.6 else INK, fontweight='bold' if bad else 'normal')
            if bad:
                ax.add_patch(plt.Rectangle((xedges[j] + 0.15, i + 0.06), wcol - 0.3, 0.88, fill=False, ec=ACC, lw=2.5, zorder=6))
    lab = [f'{b // 1000}k' if b >= 1000 else str(b) for b in BANDS]
    if targets: lab = [l + (' (+3)' if b == 125 else ' (-8..-12)' if b == 4000 else '') for l, b in zip(lab, BANDS)]
    ax.set_yticks(np.arange(len(BANDS)) + 0.5, lab)
    ax.set_title(title)


# --- mix ---------------------------------------------------------------------------------------------
def cmd_mix(a):
    x, sr = load(a.wav)
    sections = parse_sections(a.sections)
    bar = int(sr * 60 / a.bpm * a.beats)
    mono = x.mean(1)
    rms = per_bar(mono, bar)
    nb = len(rms)
    if not sections: sections = {'All': [1, nb]}
    integ, st_t, st = loudness(x, sr)
    ref = json.load(open(a.ref, encoding='utf-8')) if a.ref else None
    same_form = ref is not None and len(ref['form']) == len(sections)

    ratios = [5, 3, 3.2] + ([3.2] if same_form else []) + [1.6, 3.4]
    fig, axs = plt.subplots(len(ratios), 1, figsize=(20, sum(ratios) * 1.45 + 1.5), gridspec_kw={'height_ratios': ratios, 'hspace': 0.55})
    time_axes = axs[:-1]
    peak = db(np.abs(x).max())
    headline(fig, f'{os.path.basename(a.wav)}   {len(mono) / sr:.0f} s, {nb} bars @ {a.bpm:g} BPM   '
             f'{integ:.1f} LUFS, peak {peak:.1f} dBFS')

    # (a) spectrogram
    S, edges, hs = spectrogram(mono, sr)
    top = S.max()
    ax = axs[0]
    ax.imshow(S, origin='lower', aspect='auto', cmap='Greys', vmin=top - 75, vmax=top - 5, interpolation='nearest',
              extent=[1, 1 + S.shape[1] * hs * sr / bar, 0, len(edges) - 1])
    ticks = [50, 100, 200, 500, 1000, 2000, 4000, 8000, 16000]
    ax.set_yticks(np.interp(np.log(ticks), np.log(edges), np.arange(len(edges))), [f'{t // 1000}k' if t >= 1000 else str(t) for t in ticks])
    ax.set_ylabel('Hz')
    ax.set_title('Spectrogram (log frequency, 70 dB range; dark = loud)', pad=34)

    # (b) loudness lane
    ax = axs[1]
    ax.bar(np.arange(1, nb + 1), rms + 80, width=1, align='edge', bottom=-80, color='#b9c7d8', edgecolor='white', lw=0.5, label='RMS per bar (dBFS)')
    ax.plot(1 + st_t * sr / bar, st, color=ACC2, lw=2, label='short-term LUFS (3 s)')
    ax.axhline(integ, color=ACC2, lw=1, ls=':', label=f'integrated {integ:.1f} LUFS')
    if ref: ax.axhline(ref['loudness']['lufs'], color=INK, lw=1.2, ls='--', label=f'reference {ref["loudness"]["lufs"]:.1f} LUFS')
    lo = max(np.percentile(rms, 10) - 14, -80)  # a fade-out runs off the bottom rather than squash the rest
    ax.set_ylim(lo, max(rms.max(), st.max()) + 5)
    for kind, b, d in jumps_drops(rms):
        y = rms[b - 1]
        ax.annotate(f'{kind} {d:.0f}', (b + 0.5, y), xytext=(b + 0.5, y + (3 if kind == 'JUMP' else -4)), ha='center',
                    fontsize=13, fontweight='bold', color=ACC, arrowprops=dict(arrowstyle='-|>', color=ACC, lw=1.5))
    flags = jumps_drops(rms)
    ax.set_title('Loudness per bar' + (f'  ({len(flags)} JUMP/DROP flags)' if flags else '  (no JUMP/DROP flags)'))
    ax.set_ylabel('dB')
    ax.legend(loc='lower center', ncol=4, bbox_to_anchor=(0.5, -0.02))

    # (c) octave bands per section, (c2) ours minus reference per section
    xe = [v[0] for v in sections.values()] + [list(sections.values())[-1][1] + 1]
    ours = np.array([octave_bands(mono[(s - 1) * bar:e * bar], sr) for s, e in sections.values()])
    band_heat(axs[2], ours, xe, 'Octave bands, dB re 1 kHz, per section (red box = outside the RULES §5 target)')
    k = 3
    if same_form:
        rv = np.array([[s['mix']['bands'][str(b)] for b in BANDS] for s in ref['form']])
        band_heat(axs[3], ours - rv, xe, f'Ours minus {os.path.basename(a.ref).split(".")[0]}, section by section in order '
                  f'(reference sections {", ".join(s["label"] for s in ref["form"])})', cmap='PuOr_r', lim=15, targets=False)
        axs[3].set_yticks(np.arange(len(BANDS)) + 0.5, [f'{b // 1000}k' if b >= 1000 else str(b) for b in BANDS])
        k = 4

    # (d) width
    ax = axs[k]
    w = width(x, bar)
    ax.bar(np.arange(1, nb + 1), w - (-40), width=1, align='edge', bottom=-40, color='#9fb8a0', edgecolor='white', lw=0.5)
    ax.set_ylim(min(-25, np.nanpercentile(w, 2) - 2), max(0, np.nanmax(w) + 2))
    if ref: ax.axhline(ref['mix']['width_db'], color=INK, lw=1.2, ls='--', label=f'reference {ref["mix"]["width_db"]:.1f} dB')
    ax.set_title(f'Stereo width, side/mid dB per bar (whole track {db(np.sqrt(np.mean(((x[:, 0] - x[:, 1]) / 2) ** 2))) - db(np.sqrt(np.mean(mono ** 2))):.1f} dB; higher = wider)')
    ax.set_ylabel('dB')
    if ref: ax.legend(loc='lower right')

    for ax in time_axes:
        bar_ticks(ax, nb); ax.set_xlim(1, nb + 1)
    axs[k].set_xlabel('bar')
    draw_sections(time_axes, sections, names_on=axs[0], xmax=nb)

    # (e) whole-mix band curve against the targets and the reference
    ax = axs[-1]
    xs = np.arange(len(BANDS))
    for s, row in zip(sections, ours):
        ax.plot(xs, row, color='#bbbbbb', lw=1)
    whole = octave_bands(mono, sr)
    ax.plot(xs, whole, color=ACC2, lw=3, marker='o', label='this mix (grey: its sections)')
    for b, (l, h) in TARGET.items():
        i = BANDS.index(b)
        ax.add_patch(plt.Rectangle((i - 0.3, l), 0.6, h - l, color='#2e8b57', alpha=0.25, lw=0))
    ax.plot([], [], color='#2e8b57', alpha=0.4, lw=8, label='RULES §5 target')
    if ref:
        rb = [ref['mix']['bands'][str(b)] for b in BANDS]
        ax.plot(xs, rb, color=INK, lw=2.5, ls='--', marker='s', label=f'{os.path.basename(a.ref).split(".")[0]} (whole)')
    for i, v in enumerate(whole):
        ax.text(i, v + 2, f'{v:+.0f}', ha='center', color=ACC2, fontsize=13, fontweight='bold')
    ax.set_xticks(xs, [f'{b // 1000}k' if b >= 1000 else str(b) for b in BANDS])
    ax.set_xlabel('octave band, Hz'); ax.set_ylabel('dB re 1 kHz')
    ax.grid(axis='y', color=GRID)
    ax.set_title('Whole-mix tonal balance')
    ax.legend(loc='lower left')
    fig.savefig(a.out, dpi=a.dpi, bbox_inches='tight')
    print(a.out)


# --- stems -------------------------------------------------------------------------------------------
def cmd_stems(a):
    sections = parse_sections(a.sections)
    names, curves, srms = [], [], []
    for p in a.pairs:
        n, path = p.split('=', 1)
        x, sr = load(path)
        bar = int(sr * 60 / a.bpm * a.beats)
        m = x.mean(1)
        names.append(n); curves.append(per_bar(m, bar))
        srms.append([db(np.sqrt(np.mean(m[(s - 1) * bar:e * bar] ** 2))) for s, e in sections.values()])
    nb = max(len(c) for c in curves)
    C = np.full((len(names), nb), -120.0)
    for i, c in enumerate(curves): C[i, :len(c)] = c
    top = C.max(); floor = top - 50
    ns = len(names)
    # Lanes, then (with sections) an empty spacer row and the section table.
    fig, axs = plt.subplots(ns + (2 if sections else 0), 1, figsize=(20, 1.55 * ns + (0.75 * ns + 3.5 if sections else 1)),
                            gridspec_kw={'height_ratios': [1.6] * ns + ([1.1, 0.75 * ns + 1] if sections else []), 'hspace': 0.45})
    axs = np.atleast_1d(axs)
    if sections: axs[ns].axis('off')
    headline(fig, f'Stem RMS per bar, dBFS (one scale, {floor:.0f} to {top:.0f}); dashed = loudest other stem; '
             f'red ▲ = stem JUMP > 6 dB', lines=1.2 if sections else 1)
    loudest = {}
    if sections:
        S = np.array(srms)
        for j, (sn, (s, e)) in enumerate(sections.items()): loudest[sn] = int(np.argmax(S[:, j]))
    for i, (n, ax) in enumerate(zip(names, axs)):
        c = np.maximum(C[i], floor)
        other = np.maximum(np.delete(C, i, 0).max(0), floor) if ns > 1 else None
        ax.bar(np.arange(1, nb + 1), c - floor, width=1, align='edge', bottom=floor, color='#9db4cf', edgecolor='white', lw=0.4)
        if other is not None: ax.step(np.arange(1, nb + 2), np.append(other, other[-1]), where='post', color=INK, lw=1.2, ls='--')
        for b in range(1, nb):
            if C[i, b] - C[i, b - 1] > 6 and C[i, b] > floor + 6:
                ax.plot(b + 1.5, C[i, b] + 3, marker='^', color=ACC, ms=11)
        for sn, (s, e) in sections.items():
            if loudest.get(sn) == i:
                ax.axvspan(s, e + 1, color='#f2c94c', alpha=0.35, lw=0, zorder=0)
                ax.text((s + e + 1) / 2, top + 3, 'loudest', ha='center', va='center', fontsize=12, fontweight='bold', color='#8a6d00')
        ax.set_ylim(floor, top + 6)
        ax.set_xlim(1, nb + 1)
        ax.set_ylabel(n, rotation=0, ha='right', va='center', fontsize=16, fontweight='bold')
        ax.set_yticks([floor + 10, top - 10], [f'{floor + 10:.0f}', f'{top - 10:.0f}'], fontsize=11)
        bar_ticks(ax, nb)
        if i < ns - 1: ax.tick_params(axis='x', labelbottom=False)
    draw_sections(axs[:ns], sections, names_on=axs[0], xmax=nb)
    axs[ns - 1].set_xlabel('bar')
    if sections:
        # Section table: each stem relative to the section's loudest stem (lead 2-3 dB above accompaniment, pads 6-8 below).
        ax = axs[-1]
        S = np.array(srms); R = S - S.max(0)
        ax.imshow(np.maximum(R, -30), cmap='Blues', vmin=-30, vmax=0, aspect='auto')
        for i in range(ns):
            for j in range(len(sections)):
                ax.text(j, i, 'silent' if S[i, j] < -90 else f'{R[i, j]:+.1f}' if R[i, j] < 0 else f'{S[i, j]:.0f} dBFS',
                        ha='center', va='center', fontsize=12, fontweight='bold' if R[i, j] == 0 else 'normal',
                        color='white' if R[i, j] > -12 else INK)
        ax.set_xticks(range(len(sections)), list(sections), fontsize=13)
        ax.set_yticks(range(ns), names, fontsize=13)
        ax.set_title('Section RMS vs the loudest stem in that section, dB (loudest shows its dBFS)')
        ax.spines[:].set_visible(False)
    fig.savefig(a.out, dpi=a.dpi, bbox_inches='tight')
    print(a.out)


# --- roll --------------------------------------------------------------------------------------------
def note_name(m):
    return f'{NAMES[m % 12]}{m // 12 - 1}'


def top_line(notes, steps, q):
    """Highest sounding pitch per grid step (-1 = silent)."""
    t = np.full(steps, -1)
    for p, s, l, v in notes:
        a, b = int(np.floor(s / q + 1e-6)), max(int(np.ceil((s + l) / q - 1e-6)), int(np.floor(s / q + 1e-6)) + 1)
        t[a:b] = np.maximum(t[a:b], p)
    return t


def cmd_roll(a):
    r = subprocess.run(['node', os.path.join(ROOT, 'tools', 'notes.mjs'), a.piece], capture_output=True, text=True, cwd=ROOT, shell=os.name == 'nt')
    if r.returncode: sys.exit(r.stderr)
    d = json.loads(r.stdout)
    beats, sections = a.beats, parse_sections(a.sections)
    insts = {k: v for k, v in d['instruments'].items() if not a.instruments or k in a.instruments.split(',')}
    end = max((n[1] + n[2]) for v in insts.values() for n in v['notes']) / beats + 1
    b0, b1 = (map(float, a.bars.split('-')) if a.bars else (1, end))
    b1 = b1 + 1 if a.bars else b1
    X = lambda beat: 1 + beat / beats
    vis = lambda n: X(n[1] + n[2]) > b0 and X(n[1]) < b1
    pitched = {k: [n for n in v['notes'] if vis(n)] for k, v in insts.items() if not v['percussive']}
    perc = {k: [n for n in v['notes'] if vis(n)] for k, v in insts.items() if v['percussive']}
    rows = [(k, key) for k, ns in perc.items() for key in sorted({n[0] for n in ns})]
    allp = [n[0] for ns in pitched.values() for n in ns] or [60]
    lo, hi = min(allp) - 2, max(allp) + 2
    col = {k: PALETTE[i % len(PALETTE)] for i, k in enumerate(insts)}
    lead = a.lead if a.lead in pitched else None

    h1, h2 = max(6, (hi - lo) * 0.17), (max(1.5, len(rows) * 0.32) if rows else 0)
    fig, axs = plt.subplots(2 if rows else 1, 1, figsize=(22, h1 + h2 + 2), squeeze=False,
                            gridspec_kw={'height_ratios': [h1] + ([h2] if rows else []), 'hspace': 0.12})
    ax = axs[0, 0]
    alpha = lambda v: 0.25 + 0.75 * min(v, 127) / 127
    for k, ns in pitched.items():
        polys = [[(X(s), p - 0.42), (X(s + l), p - 0.42), (X(s + l), p + 0.42), (X(s), p + 0.42)] for p, s, l, v in ns]
        fc = [to_rgba(col[k], alpha(v)) for p, s, l, v in ns]
        ax.add_collection(PolyCollection(polys, facecolors=fc, edgecolors=INK if k == lead else to_rgba(col[k], 0.9),
                                         linewidths=1.3 if k == lead else 0.4, zorder=5 if k == lead else 2))
        ax.plot([], [], color=col[k], lw=8, label=f'{k} ({len(ns)})')
    title = f'{os.path.basename(a.piece)}  piano roll, {d["bpm"]} BPM (opacity = velocity)'
    if a.lead and not lead: print(f'lead {a.lead} not among the pitched instruments: {", ".join(pitched)}', file=sys.stderr)
    if lead:
        # Register clash: another part's top note above the lead's top note while the lead sounds (16th grid).
        q = 0.25
        steps = int(np.ceil(end * beats / q)) + 4
        lt = top_line(insts[lead]['notes'], steps, q)
        segs, report = [], []
        for k in pitched:
            if k == lead: continue
            ot = top_line(insts[k]['notes'], steps, q)
            hit = (ot > lt) & (lt >= 0)
            hit[:int((b0 - 1) * beats / q)] = False; hit[int((b1 - 1) * beats / q):] = False  # count the view only
            if not hit.any(): continue
            report.append(f'{k} {hit.sum() * q / beats:.1f} bars')
            i = 0
            while i < steps:
                if hit[i]:
                    j = i
                    while j + 1 < steps and hit[j + 1] and ot[j + 1] == ot[i]: j += 1
                    segs.append([(X(i * q), ot[i] + 0.65), (X((j + 1) * q), ot[i] + 0.65)])
                    i = j + 1
                else: i += 1
        ax.add_collection(LineCollection(segs, colors=ACC, linewidths=3.5, zorder=6))
        ax.plot([], [], color=ACC, lw=4, label=f'above {lead}')
        title += f'\nLead {lead} outlined in black. Red bars: another part above it while it plays: ' + (', '.join(report) if report else 'none')
    ax.set_ylim(lo, hi)
    ax.set_yticks([m for m in range(lo, hi + 1) if m % 12 == 0], [note_name(m) for m in range(lo, hi + 1) if m % 12 == 0])
    ax.set_yticks([m for m in range(lo, hi + 1) if m % 12 in (5, 7)], minor=True)
    ax.grid(axis='y', which='major', color='#999999', lw=1.0)
    ax.grid(axis='y', which='minor', color='#e5e5e5', lw=0.6)
    ax.set_title(title)
    ax.legend(loc='upper left', bbox_to_anchor=(1.0, 1.0))
    axes = [r[0] for r in axs]
    if rows:
        ax2 = axs[1, 0]
        ri = {r: i for i, r in enumerate(rows)}
        for k, ns in perc.items():
            polys = [[(X(s), ri[(k, p)] - 0.35), (X(s + max(l, 0.12)), ri[(k, p)] - 0.35), (X(s + max(l, 0.12)), ri[(k, p)] + 0.35),
                      (X(s), ri[(k, p)] + 0.35)] for p, s, l, v in ns]
            ax2.add_collection(PolyCollection(polys, facecolors=[to_rgba(col[k], alpha(v)) for *_, v in ns], linewidths=0))
        ax2.set_ylim(-0.6, len(rows) - 0.4)
        ax2.set_yticks(range(len(rows)), [f'{k} {key}' for k, key in rows], fontsize=11)
        ax2.set_xlabel('bar')
    else:
        ax.set_xlabel('bar')
    for x in axes:
        bar_ticks(x, int(b1 - b0), every=1 if b1 - b0 <= 16 else 4 if b1 - b0 <= 64 else 8, first=int(b0))
        x.set_xlim(b0, b1)
    for x in axes[:-1]: x.tick_params(axis='x', labelbottom=False)
    draw_sections(axes, {k: v for k, v in sections.items() if b0 <= v[0] < b1}, names_on=None)
    for name, (s, e) in sections.items():
        if b0 <= s < b1: ax.text(s + 0.2, hi - 0.3, name, fontsize=14, fontweight='bold', va='top', color=INK, zorder=8,
                                 bbox=dict(fc='white', ec='none', alpha=0.8, pad=1))
    fig.savefig(a.out, dpi=a.dpi, bbox_inches='tight')
    print(a.out)


# --- compare -----------------------------------------------------------------------------------------
def cmd_compare(a):
    labels = a.labels.split(',') if a.labels else [os.path.basename(p).rsplit('.', 1)[0] for p in (a.a, a.b)]
    bpms = [float(v) for v in a.bpm.split(',')] if a.bpm else []
    if len(bpms) == 1: bpms *= 2
    cols = [ACC2, ACC]
    fig, axs = plt.subplots(3, 1, figsize=(20, 17), gridspec_kw={'height_ratios': [3.4, 3, 1.8], 'hspace': 0.45})
    lines, levels = [], []
    for i, (p, lab) in enumerate(zip((a.a, a.b), labels)):
        x, sr = load(p)
        mono = x.mean(1)
        unit = int(sr * 60 / bpms[i] * a.beats) if bpms else 2 * sr  # a bar, or 2 s blocks without tempo
        integ, st_t, st = loudness(x, sr)
        bands = octave_bands(mono, sr)
        rms, w = per_bar(mono, unit), width(x, unit)
        levels += list(rms) + list(st)
        wid = db(np.sqrt(np.mean(((x[:, 0] - x[:, 1]) / 2) ** 2))) - db(np.sqrt(np.mean(mono ** 2)))
        crest = db(np.abs(mono).max()) - db(np.sqrt(np.mean(mono ** 2)))
        lines.append(f'{lab}: {integ:.1f} LUFS, crest {crest:.1f} dB, width {wid:.1f} dB, {len(mono) / sr:.0f} s')
        xs = np.arange(len(BANDS))
        axs[0].plot(xs, bands, color=cols[i], lw=3, marker='o', ls='-' if i == 0 else '--', label=lab)
        for j, v in enumerate(bands):
            axs[0].text(j + (-0.12 if i == 0 else 0.12), v + (2 if i == 0 else -3.5), f'{v:+.0f}', ha='center', color=cols[i], fontsize=13, fontweight='bold')
        pos = np.arange(1, len(rms) + 1)
        xr = pos if bpms else (pos - 1) * 2
        axs[1].step(np.append(xr, xr[-1] + (1 if bpms else 2)), np.append(rms, rms[-1]), where='post', color=cols[i], lw=1.2, alpha=0.6)
        axs[1].plot(1 + st_t * sr / unit if bpms else st_t, st, color=cols[i], lw=2.5, label=f'{lab} short-term LUFS (steps: RMS per {"bar" if bpms else "2 s"})')
        axs[1].axhline(integ, color=cols[i], lw=1, ls=':')
        axs[2].step(np.append(xr, xr[-1] + (1 if bpms else 2)), np.append(w, w[-1]), where='post', color=cols[i], lw=2, label=lab)
    for b, (l, h) in TARGET.items():
        axs[0].add_patch(plt.Rectangle((BANDS.index(b) - 0.3, l), 0.6, h - l, color='#2e8b57', alpha=0.25, lw=0))
    axs[0].plot([], [], color='#2e8b57', alpha=0.4, lw=8, label='RULES §5 target')
    axs[0].set_xticks(np.arange(len(BANDS)), [f'{b // 1000}k' if b >= 1000 else str(b) for b in BANDS])
    axs[0].set_ylabel('dB re 1 kHz'); axs[0].set_xlabel('octave band, Hz'); axs[0].grid(axis='y', color=GRID)
    axs[0].set_title('Octave bands, whole mix'); axs[0].legend(loc='lower left')
    axs[1].set_title('Loudness over time'); axs[1].set_ylabel('dB'); axs[1].legend(loc='lower center')
    axs[2].set_title('Stereo width, side/mid dB (higher = wider)'); axs[2].set_ylabel('dB'); axs[2].legend(loc='lower right')
    axs[1].set_ylim(np.percentile(levels, 10) - 14, max(levels) + 3)
    for ax in axs[1:]:
        ax.set_xlabel('bar' if bpms else 'seconds'); ax.grid(axis='x', color=GRID)
        ax.set_xlim(left=1 if bpms else 0)
    headline(fig, '\n'.join(lines), lines=2)
    fig.savefig(a.out, dpi=a.dpi, bbox_inches='tight')
    print(a.out)


def main():
    p = argparse.ArgumentParser(description=__doc__.split('\n')[0])
    sub = p.add_subparsers(dest='cmd', required=True)
    def common(sp, bpm=True):
        sp.add_argument('out')
        if bpm: sp.add_argument('--bpm', type=float, required=True)
        sp.add_argument('--beats', type=float, default=4)
        sp.add_argument('--sections', default='')
        sp.add_argument('--dpi', type=int, default=80)
    s = sub.add_parser('mix'); common(s); s.add_argument('wav'); s.add_argument('--ref')
    s = sub.add_parser('stems'); common(s); s.add_argument('pairs', nargs='+', metavar='NAME=WAV')
    s = sub.add_parser('roll'); common(s, bpm=False); s.add_argument('piece'); s.add_argument('--lead')
    s.add_argument('--instruments'); s.add_argument('--bars')
    s = sub.add_parser('compare'); s.add_argument('out'); s.add_argument('a'); s.add_argument('b')
    s.add_argument('--labels'); s.add_argument('--bpm', help='one tempo, or one per file, to plot in bars')
    s.add_argument('--beats', type=float, default=4); s.add_argument('--dpi', type=int, default=80)
    a = p.parse_args()
    {'mix': cmd_mix, 'stems': cmd_stems, 'roll': cmd_roll, 'compare': cmd_compare}[a.cmd](a)


if __name__ == '__main__':
    main()
