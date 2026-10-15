"""Speech-to-singing: speaks each lyric line with ElevenLabs, then moves every syllable onto its note.

Usage: python -I -X utf8 tools/sing.py pieces/<song>.json

For each line: text-to-speech with character timestamps (tools/tts.py, cached) -> each syllable is cut
from the speech, its consonant onset kept as spoken and its vowel stretched to the note length, its
pitch set to the note (PSOLA via Praat, which keeps the voice's formants), with vibrato on long
notes -> placed on the beat. The vocal is then imported into the instrumental session, given EQ,
compression and the session's hall reverb, and bounced to out/<song>.wav.
"""
import json, os, re, subprocess, sys
import numpy as np, soundfile as sf
import parselmouth
from parselmouth.praat import call
from scipy.signal import resample_poly

sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
from tts import tts

ROOT = os.path.join(os.path.dirname(os.path.abspath(__file__)), '..')
CLI = 'C:/Program Files/SoundCraft/soundcraft-cli.exe'
SR = 44100
PC = {'C': 0, 'D': 2, 'E': 4, 'F': 5, 'G': 7, 'A': 9, 'B': 11}
NOT_LETTER = set(' ,.!?।')


def midi(n):
    m = re.fullmatch(r'([A-G])(#|b)?(-?\d)', n)
    return 12 * (int(m[3]) + 1) + PC[m[1]] + {'#': 1, 'b': -1}.get(m[2], 0)


def hz(m):
    return 440 * 2 ** ((m - 69) / 12)


def decode(mp3):
    wav = mp3[:-4] + '.wav'
    if not os.path.exists(wav):
        subprocess.run(['ffmpeg', '-loglevel', 'error', '-y', '-i', mp3, '-ac', '1', '-ar', str(SR), wav], check=True)
    x, _ = sf.read(wav)
    return x


def syllable_spans(sylls, al):
    """(start, end) seconds of each syllable's letters, from the per-character alignment."""
    chars, st, en = al['characters'], al['character_start_times_seconds'], al['character_end_times_seconds']
    text = ''.join(sylls)
    i = ''.join(chars).find(text)   # the request may carry a direction such as "[sings] " before the lyrics
    if i < 0:
        raise ValueError(f'alignment text differs:\n {"".join(chars)!r}\n {text!r}')
    spans = []
    for s in sylls:
        idx = [j for j in range(i, i + len(s)) if chars[j] not in NOT_LETTER]
        spans.append((st[idx[0]], en[idx[-1]]))
        i += len(s)
    return spans


def sing_syllable(seg, f0, T):
    """Seg (speech samples) -> T seconds sung at f0 Hz."""
    L = len(seg) / SR
    snd = parselmouth.Sound(seg, SR)
    manip = call(snd, 'To Manipulation', 0.01, 70, 600)
    o = min(0.35 * L, 0.06, 0.5 * T)            # consonant onset kept at spoken speed
    k = max(0.2, (T - o) / max(L - o, 1e-3))    # vowel stretch factor
    dt = call('Create DurationTier', 'd', 0, L)
    for t, v in [(0, 1), (o, 1), (o + 0.002, k), (L, k)]:
        call(dt, 'Add point', t, v)
    pt = call('Create PitchTier', 'p', 0, L)
    steps = max(2, int(T / 0.015))
    for n in range(steps + 1):
        u = T * n / steps                        # output time
        orig = u if u <= o else o + (u - o) / k  # matching time in the spoken syllable
        cents = 0.0
        if T > 0.6 and u > 0.3:                  # vibrato fades in on long notes
            cents = min(1, (u - 0.3) / 0.4) * 28 * np.sin(2 * np.pi * 5.4 * (u - 0.3))
        if u < 0.05 and T > 0.25:                # tiny scoop up into the note
            cents -= 40 * (1 - u / 0.05)
        call(pt, 'Add point', min(orig, L), f0 * 2 ** (cents / 1200))
    call([manip, pt], 'Replace pitch tier')
    call([manip, dt], 'Replace duration tier')
    out = call(manip, 'Get resynthesis (overlap-add)').values[0]
    out = out[:int(T * SR)]
    n_in, n_out = int(0.006 * SR), min(int(0.05 * SR), len(out) // 3)
    out[:n_in] *= np.linspace(0, 1, n_in)
    out[-n_out:] *= np.linspace(1, 0, n_out) ** 0.5
    return out


def sing_line(speech, spans, notes, onset=0.08, max_hold=None, glide=0.04, vibrato=28):
    """Warps a whole spoken line onto notes in one pass, so consonants and transitions stay intact.

    spans: (start, end) of each syllable's letters in the speech; notes: (f0 Hz, seconds) per syllable.
    Each syllable keeps its first `onset` seconds at spoken speed (the consonant and the move into the
    vowel); the rest is stretched to fill the note. The pause after a syllable is squeezed out.
    max_hold caps how long a vowel is held (seconds): longer notes are sung shorter, then silence.
    Returns (audio, seconds of audio before the first syllable starts).
    """
    pre = 0.03
    a = max(0.0, spans[0][0] - pre)
    seg = speech[int(a * SR):int((spans[-1][1] + 0.08) * SR)]
    L = len(seg) / SR
    rel = [(s - a, e - a) for s, e in spans]
    dt = call('Create DurationTier', 'd', 0, L)
    pt = call('Create PitchTier', 'p', 0, L)
    pts = [(0.0, 1.0)]
    holds = []
    for i, ((s, e), (f0, T)) in enumerate(zip(rel, notes)):
        nxt = rel[i + 1][0] if i + 1 < len(rel) else L
        e = max(e, s + 0.06)
        o = min(onset, 0.5 * (e - s))
        hold = T if max_hold is None else min(T, max_hold)
        k = max(0.3, (hold - o) / max(e - s - o, 0.01))
        gap = max(nxt - e, 0.001)
        kg = max(0.01, (T - hold + 0.005) / gap)   # what's left of the note after the hold, as silence/squeezed gap
        pts += [(s + 0.0005, 1.0), (s + o, 1.0), (s + o + 0.0005, k), (e, k), (e + 0.0005, kg), (nxt - 0.0005, kg)]
        holds.append((s, o, e, k, hold, f0))
    for t, v in pts:
        if 0 <= t <= L:
            call(dt, 'Add point', t, v)
    for i, (s, o, e, k, hold, f0) in enumerate(holds):
        steps = max(2, int(hold / 0.02))
        for n in range(steps + 1):
            u = hold * n / steps
            orig = s + (u if u <= o else o + (u - o) / k)
            cents = 0.0
            if hold > 0.6 and u > 0.3:
                cents = min(1, (u - 0.3) / 0.4) * vibrato * np.sin(2 * np.pi * 5.4 * (u - 0.3))
            if n == 0 and glide:
                orig = s + 0.0005                      # pitch moves to the new note across the syllable boundary
            call(pt, 'Add point', min(orig, L), f0 * 2 ** (cents / 1200))
    manip = call(parselmouth.Sound(seg, SR), 'To Manipulation', 0.01, 70, 600)
    call([manip, pt], 'Replace pitch tier')
    call([manip, dt], 'Replace duration tier')
    out = call(manip, 'Get resynthesis (overlap-add)').values[0]
    return out, rel[0][0]


def main():
    song_path = sys.argv[1]
    name = os.path.splitext(os.path.basename(song_path))[0]
    song = json.load(open(song_path, encoding='utf8'))
    beat = 60 / song['bpm']
    bar = 4 * beat
    voice = np.zeros(int(SR * 300))
    end = 0
    for part, at in song['form']:
        for line in song['parts'][part]:
            sylls = [s for b in line['bars'] for s, _, _ in b]
            text = ''.join(sylls).strip()
            mp3, al = tts(text, prefix=song.get('tts_prefix', ''))
            speech = decode(mp3)
            spans = syllable_spans(sylls[:-1] + [sylls[-1].rstrip()], al)
            k = 0
            for bi, b in enumerate(line['bars']):
                pos = 0
                for s, note, beats in b:
                    s0, s1 = spans[k]
                    s1 = max(s1, s0 + 0.1)  # pitch analysis needs ~3 periods; very short syllables borrow from what follows
                    seg = speech[max(0, int((s0 - 0.015) * SR)):int((s1 + 0.02) * SR)]
                    T = beats * beat - 0.02
                    sung = sing_syllable(seg, hz(midi(note) + song['octave_shift']), T)
                    t = (at + line['bar'] - 2 + bi) * bar + pos * beat
                    i = int(t * SR)
                    voice[i:i + len(sung)] += sung
                    end = max(end, i + len(sung))
                    pos += beats
                    k += 1
            print(f'{part} bar {at + line["bar"] - 1}: {text}')
    voice = voice[:end + SR]
    voice = resample_poly(voice, 160, 147)                     # 44.1 -> 48 kHz, the session rate
    voice *= 10 ** (-12 / 20) / (np.abs(voice).max() + 1e-9)   # peak at -12 dBFS before the mix
    os.makedirs(os.path.join(ROOT, 'work'), exist_ok=True)
    vpath = os.path.abspath(os.path.join(ROOT, 'work', f'{name}.vocal.wav')).replace('\\', '/')
    sf.write(vpath, voice, 48000, subtype='PCM_24')

    eq = lambda t, f, g=0, q=0.7: {'plugin': 'eq_1band', 'params': {'type': t, 'freq': f, 'gain': g, 'q': q}}
    cmds = [
        ('track.new', {'kind': 'audio', 'name': 'Vocal', 'format': 'mono'}),
        ('file.import_audio', {'path': vpath, 'track': 'Vocal', 'new_tracks': False, 'at': '1|1|000'}),
        ('mix.insert', {'track': 'Vocal', 'slot': 0, **eq(3, 90)}),
        ('mix.insert', {'track': 'Vocal', 'slot': 1, **eq(0, 300, -2.5, 1)}),
        ('mix.insert', {'track': 'Vocal', 'slot': 2, **eq(2, 4000, 3)}),
        ('mix.insert', {'track': 'Vocal', 'slot': 3, 'plugin': 'compressor', 'params': {'threshold': -24, 'ratio': 3, 'attack': 10, 'release': 120, 'makeup': 4}}),
        ('mix.send', {'track': 'Vocal', 'slot': 0, 'bus': 'Hall bus', 'level_db': song.get('vocal_reverb_db', -8)}),
        ('mix.volume', {'tracks': ['Vocal'], 'db': song.get('vocal_db', 6)}),
    ] + [('mix.volume', {'tracks': [t], 'db': db}) for t, db in song.get('instrument_db', {}).items()]
    script = os.path.join(ROOT, 'work', f'{name}.mix.txt')
    with open(script, 'w', encoding='utf8') as f:
        f.write('\n'.join(f'{c} {json.dumps(a, ensure_ascii=False)}' for c, a in cmds) + '\n')
    r = subprocess.run([CLI, 'script', script, '--in', os.path.join(ROOT, song['instrumental']),
                        '--save', os.path.join(ROOT, 'out', f'{name}.scraft'), '--bounce', os.path.join(ROOT, 'out', f'{name}.wav')],
                       capture_output=True, text=True, encoding='utf8')
    print(r.stdout[-600:], r.stderr[-600:])


if __name__ == '__main__':
    main()
