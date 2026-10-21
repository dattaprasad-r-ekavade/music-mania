"""Owner A/B preference log: the data that teaches the pipeline what the owner likes.

  python -I tools/feedback.py snapshot <name>          before changing a piece: keep out/<name>.wav as work/ab/<name>.A.wav
  python -I tools/feedback.py pair <name>              after re-rendering: out/<name>.wav becomes B; writes A/B MP3s to listen to
  python -I tools/feedback.py log <name> A|B|same ["note"]   record the owner's choice with both sides' measurements
  python -I tools/feedback.py report                   how often each metric agrees with the owner's choices

Entries go to feedback/feedback.jsonl (committed: small, and it is the owner's taste). Each entry stores, for A and B:
Audiobox aesthetics (tools/aesthetics.py), LUFS, crest, width, octave bands re 1 kHz, and CLAP similarity to the
references when embeddings are available. `report` shows, per metric, how often the chosen side scored higher
(50 % = no better than chance). After 20-50 choices, keep the metrics that predict the owner and drop the rest.
"""
import json, os, shutil, subprocess, sys, datetime
import numpy as np, soundfile as sf

ROOT = os.path.join(os.path.dirname(os.path.abspath(__file__)), '..')
sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
AB = os.path.join(ROOT, 'work', 'ab')
LOG = os.path.join(ROOT, 'feedback', 'feedback.jsonl')


def metrics(path):
    from analyze import mix_profile, lufs
    from aesthetics import score
    x, sr = sf.read(path, dtype='float32', always_2d=True)
    if sr != 48000:
        from scipy.signal import resample_poly
        x = resample_poly(x, 48000, sr, axis=0).astype('float32'); sr = 48000
    mp = mix_profile(x.astype('float64'), sr)
    m = {'lufs': round(lufs(x.astype('float64'), sr), 2), 'crest_db': mp['crest_db'], 'width_db': mp['width_db'],
         **{f'band_{b}': v for b, v in mp['bands'].items() if b != '1000'}, **{f'aes_{k}': v for k, v in score(x, sr).items()}}
    return m


def main():
    cmd, *a = sys.argv[1:] or ['help']
    os.makedirs(AB, exist_ok=True)
    if cmd == 'snapshot':
        shutil.copy(os.path.join(ROOT, 'out', f'{a[0]}.wav'), os.path.join(AB, f'{a[0]}.A.wav'))
        print(f'kept out/{a[0]}.wav as work/ab/{a[0]}.A.wav; change the piece, re-render, then: feedback.py pair {a[0]}')
    elif cmd == 'pair':
        shutil.copy(os.path.join(ROOT, 'out', f'{a[0]}.wav'), os.path.join(AB, f'{a[0]}.B.wav'))
        for s in 'AB':
            subprocess.run(['ffmpeg', '-loglevel', 'error', '-y', '-i', os.path.join(AB, f'{a[0]}.{s}.wav'), '-b:a', '256k', os.path.join(AB, f'{a[0]}.{s}.mp3')], check=True)
        print(f'listen: work/ab/{a[0]}.A.mp3 (before) and work/ab/{a[0]}.B.mp3 (after); then: feedback.py log {a[0]} A|B|same "note"')
    elif cmd == 'log':
        name, pick, note = a[0], a[1].upper(), (a[2] if len(a) > 2 else '')
        entry = {'date': datetime.date.today().isoformat(), 'piece': name, 'pick': pick, 'note': note,
                 'A': metrics(os.path.join(AB, f'{name}.A.wav')), 'B': metrics(os.path.join(AB, f'{name}.B.wav'))}
        os.makedirs(os.path.dirname(LOG), exist_ok=True)
        with open(LOG, 'a', encoding='utf-8') as f:
            f.write(json.dumps(entry) + '\n')
        print(f'logged {name}: {pick} ({note})')
        for k in entry['A']:
            print(f'  {k:12s} A {entry["A"][k]:8.2f}  B {entry["B"][k]:8.2f}')
    elif cmd == 'report':
        rows = [json.loads(l) for l in open(LOG, encoding='utf-8')] if os.path.exists(LOG) else []
        rows = [r for r in rows if r['pick'] in 'AB']
        if not rows:
            print('no A/B choices logged yet'); return
        print(f'{len(rows)} choices. Per metric: % of choices where the chosen side was higher (50 % = chance).')
        for k in rows[0]['A']:
            agree = [(r[r['pick']][k] > r['AB'.replace(r['pick'], '')][k]) for r in rows if r['A'][k] != r['B'][k]]
            if agree:
                print(f'  {k:12s} {100 * np.mean(agree):5.0f} %  over {len(agree)}')
    else:
        print(__doc__)


if __name__ == '__main__':
    main()
