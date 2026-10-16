"""Side-by-side summary of reference profiles (tools/analyze.py), to turn several references into one brief.

Usage: python -I tools/profiles.py refs/a.profile.json refs/b.profile.json …
"""
import json, os, sys


def main():
    ps = [(os.path.basename(p).replace('.profile.json', ''), json.load(open(p, encoding='utf-8'))) for p in sys.argv[1:]]
    w = max(14, *(len(n) for n, _ in ps))
    row = lambda label, f: print(f'{label:18s}' + ''.join(f'{str(f(p)):>{w + 2}s}' for _, p in ps))
    print(f'{"":18s}' + ''.join(f'{n:>{w + 2}s}' for n, _ in ps))
    row('BPM', lambda p: p['bpm'])
    row('key', lambda p: f'{p["key"]["tonic"]} {p["key"]["mode"]}')
    row('diatonic %', lambda p: p['key']['diatonic_pct'])
    row('bars / minutes', lambda p: f'{p["bars"]} / {p["seconds"] / 60:.1f}')
    row('LUFS / true peak', lambda p: f'{p["loudness"]["lufs"]} / {p["loudness"]["true_peak_db"]}')
    row('crest / width dB', lambda p: f'{p["mix"]["crest_db"]} / {p["mix"]["width_db"]}')
    for b in ('63', '125', '250', '500', '2000', '4000', '8000', '16000'):
        row(f'{b} Hz re 1k', lambda p: p['mix']['bands'][b])
    row('form', lambda p: ' '.join(f'{s["label"]}{s["bars"][1] - s["bars"][0] + 1}' for s in p['form'])[:w])
    row('section LUFS span', lambda p: f'{min(s["mix"]["lufs"] for s in p["form"]):.0f}..{max(s["mix"]["lufs"] for s in p["form"]):.0f}')
    print('Top progressions:')
    for n, p in ps:
        print(f'  {n:{w}s} ' + ' | '.join('-'.join(x['roman']) + f' x{x["count"]}' for x in p['progressions'][:3]))
    print('Kick / snare / hat grid in the longest section:')
    for n, p in ps:
        s = max(p['form'], key=lambda s: s['bars'][1] - s['bars'][0])
        print(f'  {n:{w}s} {s["label"]}: ' + '  '.join(f'{k}:{v[0]}' for k, v in s['drums'].items()))
    if any('lines' in p for _, p in ps):
        print('Lines (range, steps/leaps %, notes per bar, phrase notes, on-beat %):')
        for n, p in ps:
            for line, st in p.get('lines', {}).items():
                print(f'  {n:{w}s} {line:7s} {st["range"][0]}-{st["range"][1]} median {st["median"]:4s} '
                      f'{st["steps_pct"]:3d}/{st["leaps_pct"]:<3d} {st["notes_per_bar"]:5.1f} {st["phrase_notes"]:5.1f} {st["onset_in_beat_pct"]["on"]:4d}')


if __name__ == '__main__':
    main()
