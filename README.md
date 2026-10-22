# Music Mania

Sampled background music (piano, strings, woodwinds, harp) composed as code and rendered with SoundCraft. Aimed at royalty-free background music for venues, study and sleep channels, and themed collections.

**Before you change a track, read [RULES.md](RULES.md)** — SoundCraft facts we measured, mix targets, and the review-driven rules from Golden Hour and Duniya Gol Hai. SoundCraft basics and the earlier synth title-theme notes: [music.md](music.md). Credits and origins: [CREDITS.md](CREDITS.md).

Repo: https://github.com/dattaprasad-r-ekavade/music-mania

## Layout

| Path | What |
| --- | --- |
| `samples/` | Sample libraries (downloaded, not committed — see [samples/README.md](samples/README.md)) and `zones.json` |
| `tools/zones.py` | Builds `samples/zones.json`: every sample zone with its true root note and tuning |
| `tools/lib/session.mjs` | Turns notes on named instruments into a SoundCraft script (sample zones with round robins, percussion kit keys, or built-in synths) |
| `tools/lib/music.mjs` | Shared composition helpers: chord symbols, voice-leading, melodies with grace notes, drum-pattern strings, scales |
| `tools/render.mjs` | Renders a piece, checks it, measures it (`--stems` adds per-instrument levels) |
| `tools/measure.py` | The measurements that stand in for listening |
| `tools/tts.py`, `tools/sing.py`, `tools/stt.py` | ElevenLabs speech (cached in `work/tts/`, each line paid once) turned into singing on a melody, mixed into an instrumental, then scored for intelligibility |
| `tools/analyze.py` | Learns a reference track's tempo, bars, key, chords, form, drum grids and mix profile into `refs/<name>.profile.json`; `--stems` adds Demucs separation, Basic Pitch MIDI and melody statistics |
| `tools/similarity.py`, `tools/notes.mjs` | Copying guard: a piece's lines against reference MIDI (interval + rhythm runs, shared 6-note patterns) |
| `tools/critique.mjs`, `tools/lib/theory.mjs` | Melody critique against measured targets (docs/theory-western.md) |
| `tools/lib/raga.mjs` | Raga, taal and ornament data and checks (docs/theory-indian.md) |
| `tools/lib/palette.mjs` | Western / futuristic instrument presets from Future Lab: electric violin chains, brass by size, braam, metallic percussion, synths |
| `tools/visualize.py` | PNGs the agent can look at: `mix` (spectrogram, loudness, bands per section, width), `stems`, `roll` (piano roll, register clashes with the lead), `compare`; `render.mjs --png` writes them to work/ |
| `tools/embed.py` | CLAP / MERT audio embeddings: similarity of a render to references, CLAP text-prompt descriptors |
| `docs/research-roadmap.md` | Research to build on: focus/productivity music, sfizz/DawDreamer/Pedalboard/Surge XT, convolution IRs, more sample libraries, suggested order |
| `video/` | YouTube videos: Remotion pixel-art loops (`src/scenes/*.js`) and `make.mjs` (loop → full-length MP4 with audio, thumbnail, upload text, R2) |
| `tools/aesthetics.py`, `tools/feedback.py` | Learned quality scores (Audiobox Aesthetics) and the owner A/B preference log that calibrates every metric |
| `CLAUDE.md` | Handoff for the next agent: environment quirks, storage, loop, state of the work |
| `tools/profiles.py` | Several reference profiles side by side (tempo, key, loudness, bands, form, grooves, line statistics) |
| `tools/master.py` | Matchering 2.0: master a render to a reference's loudness, balance, peak and width |
| `refs/` | Reference profiles (committed); reference audio, stems and MIDI stay out of git |
| `pieces/*.mjs` | Instrumentals. Every musical decision lives here |
| `pieces/*.json` | Songs (lyrics + melody + mix offsets on top of an instrumental) |
| `work/` | Generated scripts, stems, TTS (disposable, not committed) |
| `out/` | Renders (local, not in git). Released `.wav` and `.mp3` are kept in R2 under `out/`; `.scraft` sessions stay local |
| `tools/assets.mjs`, `tools/lib/r2.mjs` | Cloudflare R2 storage for sample libraries and renders: `status`, `mirror`, `push`, `pull`, `need`, `prune` |

## Setup

1. Clone this repo. Copy `.env.example` to `.env` and fill in ElevenLabs keys if you will sing.
2. Install [SoundCraft](https://github.com/storytold/soundcraft/releases) 0.7.0 (Windows). The CLI is `C:\Program Files\SoundCraft\soundcraft-cli.exe`.
3. Python 3 with `pip install -r requirements.txt`. Node.js for `tools/render.mjs`. `ffmpeg` on PATH for MP3s and TTS decode.
4. Add the R2 keys to `.env` (`R2_ENDPOINT`, `R2_ACCESS_KEY_ID`, `R2_SECRET_ACCESS_KEY`, `R2_BUCKET_NAME`). Samples download on demand: `render.mjs` fetches the files a piece uses from R2 into `samples/`. `node tools/assets.mjs pull out/` gets the released renders. See [samples/README.md](samples/README.md).

## Making a piece

```
python -I tools/zones.py                           # once, or after adding samples
node tools/render.mjs pieces/golden-hour.mjs --stems
ffmpeg -i out/golden-hour.wav -b:a 256k out/golden-hour.mp3
python -I -X utf8 tools/sing.py pieces/duniya-gol-hai.json
```

Checks after every render: per-section stem levels (a lead should sit 2–3 dB above its accompaniment, pads 6–8 dB below), octave-band balance (about +3 dB at 125 Hz and −8 to −12 dB at 4 kHz relative to 1 kHz), clicks, jumps and drops, and a silent tail. Then a person listens. Measurements cannot judge whether it is beautiful or whether a melody resembles an existing song.

**Deliver only the WAV/MP3.** A `.scraft` session copies every raw sample it uses into `out/Audio Files/`, and VSCO asks that its samples not be redistributed or sold as samples.

## Videos for YouTube

Lofi-style looping pixel-art scenes, one per piece, drawn in code (no image assets). Each scene is a 60 s seamless loop (all motion periodic in the loop), rendered once by Remotion and repeated by ffmpeg to the track length.

```
cd video && npm install            # once (~330 MB node_modules, gitignored)
node video/make.mjs golden-hour    # → out/<name>.video.mp4, .thumb.jpg, .youtube.txt, all pushed to R2
npx remotion studio src/index.js   # (in video/) preview and tweak scenes live
```

Scenes: `golden-hour` (riverside promenade at sunset, strollers, birds), `neon-bhairav` (cyberpunk Indian city: temple spires, neon, rain, flying cars), `pahadi-winter` (Himalayan ridge at dawn: hikers, prayer flags, fog, snow). Add a scene: a `draw(ctx, t, frame)` function on a 384x216 canvas in `video/src/scenes/`, registered in `scenes/index.js` and `make.mjs` `INFO`. Keep motion loop-safe: `osc(t, k)` with integer k, `wrap()` over whole periods, sprite cycles that divide 1800 frames. Golden Hour takes ~6.5 min to build. Remotion's free licence covers individuals and companies of up to 3 people, commercial videos included.

## Learning from references

```
pip install -r requirements-analysis.txt && pip install --no-deps basic-pitch
python -I tools/analyze.py REF.mp3 --name lobby-ref [--stems]      # refs/lobby-ref.profile.json
python -I tools/similarity.py pieces/<name>.mjs refs/lobby-ref/*.mid  # before release
python -I tools/master.py out/<name>.wav REF.mp3                     # optional reference master
```

A piece that returns `ref: 'refs/<name>.profile.json'` from its generator gets a mix comparison against it on every render. See RULES.md §4c for what to take from a reference and what never to take.

## Pieces

| Piece | Length | State |
| --- | --- | --- |
| `golden-hour` | 4:31, 76 BPM, E♭ major | Prototype for a hotel-lobby collection: piano with strings, flute, harp. −16.6 LUFS, peak −1.0 dB. Owner review 1 (2026-10-15): moving overall, but the strings' entry (bar 21) wasn't smooth. Fixed with a staged entry (cello swell from bar 20, violas from bar 23, first harp sweep at bar 25) and per-sample level evening; other sections kept within 0.5 dB of the reviewed version |
| `duniya-gol-hai` | 4:31 song | Absurdist Hindi satire, owner's ElevenLabs voice over Golden Hour (in C via `golden-hour-c`). Owner review 1: "extremely robotic, syllables unrecognisable" (syllable-chopping method, Whisper CER 0.38). Rebuilt as whole-line warping of a `[sings]` TTS take with the voice's own pitch contour kept and the band 3 semitones down: verse 1 CER 0.32 (raw ElevenLabs singing scores 0.11). Speech-to-singing onto a fixed melody has hit its ceiling |
| `mass-entry` | 3:15, 144 BPM, D Phrygian dominant | South Indian action theme: oboe as nadaswaram hook, brass stabs, string spiccato, thavil-style congas in 3-3-2, half-time horn Hero theme. −11.2 LUFS. Awaiting review |
| `spring-dream` | 3:46, 72 BPM, F Lydian | Triplet harp, glockenspiel, flute melody; clarinet with pizzicato and marimba; violins reprise with flute countermelody. −14.0 LUFS. Awaiting review |
| `pahadi-winter` | 3:36, 62 BPM, raga Pahadi on D | Harp tanpura cycle, cello drone, flute as bansuri with kan notes, piano as santoor, soft keherwa. −14.3 LUFS. Awaiting review |
| `city-lights` | 3:26, 86 BPM, D♭ | Neo-soul / lo-fi: swung drum machine, saturated piano comping, synth bass, harmon-muted trumpet, pizzicato break. −15.0 LUFS. Awaiting review |
| `sandhya` | 3:57, 92 BPM, E minor | Hindi-film-style ballad written from the reference profiles (Tum Hi Ho, Kesariya, Channa Mereya): bansuri-style flute lead, tenor sax interlude, Dan Tranh as santoor, dholak on the VCSL hand kit over a 3-3-2 kick, staged strings by fader automation. −12.2 LUFS. Copying guard clean. Awaiting review |
| `neon-bhairav` | 3:24, 100 BPM, raga Bhairav on C | Cyberpunk fusion: rolling synth bass, delayed arp, gliding synth lead doubled by oboe-shehnai, four-on-the-floor plus tabla-style hand drums. −11.4 LUFS. Awaiting review |
| `future-lab` | 4:50, 110 BPM, D minor | Sound palette, not a release: electric violin chains, brass from trumpet to tuba, braam, metallic percussion, synths, then a 16-bar groove. Owner: keep all presets |
| `deep-desert` | 3:14, 62 BPM, D Phrygian dominant | Desert cue in the sound world of the Dune scores (original): duduk stand-in with microtonal bends, electric cello, war horn, throat-singing and voice synths, metal, drums in 7 against a cello in 5; cold open, void, fragments, cut, a climax that lifts a semitone, collapse, unresolved ending. −11.7 LUFS. Review 1: 6/10 (predictable framing); version B awaiting A/B |

## Singing: what we measured (2026-10-16)

Intelligibility is scored with local Whisper (`tools/stt.py`, character error rate against the lyrics; clean speech of the voice scores 0.06).

| Change | Effect on CER |
| --- | --- |
| Cutting syllables out of speech and re-pitching each separately | 0.38: ElevenLabs character timestamps are too coarse; consonants get cut |
| Warping the whole line in one pass | 0.31 |
| TTS direction `[sings slowly, holding each vowel]` | Syllables twice as long (0.35 s), so less stretching: 0.25 |
| Pitch vs timing separately | Pitch change does more damage (0.31) than time stretch (0.19) |
| Keeping the voice's own pitch movement, centred on the note | Helps only together with a smaller pitch gap |
| Band 3–5 semitones lower, closer to the voice | 0.16–0.28 per line, verse mean 0.32 |
| `speed: 0.7` voice setting | No effect with eleven_v4 |

The API key lacks the `speech_to_text` permission; Whisper runs locally instead.
