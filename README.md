# Music Mania

Sampled background music (piano, strings, woodwinds, harp) composed as code and rendered with SoundCraft. Aimed at royalty-free background music for venues, study and sleep channels, and themed collections.

**Before you change a track, read [RULES.md](RULES.md)** — SoundCraft facts we measured, mix targets, and the review-driven rules from Golden Hour and Duniya Gol Hai. SoundCraft basics and the earlier synth title-theme notes: [music.md](music.md). Credits and origins: [CREDITS.md](CREDITS.md).

Repo: https://github.com/dattaprasad-r-ekavade/music-mania

## Layout

| Path | What |
| --- | --- |
| `samples/` | Sample libraries (downloaded, not committed — see [samples/README.md](samples/README.md)) and `zones.json` |
| `tools/zones.py` | Builds `samples/zones.json`: every sample zone with its true root note and tuning |
| `tools/lib/session.mjs` | Turns notes on named instruments into a SoundCraft script |
| `tools/render.mjs` | Renders a piece, checks it, measures it (`--stems` adds per-instrument levels) |
| `tools/measure.py` | The measurements that stand in for listening |
| `tools/tts.py`, `tools/sing.py`, `tools/stt.py` | ElevenLabs speech (cached in `work/tts/`, each line paid once) turned into singing on a melody, mixed into an instrumental, then scored for intelligibility |
| `pieces/*.mjs` | Instrumentals. Every musical decision lives here |
| `pieces/*.json` | Songs (lyrics + melody + mix offsets on top of an instrumental) |
| `work/` | Generated scripts, stems, TTS (disposable, not committed) |
| `out/` | Renders: `.wav` and `.mp3` are in git; `.scraft` sessions stay local |

## Setup

1. Clone this repo. Copy `.env.example` to `.env` and fill in ElevenLabs keys if you will sing.
2. Install [SoundCraft](https://github.com/storytold/soundcraft/releases) 0.7.0 (Windows). The CLI is `C:\Program Files\SoundCraft\soundcraft-cli.exe`.
3. Python 3 with `pip install -r requirements.txt`. Node.js for `tools/render.mjs`. `ffmpeg` on PATH for MP3s and TTS decode.
4. Download the sample libraries into `samples/` ([samples/README.md](samples/README.md)), then `python -I tools/zones.py` if you change them.

## Making a piece

```
python -I tools/zones.py                           # once, or after adding samples
node tools/render.mjs pieces/golden-hour.mjs --stems
ffmpeg -i out/golden-hour.wav -b:a 256k out/golden-hour.mp3
python -I -X utf8 tools/sing.py pieces/duniya-gol-hai.json
```

Checks after every render: per-section stem levels (a lead should sit 2–3 dB above its accompaniment, pads 6–8 dB below), octave-band balance (about +3 dB at 125 Hz and −8 to −12 dB at 4 kHz relative to 1 kHz), clicks, jumps and drops, and a silent tail. Then a person listens. Measurements cannot judge whether it is beautiful or whether a melody resembles an existing song.

**Deliver only the WAV/MP3.** A `.scraft` session copies every raw sample it uses into `out/Audio Files/`, and VSCO asks that its samples not be redistributed or sold as samples.

## Pieces

| Piece | Length | State |
| --- | --- | --- |
| `golden-hour` | 4:31, 76 BPM, E♭ major | Prototype for a hotel-lobby collection: piano with strings, flute, harp. −16.6 LUFS, peak −1.0 dB. Owner review 1 (2026-10-15): moving overall, but the strings' entry (bar 21) wasn't smooth. Fixed with a staged entry (cello swell from bar 20, violas from bar 23, first harp sweep at bar 25) and per-sample level evening; other sections kept within 0.5 dB of the reviewed version |
| `duniya-gol-hai` | 4:31 song | Absurdist Hindi satire sung by the owner's ElevenLabs voice over Golden Hour (verses on A, chorus on B, verse 1 reprise, outro). 95% of syllables within 50 cents of their note; vocal 3–7 dB over the band. Awaiting a listening review |
| `smoke` | 4 bars | Pipeline smoke test, not a release |
