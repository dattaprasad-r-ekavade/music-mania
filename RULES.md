# Music Mania rules

Read this before adding or changing a track. It is the working memory of this repo: SoundCraft facts we measured, how a piece is made, and the musical and mix decisions that survived listening.

Cursor picks up a shorter form of the same rules from `.cursor/rules/`.

## 1. Non-negotiables

1. **Every musical decision lives in `pieces/`** (a `.mjs` instrumental, or a `.json` song). Do not hand-edit a `.scraft` session and call that the source. Re-render from the generator.
2. **Ticks per beat = 960.** SoundCraft is not 480. A piece written at 480 plays in half the time and goes silent after the midpoint.
3. **The agent cannot hear.** After every bounce, run `tools/measure.py` (via `tools/render.mjs`). Then a person listens. Measurements catch silence, timing errors, clipping, jumps, buried leads and a missing tail. They cannot judge beauty or resemblance to an existing song.
4. **Do not commit secrets or third-party samples.** `.env` (ElevenLabs), `work/` (TTS cache of the owner's voice), `samples/**` audio and everything in `out/` stay out of git. Sample libraries and released WAV/MP3 live in the private R2 bucket (`tools/assets.mjs`). Deliver WAV/MP3 only. VSCO asks that its samples not be redistributed or sold as samples; a `.scraft` session copies them into `out/Audio Files/`.
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
6. **Origin entry** in `CREDITS.md`. Commit the generator, and push the WAV/MP3 to R2 in the same step: `node tools/assets.mjs push out/<name>.wav out/<name>.mp3`.

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
| File formats | WAV, FLAC, **AIFF** (Iowa) and **MP3** (Philharmonia) load directly (tested 2026-10-21). For MP3, `soundfile`'s `sf.info().duration` is an estimate (surdo 2.08 s, decoded 1.83 s): measure with the decoded length. |
| Sample `start` | Percent of the file, fractional values work: `start: 16.25` cut a double bass's 277 ms lead-in to 13 ms. `zones.py` writes a per-zone `start` for Iowa and Philharmonia; `session.mjs` passes it on. |
| `subtractive_synth` | `osc1_wave`/`osc2_wave`: **0 saw, 1 square, 2 sine, 3 triangle** (measured harmonics). Params: `osc2_semitones osc2_detune osc_mix cutoff resonance filter_env_amount filter_attack/decay/sustain/release amp_attack/decay/sustain/release glide level velocity` |
| `drum_synth` | GM keys 36/38/42/46/45/50/49. Params: `kick_decay kick_tune snare_snappy snare_decay snare_tune hat_decay open_hat_decay tom_tune tom_decay cymbal_decay level` |
| VSCO gaps | Horn samples skip C4–D5 and trombone shorts have 7-semitone gaps: give those instruments `maxShift: 7`. A velocity layer missing a note falls back to the nearest layer that has it (`session.mjs`). The clarinet's "F#5" files play F5 (`zones.py` corrects mislabels that land cleanly on a neighbouring semitone) |
| Round robins | Zones differing only by `rr` alternate on repeated notes (spiccato, pizzicato, shorts, kit) |
| Percussion kit | `perc` zones are fixed keys (36 bass drum, 38 snare, 39 snare roll, 41 tumba, 43 conga, 45 quinto, 46/47 slaps, 49 crash, 51 sus. cymbal, 52 gong, 53/55 cymbal swells, 54 tambourine, 56 cowbell, 58/59 log drums, 60 claves, 61 triangle, 62 sleigh bells, 63 anvil, 64–68 timpani hits, 69/70 timpani rolls), each trimmed so its loudest layer peaks at −3 dBFS (congas were 12 dB under the bass drum). Kits and `drum_synth` ignore `transpose` |
| Click check | Drum, pizzicato and pluck attacks also trip it. In percussive pieces read the per-stem `clicks` column (`--stems`): a click in a pad, lead or drone is real; counts on drums, bass plucks and tabla are attacks |
| Automation | `automation.set_point {track, param: volume|pan|send_a_level|plugin:a:<id>, at, value}` works in script mode; points ramp linearly. An automated fader ignores `mix.volume`, so `session.mjs` `automate('volume', [[ticks, dB]])` adds the instrument's `volume`. Use it for swells, staged entries and fades instead of velocity tricks. **The first point holds back to the start of the piece** (Sandhya's strings sat 14 dB low until their first swell): start every swell with a 0 dB point just before it, `[[at - 10, 0], [at, -14], [at + 2 * BAR, 0]]`. `session.mjs` now also anchors volume/pan automation at its static value on bar 1 |
| `file.bounce_stems` | One file per *zone* track, taken before the group's inserts, fader and sends. Not a substitute for the per-instrument stem check, so `render.mjs --stems` still mutes groups and re-bounces |
| Track names | Tracks are addressed by name. Two zone tracks with the same name made the second clip replace the first ("no such clip"); `session.mjs` now numbers duplicates (`#2`) |
| True peak | The maximizer limits sample peaks only; `ceiling: -1.5` still measured −0.71 dBTP (Neon Bhairav). `render.mjs` warns above −1 dBTP |
| MCP | `soundcraft-cli mcp` serves list_commands, execute, batch, inspect_session, bounce_mix and more. With `--connect PORT` to a running `soundcraft --control 0` app, the owner can watch and play the session |

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

## 4b. Themed collection (2026-10-16)

Five 3–4 minute pieces from owner briefs: `mass-entry`, `spring-dream`, `pahadi-winter`, `city-lights`, `neon-bhairav`. These use SoundCraft's built-in synths and drum machine as well as the sampler (MIT-licensed, original; still no third-party presets or loops).

- **Indian colour from what we have:** oboe stands in for nadaswaram / shehnai, flute with grace notes (`[note, grace]`, kan swar) for bansuri, high piano in double strokes for santoor, harp plucking Pa–Sa–Sa–Sa for tanpura, tumba/conga/quinto patterns for thavil, tabla and keherwa. Ragas as scales: Phrygian dominant (≈ Vakulabharanam), Pahadi, Bhairav (`music.mjs` `SCALES`). A recorded Indian player would still beat these stand-ins.
- **Loudness by genre:** action / cyberpunk around −11 LUFS (maximizer ceiling −1.5 for dense mixes, so true peak stays under 0), gentle pieces −14 to −15.
- **Recurring fixes:** VSCO shorts and brass need big `level` boosts against the synths; synth levels start far too low (bed −34 to −40 dB on the first Neon Bhairav render); a lead entering after a quiet intro needs a pickup or swell, not a jump; a drone or bed level with the lead buries it (6–8 dB under).

## 4c. Learning from references (2026-10-16)

Take the abstract parts of music we admire; never its melody. `tools/analyze.py` writes a profile: BPM, bars, key, chords per bar (names and Roman numerals), most common 4-bar progressions, form (sections A, B, … with bar counts), kick/snare/hat grids per section in `drums()` string format, and a mix profile per section (LUFS, octave bands vs 1 kHz, width, crest). `--stems` adds melody/bass statistics (range, steps vs leaps, notes per bar, phrase length, syncopation), never the notes themselves.

| Use from a profile | Do not take |
| --- | --- |
| Form and section lengths, tempo, meter | The melody, a hook, or a recognisable riff |
| Progression habits (Roman numerals) | A distinctive progression plus its rhythm and voicing together |
| Drum grids as a starting groove, then varied | A whole drum pattern with its sound and fills |
| Mix targets per section (`ref:` in a piece, `measure.py --ref`) | Samples or stems from the recording |
| Melody statistics as a style brief | Transcribed MIDI as material |

- **Measured accuracy** (our own renders as ground truth): BPM within 0.6, key right for Golden Hour (E♭) and City Lights (D♭, after weighting the chords' fit); raga pieces report a major/minor stand-in with a low diatonic % (Neon Bhairav: C, 60%). Section boundaries land within a bar or two of the real form; the first boundary in a quiet intro is the weakest.
- **Transcription** (Basic Pitch on Demucs stems) is noisy: octave errors are counted separately. A lead sharing the "other" stem with piano is mostly lost, so the copying guard can miss it; it is strongest against clean MIDI references.
- **Copying guard** `tools/similarity.py`: flags a run of 8 intervals with the same rhythm, or >10% shared 6-interval patterns. Positive control (City Lights vs its own transcription): bass 83% flagged, piano run of 12 flagged. Negative control (Golden Hour vs City Lights): max run 5, 0% shared. Run it on every piece written with a reference in mind.
- **Matchering** (`tools/master.py`): matches loudness and the 125 Hz–4 kHz balance within about 1 dB; extremes follow the arrangement (a glockenspiel stays bright). A starting master, then measure and listen.
- Reference audio is someone else's recording: keep it in R2 (`refs/`), never in git, never in a release.
- **Without `--stems`, drum grids come from the whole mix**, so piano and harp attacks read as kick and snare (Golden Hour has no drums but shows a grid). Trust grids only from `--stems` profiles.
- **Several references into one brief:** `python -I tools/profiles.py refs/a.profile.json refs/b.profile.json …`.

**Hindi film benchmark (2026-10-16):** Tum Hi Ho, Kesariya and Channa Mereya (official YouTube audio, analysed with `--stems`).

| | Tum Hi Ho | Kesariya | Channa Mereya |
| --- | --- | --- | --- |
| Measured | 95.7 BPM, F minor | 95.7 BPM, C major | 89.1 BPM, A minor |
| Published | F minor, 94–99 BPM (sheet music, key databases): **match** | no reliable source | no reliable source |
| Loudness | −13.8 LUFS, −2.3 dBTP | −10.5 LUFS, −0.9 dBTP | −6.7 LUFS, +1.3 dBTP (a hot upload, not a target) |
| Top progression | iv–bVII–bVI–i | I–I–I–V (long tonic pedal) | i–bVI–iv–bIII ×12 |
| Vocal line (5–95 %) | D#3–F5, 65 % steps | B3–D5, 70 % steps | G3–F5, 67 % steps |

What the three share and our pieces lack: tempo 89–96; the vocal moves **by step 65–70 %** with leaps ~20–27 %, about **6.5 notes per bar** in **phrases of 22–25 notes**, and only **26–35 % of notes start on the beat** (strong syncopation; our melodies sit mostly on beats). Mixes are brighter and denser than ours: 4–16 kHz roughly 10–20 dB above Golden Hour, crest 10–12 dB against our 16–17, width −6 to −8.5 dB (more mono-centred; our sampled strings spread wider). Kick in Tum Hi Ho plays a 3-3-2 grid (`X.....X.x.....X.`). For a Hindi-film-style piece: 90–96 BPM, minor key with bVI and bIII, syncopated stepwise lead over the 3-3-2 kick, mastered near −12 LUFS.

**VCSL instruments added** (`zones.py --only …`; folders pulled from R2): `vibes`, `vibes_hard`, `tenor_sax`, `tenor_sax_vib`, `tenor_sax_stac`, `dan_tranh` (santoor / swarmandal stand-in), `dan_tranh_vib`, `upright` (Yamaha), `kalimba`, and a `hand` kit (60–64 darbuka strokes, 65–68 frame drum open/muted, 69–72 bongos). Starting levels with flat sampler settings (`pieces/vcsl-smoke.mjs`): vibes and hand drums about −23 dB, kalimba −31, sax −32, Dan Tranh −34: give the last three about +8–10 dB sampler `level`. Vibraphone partials fool the pitch detector, so flagged vibes zones stay untuned (they are close already).

## 4d. Theory references and checks (2026-10-16)

- [docs/theory-western.md](docs/theory-western.md): melody, phrase, harmony, rhythm and arrangement rules with target numbers. Check a lead with `node tools/critique.mjs pieces/<name>.mjs <Instrument>` (`tools/lib/theory.mjs`): step/leap/repeat %, notes per bar and phrase, on-beat %, syncopation (LHL, WNBD), climax placement, gap-fill, strong-beat chord tones and unprepared dissonances, parallels and register clashes against every other part.
- [docs/theory-indian.md](docs/theory-indian.md): 16 ragas (aroha/avaroha, vadi/samvadi, pakad, nyas, varjit, chords that fit), ornaments mapped to grace notes and glide, six taals with hand-kit grids, film-song form and harmony. Data and checks in `tools/lib/raga.mjs` (`RAGAS`, `TAALS`, `GROOVES`, `checkBarsRaga`, `ragaChords`, `tihai`, ornament builders). Keys are lowercase (`'yaman'`).
- Sandhya's first critique (before revision): lines too even and on the beat (59–73 % on-beat vs 20–45), no 16th onsets, few repeats and leaps, a 39-note mukhda with no breath, repeated climaxes in the antara, two unprepared strong-beat dissonances, Violins and Santoor above the flute, bass and cello parallel fifths. Fix these in the next melody revision; the owner approved the flute line as it stands.

**Sandhya review 2 (2026-10-21), first A/B entry (`feedback/feedback.jsonl`):** owner picked **B**: "lighter, easier on the ears; minor changes but it works". Changes: master +2 dB bell at 260 Hz (q 1.2), high shelves +7 dB at 3.5 kHz and +3.5 dB at 8 kHz, cellos -4 dB, violin pads and santoor voiced lower (violins above the flute 63 % → 11 %, santoor 54 % → 9 %), COUNTER an octave down, backing dips -9 dB over the half bar before each mukhda return, ceiling -2. Measured: 4 kHz -12 → -13 dB, 8 kHz -21 → -19 dB re 1 kHz, -13.1 LUFS (was -12.2), crest 14.7 (was 14.1). Owner "not sure" about hearing the breaths (they measure only 1.5-2 dB per bar under the flute); brighter top "fine". A broad low-mid bell (q 0.7) darkened the bands by lifting 1 kHz: keep warmth boosts narrow. Audiobox scores moved within noise (CE 7.52 → 7.49) while the owner preferred B.

**Sandhya review 1 (2026-10-16):** "intro keyboard too metallic" (the Dan Tranh, 4 kHz only −2 dB re 1 kHz: lowered register and velocity, high shelf −2.5 dB, LPF 10 kHz); "percussion needs a little bass" (dholak had nothing under 100 Hz: +5 dB at 110 Hz, muted large frame drum under the doum; kick +4 dB at 100 Hz); "check the flute for random volume increases" (G4 after F#4 jumped +4 dB: the E4 zone needed +14 dB, clamped at the sampler's +12, so a piece-local flute zone copy with fitted levels). **Sampler `level` + `level_trim` above +12 dB is clamped:** `session.mjs` now warns. On 2026-10-16 it fires in six of the seven earlier pieces (Golden Hour is clean); fix those when each is next revised.

**Audio embeddings (`tools/embed.py`, 2026-10-16).** CLAP `laion/clap-htsat-unfused` (text prompts too) and MERT-v1-95M (use its FD only; its cosine is set-dependent). `laion/larger_clap_music` is broken in its HF conversion; fadtk needs numpy<2. Compare against references with `--no-vocals` (Demucs instrumental). Hindi references against each other: CLAP cos 0.83-0.91 (no vocals), MERT FD 1.8-2.5. Sandhya: closest of our pieces in 3 of 4 measures (CLAP 0.684 full / 0.713 no-vocals, MERT FD 2.67 / 2.97; nearest Channa Mereya no-vocals 0.785) but still outside the cluster; Intro and Outro drift most. Trust trends between revisions (CLAP +0.03 or MERT FD -0.2 is real), not absolute cutoffs; style fit ≈ CLAP ≥ 0.8 to the nearest reference, < 0.65 is another genre. Text prompts rank broad traits correctly (cyberpunk synth → Neon Bhairav, vocals → references, solo piano → Golden Hour) but fail on Indian instruments and on negation.

**Separation (2026-10-16): keep Demucs.** RoFormer through python-audio-separator 0.47 (BS-RoFormer SW, Viperx-1297) gave silent or misrouted stems on torch 2.10 CPU, and costs ~7x real time on this 4-core i5 (25-40 min per song). `analyze.py --separator` defaults to `demucs`; `roformer` is marked experimental. Demucs already transcribes 76 % of City Lights' trumpet notes (onset recall): the copying guard missed it because `similarity.py` takes the skyline of a mixed stem. **Fix next in the matching:** compare every voice of the 'other' MIDI, not only its top line. If separation is revisited: Demucs `htdemucs_6s` (piano stem), or ZFTurbo's MSST inference for SW.

**Aesthetics scores (`tools/aesthetics.py`, 2026-10-21).** Audiobox Aesthetics, 1-10: Golden Hour CE 7.63 / PQ 7.95, Sandhya 7.52 / 8.13 (Intro CE 7.37 lowest, Mukhda 7.63), Tum Hi Ho 7.43 / 8.22. Deliberate damage on 60 s of Golden Hour: low-pass + crush -0.9 PQ / -0.5 CE; 8 kHz resample -0.4 PQ / -0.3 CE (while its octave bands read *brighter*, from distortion). Compressed scale: < 0.2 is noise. Not yet validated against the owner: log A/B choices with `tools/feedback.py` and check `report` before using it as a target.

## 4e. Iowa MIS and Philharmonia (added 2026-10-21)

Listening test: `pieces/sample-tour.mjs` (every new zone on the same phrase, sampler level 0; WAV/MP3 in R2 as `out/sample-tour.*`).

- **Raw level at sampler level 0, velocity 90** (section RMS dBFS): flute (vib) −15.5, Thai gong −16.6, marimba yarn −17.4, viola −17.8, bass arco −19.6, pizz −20…−21, banjo −22.0, cello −22.2, violin −22.5, clarinet −22.8, plain flute −22.9, oboe −23.5, bassoon −23.6, soprano/alto sax −24…−25, flutes alto/bass −25, trumpet −26.9, cor anglais −27.1, bowed vibes −27.3, horn −28.0, trombone −33.4, **mandolin −34.2, mandolin tremolo −35.0, guitar −35.3**. The Philharmonia plucked strings need about +10 dB more than the rest: put it in the group `volume`, not `sampler.level` (clamp at +12).
- **Timing:** both libraries have silence or noise before the attack (Philharmonia MP3 24-280 ms, Iowa 50-80 ms). `zones.py` measures it (`lead`): −30 dB below peak for bowed and blown swells, −12 dB for plucked and struck sounds (some Philharmonia files have up to 190 ms of −22 dB string or handling noise before the hit). Measured in a render: attacks land 0-6 ms after the note (plucked, pizz, kit), 4-18 ms (horn, sax, cor anglais).
- **Iowa is solo, dry and nearly mono** (side/mid about −18 dB): pan it and give it the reverb send; one dynamic (ff) only, so shape loudness with `velocity` and automation. Philharmonia notes are mostly 0.25-1.5 s: use them for plucked parts, short phrases and percussion, not long sustains.
- **Pitch:** Iowa labels are mostly right; zones.py root-corrects files that play a semitone or two off (bass E string drifts flat up high, so the bass prefers the G string), and confirms flagged notes with a harmonic-product-spectrum second opinion. Violin and cello pizzicato above about E5 is a click plus sympathetic ringing (−30 dB within 100 ms): avoid high pizz. Skipped bad take: guitar A#4 forte (plucked twice).
- **Click detector** fires on Iowa trombone and tuba ff: their waveform edges are steep (step equals the local RMS, no discontinuity in the files). Not a defect.
- **Indian stand-ins:** soprano sax and oboe (shehnai, nadaswaram), plain flute (`flute_plain`, no vibrato; bansuri lines), mandolin and mandolin tremolo (Carnatic mandolin, santoor-like tremolo), Chinese hand cymbals on `phil_perc` key 60 (manjira), surdo (dhol-like low end), Thai gong, bowed vibraphone (glassy drone pad).

## 4f. Western / futuristic palette (Future Lab, 2026-10-22)

`pieces/future-lab.mjs` plays every preset alone, then a 16-bar groove; the presets live in `tools/lib/palette.mjs` (`presets(bpm)`). **Owner verdict: keep them all, all good to use.**

- **Electric violin** = Iowa `violin_solo` through inserts: clean (delay), drive (saturator 16 dB, tone 6.5 kHz, chorus, dotted-8th delay), octave (pitch shifter -12 at 40 % before the saturator), phaser; `evSaw` doubles a line with a detuned saw. The saturator adds about 4 dB: drive sits at volume -4.5.
- **Brass by size:** Iowa solos and VSCO sections, braam (trombones with a -12 pitch-shift layer and saturator, plus tuba D2 and gong), staccato stabs on all four sections. VSCO `trombones` stay quiet (-22 dB alone at sampler level 6, volume +12); VSCO `tuba` sustains run out under 2-bar holds: use `tuba_iowa` for the braam.
- **Metal:** crotales (84-108), vibes, bowed vibes, Thai gong (60-72), `perc` (anvil 63, triangle 61, cowbell 56, cymbals 51/53, gong 52), `phil_perc` (agogo, bell tree, chimes, tam-tam, clash), processed crotales (rectifier + flanger + delay), gong an octave down, anvil with delay.
- **Levels alone** (section RMS dBFS): violin chains -14…-18, brass -12…-22, metal -12…-24, synths -18…-21, drum_synth hats -32 (thin, centroid 16 kHz; use them under other parts). Groove -13.0.
- **VSCO glock is about 25 dB quieter** than the other mallets at the same settings: dropped from the palette.
- Click detector fires on the VSCO staccato brass (bar 60) as well as Iowa trombone/tuba; not heard as clicks yet.

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
| 2026-10-16 | golden-hour | "10/10, but the violin is suddenly loud at 2:26" | G5 crossed velocity 81 into the forte layer; violin melody capped at 80 | Lead lines stay inside one layer |
| 2026-10-16 | duniya-gol-hai | "Extremely robotic, syllables unrecognisable" | Whole-line warp of a `[sings]` take, natural pitch contour, band 3 semitones down (CER 0.38 to 0.32); singing parked by the owner | Measure intelligibility (`tools/stt.py`) before asking for a listen |

## 7. Songs (speech-to-singing)

`pieces/<song>.json` is the source: lyrics, melody, form, mix offsets. `tools/sing.py` speaks each line with ElevenLabs (cached in `work/tts/`, paid once per line), then Praat PSOLA puts each syllable on its note.

- Each syllable is `[text, note, beats]`. A trailing space ends a word. Notes are written as the instruments play them; `octave_shift` moves the voice.
- Form is `[part, startBar]` onto the instrumental. Verses on the A melody, chorus on the B melody, unless a new piece says otherwise.
- TTS alignment must contain the concatenated syllable text. A delivery prefix (song JSON `tts_prefix`, e.g. `"[sings] "`) may sit in front; skip it when mapping characters to syllables. If the lyrics themselves drift, change the spelling (not the aligner). Leave `tts_prefix` off unless you mean to pay for a new cache of every line.
- Very short syllables borrow a little of what follows so pitch analysis has enough periods.
- Vocal chain (current): HPF 90 Hz, bell −2.5 dB @ 300 Hz, high shelf +3 dB @ 4 kHz, compressor −24 dB / 3:1, send to the session Hall, then `vocal_db`.
- Intelligibility: `tools/stt.py` against the lyric; report character error rate. Low CER is required but not sufficient — still listen.
- The voice is the owner's ElevenLabs clone. Owner holds the voice rights. Do not check TTS/vocal caches into git.

## 8. Copyright and samples

General information, not legal advice.

- **SoundCraft** is MIT OR Apache-2.0. It claims nothing over what we render. Built-in plugins are original; we are not using them for this collection (sampler only).
- **Salamander Grand Piano V3** (Alexander Holm): CC BY 3.0 — credit required. **VSCO 2 CE** (Versilian Studios / Sam Gossner, Simon Dalzell): CC0; they ask for credit and that we not sell the samples directly. Credit line is in `CREDITS.md`.
- **University of Iowa MIS:** "may be downloaded and used for any projects, without restrictions". **Philharmonia Orchestra samples:** free in our own compositions, including commercial releases; they must not be sold or made available as samples or as a sampler instrument. Never share the library (or a `.scraft` with its `Audio Files/`) outside the private R2 bucket.
- **United States:** copyright needs human authorship. Prompts and approval alone are probably not enough. Human melody, rhythm, or creative arrangement that is perceptible in the output can be protected; AI-only material must be disclaimed on a US registration.
- **India:** Copyright Act s. 2(d)(vi) names the author of a computer-generated work as "the person who causes the work to be created". Untested for generative AI.
- **To own a track:** the owner supplies a core idea (hummed, played, or written into the generator), makes real creative choices in iteration, and those contributions are committed under their name with an origin entry.

## 9. What belongs in git

| Commit | Do not commit |
| --- | --- |
| `pieces/`, `tools/`, `RULES.md`, `music.md`, `CREDITS.md`, `README.md` | `.env` |
| `samples/zones.json` and sample *licences / readmes* | Sample audio (`salamander/Samples/`, VSCO `.wav`) |
| `tools/assets.mjs` (R2 holds `samples/salamander`, `samples/vsco2`, `samples/vcsl`, `samples/iowa`, `samples/philharmonia` and `out/*.wav`/`*.mp3`) | Anything in `out/` (renders go to R2; `.scraft` and `Audio Files/` stay local) |
| `.cursor/rules/` | `work/` (scripts, stems, TTS, vocals) |
