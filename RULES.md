# Music Mania rules

Read this before adding or changing a track. It is the working memory of this repo: SoundCraft facts we measured, how a piece is made, and the musical and mix decisions that survived listening.

Cursor picks up a shorter form of the same rules from `.cursor/rules/`.

## 1. Non-negotiables

1. **Every musical decision lives in `pieces/`** (a `.mjs` instrumental, or a `.json` song). Do not hand-edit a `.scraft` session and call that the source. Re-render from the generator.
2. **Ticks per beat = 960.** SoundCraft is not 480. A piece written at 480 plays in half the time and goes silent after the midpoint.
3. **The agent cannot hear.** After every bounce, run `tools/measure.py` (via `tools/render.mjs`). Then a person listens. Measurements catch silence, timing errors, clipping, jumps, buried leads and a missing tail. They cannot judge beauty or resemblance to an existing song.
4. **Do not commit secrets or third-party samples.** `.env` (ElevenLabs), `work/` (TTS cache of the owner's voice), `samples/**` audio, `out/Audio Files/` and `out/*.scraft` stay local. Deliver WAV/MP3 only. VSCO asks that its samples not be redistributed or sold as samples; a `.scraft` session copies them into `out/Audio Files/`.
5. **Record origin** in `CREDITS.md` for every released track.

## 2. Pipeline

```
python -I tools/zones.py                              # once, or after adding samples
node tools/render.mjs pieces/<name>.mjs --stems       # instrumental
ffmpeg -i out/<name>.wav -b:a 256k out/<name>.mp3
python -I -X utf8 tools/sing.py pieces/<song>.json    # vocal over an instrumental
```

1. **Brief.** Purpose, length, loop or one-shot, mood, tempo, key, instrumentation.
2. **Compose in the generator.** Harmony, melody, bass, patterns, sampler settings, EQ, sends, form. Seeded RNG for humanisation so a re-render is bit-identical.
3. **Render** through SoundCraft 0.7.0 (`soundcraft-cli.exe`). Clips must include ring-out; bounce length is the last clip end.
4. **Measure.** Per-bar RMS, jumps/drops, section RMS / centroid / low-mid-high / width, octave bands vs 1 kHz, click spikes, last 50 ms. With `--stems`, per-instrument RMS per section.
5. **Owner listens.** Changes go back into the generator, not the session.
6. **Origin entry** in `CREDITS.md`. Commit generator + WAV/MP3 together.

SoundCraft CLI: `C:\Program Files\SoundCraft\soundcraft-cli.exe`. Update only from [official GitHub releases](https://github.com/storytold/soundcraft). Do not use the paid AI mixing assistant, Craft credits, or the sampler to load anything other than the libraries in `CREDITS.md`.

## 3. SoundCraft facts (measured, 0.7.0)

| Fact | Detail |
| --- | --- |
| Ticks per beat | **960**. Positions: `"1\|1\|000"` bar\|beat\|tick, or sample counts at 48 kHz. `"2 bars"`, `"4s"`, `{bars:2}` are rejected. |
| One id counter | Tracks, loaded samples and clips share it, in creation order. Create all tracks, then all samples, then all clips, then notes. `render.mjs` checks predicted clip ids against the CLI. |
| Master track | `track.new {kind:"master"}` is always named `"Master 1"`. |
| Sampler | One sample per track. `mix.sampler_load` params: `root_note key_low key_high vel_low vel_high`, `attack` 0.1–5000 ms, `decay`/`release` 1–10000 ms, `sustain` %, `level` −48…+12 dB, `fine_tune` ±100 cents, `transpose` ±48, `velocity` %, `start`/`loop_start`/`loop_end` %, `loop_mode` 0–2. 44.1 kHz files convert to 48 kHz on load. |
| Routing | `mix.new_bus`, `track.output` / `track.input`, `mix.send {track, slot, bus, level_db}`. Tracks addressable by name. One group aux per instrument holds volume, pan, inserts and the hall send. |
| `eq_1band` types | 0 bell, 1 low shelf, 2 high shelf, 3 high-pass, 4 low-pass, 5 notch, 6 band-pass. Gain ±24 dB, q ≤ 10. |
| Reverb `damping` | A frequency, 1000–20000 Hz (plate default 10000). Small numbers clamp to 1 kHz and dull the tail. The plate also darkens on its own (~−5 dB at 4 kHz). |
| Bounce | Ends where the last clip ends. Include ring-out in clip length / `endTicks`. |
| VSCO naming | Strings, flute, clarinet, oboe are named an octave below sounding pitch. Harp and Salamander use standard names. `zones.py` applies the offset. |

Further command notes (synth-era title-theme work, still true): `midi.note_add` `start_ticks` is relative to the clip; drum GM map 36/38/42/46/45/50/49; `mix.volume` in dB; `--bounce` is 48 kHz / 24-bit stereo WAV.

## 4. Composition rules (from Golden Hour)

Hotel-lobby / study / sleep background: sampled piano, strings, woodwinds, harp. Original melody and harmony. No existing songs, loops or presets.

- **Form before notes.** Name the sections and their bar counts first (Golden Hour: Intro 4, A1 16 piano alone, A2 16 strings and harp join, B 16 violins lead, C 8 flute over A harmony, A3 16 piano up an octave, Outro 8, plus ring-out).
- **Harmony.** Diatonic to the key, with suspended dominants into cadences. Voice-lead: nearest chord-tone set, **always include the third**, prefer the seventh when voicing ≥3 notes, avoid spacing under a minor third inside a voicing, hold common tones.
- **Melody.** Write one array per bar of `[note or null, beats]` that sums to the bar. Higher notes slightly louder. Leave space: when a melody is in, the accompaniment thins (Golden Hour B: piano becomes a rolled chord on 1 and a soft repeat on 3).
- **Piano.** Pedal: a pitch rings until it is struck again or the segment ends. Intro/A: broken-chord arp; B: pulse so the violin can lead.
- **Strings enter in stages, never as a block.** A sudden section at full level reads as a jump. Golden Hour review 1: the strings' entry at bar 21 was not smooth. Fix that stuck: cello swell on the last bar of A1, cellos alone at the start of A2, violas from A2 bar 3, full level by bar 5, first harp sweep at A2 bar 5 (global bar 25).
- **Sample velocity layers are musical choices.** VSCO susVib violins switch forte at velocity 81. A lyrical lead must stay ≤ 80 or the timbre flips. Do not "just turn it up" past a layer boundary.
- **Humanisation is seeded.** Timing jitter and velocity jitter from `rng(seed)` so renders reproduce. Keep jitter small (about ±12 ticks, ±4 velocity).
- **Do not outlast the sample.** A shifted-up zone is shorter. `session.mjs` warns; shorten the note or pick a closer zone (`maxShift` default 4 semitones).
- **Ring-out is part of the piece.** Extra bars of decay after the last written bar. The tail of the bounce should measure near silence in the last 50 ms.

## 5. Mix rules (measured targets)

These are the numbers we mix toward. If a stem check fails, fix levels in the generator and re-render.

| Check | Target |
| --- | --- |
| Lead vs accompaniment (same section) | Lead **2–3 dB** above |
| Pads / beds vs lead | **6–8 dB** below |
| Octave balance vs 1 kHz | about **+3 dB at 125 Hz**, **−8 to −12 dB at 4 kHz**. Far below that is dull; above it is harsh |
| Boxy buildup | Golden Hour needed **−2 dB bell at 500 Hz** on the master (measured +4 dB there) |
| Peak | stay under 0 dBFS; maximizer `ceiling: -1` |
| Loudness (current pieces) | around **−16.5 LUFS** integrated for this collection |
| Tail | last 50 ms near silence |
| Per-bar RMS | no JUMP > 6 dB vs previous bar, no DROP > 8 dB vs both neighbours, unless the form intends a hit |
| VSCO vs Salamander | VSCO is recorded far quieter. Compensate with sampler `level` on the strings/harp **and** `level_trim` per zone from `zones.py` (sustained notes were bumping by up to 10 dB note-to-note) |
| Piano EQ | HPF ~35 Hz, cut ~300 Hz, high shelf ~5 kHz |
| String EQ | HPF 45–150 Hz depending on instrument |
| Hall | shared plate, send not insert; `damping` around 9 kHz, not a small number |
| Violin B melody | own track, a little above the piano; A3 violin countermelody on a quieter pad track under the piano |

After a reviewed bounce, keep other sections within **0.5 dB** of the reviewed version unless the owner asked to change them.

## 6. Review log (changes that are now rules)

| Date | Piece | What we heard | What we changed | Rule to keep |
| --- | --- | --- | --- | --- |
| 2026-10-15 | title-theme (synth, Super Cricket notes in `music.md`) | Render 1 silent after bar 9 | Probed ticks: **960 not 480** | Never assume 480 |
| 2026-10-15 | golden-hour | "Moving, but strings at bar 21 aren't smooth" | Staged string entry (cello swell → cellos → violas → harp); evened VSCO zone levels | No block entries; per-sample `level_trim` |
| 2026-10-15 | golden-hour | Mix felt boxy | Master bell −2 dB @ 500 Hz | Measure octave/mid buildup |
| 2026-10-15 | golden-hour | Violin lead flipped to a harsher layer | Cap melody velocity at 80 | Respect velocity maps |
| 2026-10-16 | duniya-gol-hai | Need the vocal above the band, piano a bit down, violins a bit up | `vocal_db: 12`, `instrument_db` Piano −2.5 / Violins +7.5, `octave_shift: -12` | Song JSON holds mix offsets; voice sits in a singable octave |
| 2026-10-16 | duniya-gol-hai | Pitch / timing of sung syllables | Keep consonant onset, stretch the vowel, PSOLA onto the note, vibrato only on long notes, 15 ms pre-roll | 95% of syllables within 50 cents of the written note; vocal 3–7 dB over the band |

## 7. Songs (speech-to-singing)

`pieces/<song>.json` is the source: lyrics, melody, form, mix offsets. `tools/sing.py` speaks each line with ElevenLabs (cached in `work/tts/`, paid once per line), then Praat PSOLA puts each syllable on its note.

- Each syllable is `[text, note, beats]`. A trailing space ends a word. Notes are written as the instruments play them; `octave_shift` moves the voice.
- Form is `[part, startBar]` onto the instrumental. Verses on the A melody, chorus on the B melody, unless a new piece says otherwise.
- TTS alignment must match the concatenated syllable text exactly. If it drifts, change the lyric spelling (not the aligner).
- Very short syllables borrow a little of what follows so pitch analysis has enough periods.
- Vocal chain (current): HPF 90 Hz, bell −2.5 dB @ 300 Hz, high shelf +3 dB @ 4 kHz, compressor −24 dB / 3:1, send to the session Hall, then `vocal_db`.
- Intelligibility: `tools/stt.py` against the lyric; report character error rate. Low CER is required but not sufficient — still listen.
- The voice is the owner's ElevenLabs clone. Owner holds the voice rights. Do not check TTS/vocal caches into git.

## 8. Copyright and samples

General information, not legal advice.

- **SoundCraft** is MIT OR Apache-2.0. It claims nothing over what we render. Built-in plugins are original; we are not using them for this collection (sampler only).
- **Salamander Grand Piano V3** (Alexander Holm): CC BY 3.0 — credit required. **VSCO 2 CE** (Versilian Studios / Sam Gossner, Simon Dalzell): CC0; they ask for credit and that we not sell the samples directly. Credit line is in `CREDITS.md`.
- **United States:** copyright needs human authorship. Prompts and approval alone are probably not enough. Human melody, rhythm, or creative arrangement that is perceptible in the output can be protected; AI-only material must be disclaimed on a US registration.
- **India:** Copyright Act s. 2(d)(vi) names the author of a computer-generated work as "the person who causes the work to be created". Untested for generative AI.
- **To own a track:** the owner supplies a core idea (hummed, played, or written into the generator), makes real creative choices in iteration, and those contributions are committed under their name with an origin entry.

## 9. What belongs in git

| Commit | Do not commit |
| --- | --- |
| `pieces/`, `tools/`, `RULES.md`, `music.md`, `CREDITS.md`, `README.md` | `.env` |
| `samples/zones.json` and sample *licences / readmes* | Sample audio (`salamander/Samples/`, VSCO `.wav`) |
| `out/*.wav` and `out/*.mp3` of real pieces | `out/Audio Files/`, `out/*.scraft`, `out/Backups/` |
| `.cursor/rules/` | `work/` (scripts, stems, TTS, vocals) |
