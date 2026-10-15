"""Intelligibility check: transcribe audio with Whisper (local, faster-whisper) and score it against the lyrics.

Usage: python -I -X utf8 tools/stt.py FILE.wav "expected text" [start_s end_s]
Prints the transcript and the character error rate (CER; 0 = every letter recovered, 1 = nothing).
"""
import os, re, subprocess, sys

STRIP = re.compile(r'[\s,.!?।"\'-]')


def cer(ref, hyp):
    a, b = STRIP.sub('', ref), STRIP.sub('', hyp)
    d = list(range(len(b) + 1))
    for i, ca in enumerate(a, 1):
        prev, d[0] = d[0], i
        for j, cb in enumerate(b, 1):
            prev, d[j] = d[j], min(d[j] + 1, d[j - 1] + 1, prev + (ca != cb))
    return d[len(b)] / max(1, len(a))


_model = None


def transcribe(path, start=None, end=None):
    """Hindi transcript of path (optionally a time slice). Runs locally; the model downloads once."""
    global _model
    from faster_whisper import WhisperModel
    import numpy as np
    if _model is None:
        _model = WhisperModel('medium', device='cpu', compute_type='int8')
    args = ['ffmpeg', '-loglevel', 'error', '-y', '-i', path] + (['-ss', str(start), '-to', str(end)] if start is not None else []) + ['-ac', '1', '-ar', '16000', '-f', 'f32le', '-']
    audio = np.frombuffer(subprocess.run(args, capture_output=True, check=True).stdout, dtype=np.float32)
    segs, _ = _model.transcribe(audio, language='hi', beam_size=5, vad_filter=False)
    return ' '.join(x.text.strip() for x in segs)


if __name__ == '__main__':
    path, ref = sys.argv[1], sys.argv[2]
    se = (float(sys.argv[3]), float(sys.argv[4])) if len(sys.argv) > 4 else (None, None)
    hyp = transcribe(path, *se)
    print(f'heard: {hyp}\nCER:   {cer(ref, hyp):.2f}')
