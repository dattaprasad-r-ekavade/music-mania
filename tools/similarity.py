"""Copying guard: how close are a piece's melodic lines to reference melodies?

Usage: python -I tools/similarity.py pieces/<name>.mjs REF.mid [REF.mid …]
       (reference MIDI: refs/<name>/*.mid from tools/analyze.py --stems, or any MIDI file)

Each line (one per instrument, reduced to its top voice) becomes a sequence of pitch intervals and
inter-onset-time ratios, so transposition and tempo don't hide a copy. Reported per line and reference:
  - longest run of identical intervals (pitch only), and of identical intervals with the same rhythm;
  - share of our 6-interval patterns that also occur in the reference (pitch + rhythm).
Patterns with fewer than 3 different intervals (scale runs, repeated notes) are ignored: everyone uses those.

Flags a line when the pitch+rhythm run reaches 8 intervals (9 notes) or the shared-pattern share passes 10%.
These are review prompts, not legal judgements: there is no objective threshold for plagiarism.
"""
import json, os, subprocess, sys
import numpy as np

ROOT = os.path.join(os.path.dirname(os.path.abspath(__file__)), '..')
N = 6


def skyline(notes, eps=0.05):
    """Top voice: at each onset (within eps) keep the highest pitch. notes: [(start, pitch)] in any time unit."""
    out = []
    for s, p in sorted(notes):
        if out and s - out[-1][0] < eps:
            if p > out[-1][1]: out[-1] = (s, p)
        else: out.append((s, p))
    return out


def encode(line):
    """[(interval, rhythm class)]: rhythm class = log2 ratio of successive inter-onset intervals, rounded."""
    s = np.array([x[0] for x in line]); p = np.array([x[1] for x in line])
    ioi = np.diff(s)
    iv = np.diff(p).astype(int)
    r = np.zeros(len(iv), int)
    r[1:] = np.clip(np.round(np.log2((ioi[1:] + 1e-6) / (ioi[:-1] + 1e-6))), -2, 2)
    return list(zip(iv.tolist(), r.tolist()))


def longest_run(a, b):
    """Longest common contiguous run (dynamic programming over two sequences)."""
    best, prev = 0, [0] * (len(b) + 1)
    for x in a:
        cur = [0] * (len(b) + 1)
        for j, y in enumerate(b, 1):
            if x == y:
                cur[j] = prev[j - 1] + 1
                best = max(best, cur[j])
        prev = cur
    return best


def grams(seq):
    return {tuple(seq[i:i + N]) for i in range(len(seq) - N + 1) if len({g[0] for g in seq[i:i + N]}) >= 3}


def piece_lines(path):
    js = subprocess.run(['node', os.path.join(ROOT, 'tools', 'notes.mjs'), path], capture_output=True, text=True, check=True, shell=os.name == 'nt').stdout
    d = json.loads(js)
    sec = 60 / d['bpm']
    return {name: skyline([(n[1] * sec, n[0]) for n in inst['notes']]) for name, inst in d['instruments'].items()
            if not inst['percussive'] and len(inst['notes']) > N + 1}


def midi_line(path):
    import pretty_midi
    m = pretty_midi.PrettyMIDI(path)
    return skyline([(n.start, n.pitch) for i in m.instruments if not i.is_drum for n in i.notes])


def main():
    piece, refs = sys.argv[1], sys.argv[2:]
    lines = piece_lines(piece)
    ref_lines = {os.path.relpath(r, ROOT): encode(midi_line(r)) for r in refs}
    print(f'{"line":12s} {"reference":36s} {"pitch run":>9s} {"+rhythm":>8s} {"shared 6-grams":>15s}')
    flagged = 0
    for name, line in lines.items():
        ours = encode(line)
        g = grams(ours)
        for rname, theirs in ref_lines.items():
            pitch_run = longest_run([x[0] for x in ours], [x[0] for x in theirs])
            full_run = longest_run(ours, theirs)
            shared = len(g & grams(theirs)) / max(1, len(g)) * 100
            flag = full_run >= 8 or shared > 10
            flagged += flag
            print(f'{name:12s} {rname:36s} {pitch_run:9d} {full_run:8d} {shared:14.1f}%' + ('  <-- review' if flag else ''))
    print(f'{flagged} line/reference pairs to review' if flagged else 'No line comes close to a reference.')
    sys.exit(1 if flagged else 0)


if __name__ == '__main__':
    main()
