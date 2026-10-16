"""Masters a render to match a reference track's loudness, tonal balance, peak and width (Matchering 2.0).

Usage: python -I tools/master.py out/<name>.wav REF.wav|mp3 [out/<name>.master.wav]

Use a reference in the same genre and arrangement density: Matchering copies the reference's average
spectrum, so a sparse piano piece mastered to a full band will be pushed bright and loud. Re-measure the
result (python -I tools/measure.py … --ref refs/<ref>.profile.json) and listen before keeping it.
"""
import os, sys
import matchering as mg


def main():
    target, ref = sys.argv[1], sys.argv[2]
    out = sys.argv[3] if len(sys.argv) > 3 else os.path.splitext(target)[0] + '.master.wav'
    mg.log(print)
    mg.process(target=target, reference=ref, results=[mg.pcm24(out)])
    print(f'wrote {out}')


if __name__ == '__main__':
    main()
