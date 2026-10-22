# Music Mania: agent handoff

Read this first, then [RULES.md](RULES.md) (measured facts and rules; it wins over memory) and [README.md](README.md) (layout and pieces). Last updated 2026-10-21.

## What this repo is

Original instrumental music written as JavaScript generators (`pieces/*.mjs`), rendered headless through SoundCraft 0.7.0 with sampled libraries (Salamander piano, VSCO 2 CE, VCSL, Iowa MIS, Philharmonia) and built-in synths, then checked by measurement because the agent cannot hear. The owner listens and gives review notes; fixes go back into the generator and become rules in RULES.md §6.

## Machines (two Windows machines, synced through GitHub and R2)

The owner works on both. **Run `hostname` at the start of a session** and use that machine's row; the facts differ.

| | **Laptop** (`hostname` = `Dattaprasad`, user `ekava`) | **Desktop** (user `admin`) |
| --- | --- | --- |
| Hardware | 20 threads, **NVIDIA RTX 4060 Laptop, 8 GB** | 4-core i5, CPU only |
| Disk | Repo on **D:** (~150 GB free); C: ~59 GB free | **C: nearly full (1-5 GB free)**: keep samples pruned (`node tools/assets.mjs prune`) |
| Python | 3.11.9, `C:\Users\ekava\AppData\Local\Programs\Python\Python311\python.exe` (a real exe) | 3.12 through a pyenv-win **`.bat` shim**: Node can't spawn it (render.mjs resolves the real exe) and `%` in arguments breaks it: use `C:\Users\admin\.pyenv\pyenv-win\versions\3.12.7\python.exe` for such commands (e.g. yt-dlp `-o "%(ext)s"`) |
| Analysis stack | Core only so far (no torch / Demucs yet; install a CUDA build of torch here when GPU work is next) | `requirements-analysis.txt` installed (CPU) |
| Samples on disk | Full libraries (disk is plentiful) | Only what pieces need, pulled from R2 |

**Divide the work by machine:** GPU and disk-heavy jobs (separation, embeddings, aesthetics, Basic Pitch, fetching and zoning whole libraries) on the laptop; composing, rendering and reviews on either. Neither machine has anything the other can't get from git (code, docs, `zones.json`, profiles) or R2 (audio).

**Sync rules:**
1. Start: `git pull --rebase`. End: commit and push (the owner switches machines between sessions), and push new audio to R2 (`node tools/assets.mjs push …`).
2. `samples/zones.json` is generated: on a merge conflict, take either side and rebuild with `python -I tools/zones.py --only <instruments>` rather than hand-merging.
3. `feedback/*.jsonl` is append-only and merges as a union (`.gitattributes`), so A/B logs from both machines combine.
4. A library added on one machine reaches the other through R2 only after `assets.mjs push samples/<lib>/`; `render.mjs` then pulls the files a piece needs.

| Thing (both machines) | Fact |
| --- | --- |
| SoundCraft | `C:\Program Files\SoundCraft\soundcraft-cli.exe` 0.7.0. Ticks per beat 960. `soundcraft-cli mcp` also works (not registered as an MCP server) |
| Python | Run scripts with `python -I` (then the script folder is not on `sys.path`; tools insert it themselves) |
| Packages | `requirements.txt` (core) and `requirements-analysis.txt` (reference learning; `pip install --no-deps basic-pitch` separately: its deps pin numpy<1.24). Do not upgrade/downgrade torch, numpy, librosa, onnxruntime: several tools share one env |
| Disk | Samples are a cache: `node tools/assets.mjs prune`. `work/` stems and `out/Audio Files/` are regenerable. Check `df -h` before downloads or model installs |
| Secrets | `.env` (gitignored, kept on each machine): `R2_ENDPOINT`, `R2_ACCESS_KEY_ID`, `R2_SECRET_ACCESS_KEY`, `R2_BUCKET_NAME` (bucket `music-repo`), ElevenLabs keys (singing is parked by the owner) |
| Line endings | Repo files are CRLF; editing with Node scripts: normalise `\r\n` before matching. Node template literals inside bash heredocs lose backslashes: edit regex-heavy files with the Edit tool |

## Storage (Cloudflare R2, private)

`tools/assets.mjs` + `tools/lib/r2.mjs` (no dependencies). Keys mirror repo paths.
- `samples/salamander/`, `samples/vsco2/`, `samples/vcsl/`, `samples/iowa/`, `samples/philharmonia/`: full libraries (the last two fetched from source with `tools/fetch_samples.py`). `render.mjs` downloads only the files a piece uses into `samples/`.
- `out/<name>.wav|.mp3`: released renders (not in git since 2026-10-16; history was rewritten to drop them).
- `refs/`: reference songs (YouTube audio of Hindi film songs, for analysis only), their stems, MIDI and embedding caches. Never in git, never redistributed.
- Commands: `status`, `push PATH…`, `pull PREFIX`, `need piece.mjs`, `prune`, `mirror OWNER/REPO PREFIX`.

## The loop

```
node tools/render.mjs pieces/<name>.mjs --stems --png     # render, measure, per-instrument stems, PNGs in work/
node tools/critique.mjs pieces/<name>.mjs <Lead>          # melody/harmony/arrangement critique vs targets
python -I tools/similarity.py pieces/<name>.mjs refs/*/*.mid   # copying guard before release
ffmpeg -i out/<name>.wav -b:a 256k out/<name>.mp3
node tools/assets.mjs push out/<name>.wav out/<name>.mp3
```
For a revision the owner will judge: `python -I tools/feedback.py snapshot <name>` before, `pair <name>` after; log the owner's pick. Look at the PNGs with the Read tool (`work/<name>.mix.png`, `.stems.png`; `python -I tools/visualize.py roll …` for a piano roll). Then the owner listens. Record review notes and what changed in RULES.md §6 / §4c-4d.

## Tool map

| Tool | Purpose |
| --- | --- |
| `tools/lib/session.mjs` | Notes → SoundCraft script. Sample zones, groups, sends, master, `automate(param, [[ticks, value]])` (volume values are dB offsets; a 0 dB anchor is added on bar 1 automatically). Warns when sampler `level + level_trim > 12` (clamped) and when notes outlast samples |
| `tools/lib/music.mjs` | Chords, voicing, `melody()` bars `[note, beats]`, `drums()` grids, scales |
| `tools/lib/theory.mjs`, `tools/critique.mjs` | Melody stats and critique against targets in docs/theory-western.md |
| `tools/lib/raga.mjs` | 16 ragas, 6 taals + film grooves on the hand kit, ornaments, `checkBarsRaga` (docs/theory-indian.md) |
| `tools/lib/palette.mjs` | Western / futuristic presets (electric violin chains, brass by size, braam, metal percussion, synths): `presets(bpm)`, then `s.instrument(name, P.evDrive)` (RULES 4f) |
| `tools/render.mjs` | Render + measure + `--stems` + `--png`; piece may return `ref: 'refs/<x>.profile.json'` for a mix comparison |
| `tools/measure.py` | Per-bar RMS, JUMP/DROP, sections, clicks (per stem too), octave bands, tail, `--ref` comparison |
| `tools/visualize.py` | PNGs: `mix`, `stems`, `roll`, `compare` |
| `tools/analyze.py` | Reference profile: BPM, key, chords, form, drum grids, mix per section; `--stems` adds separation (`--separator`), Basic Pitch MIDI, line statistics |
| `tools/embed.py` | CLAP / MERT embeddings, similarity to references, CLAP text prompts |
| `tools/profiles.py` | Profiles side by side → a brief |
| `tools/similarity.py`, `tools/notes.mjs` | Copying guard (symbolic) |
| `tools/master.py` | Matchering to a reference |
| `video/make.mjs`, `video/src/` | YouTube videos: Remotion pixel-art loop per piece, ffmpeg to full length with audio, thumbnail, upload text, R2 (README "Videos") |
| `tools/aesthetics.py`, `render.mjs --aes` | Audiobox Aesthetics scores (CE/CU/PC/PQ), whole and per section |
| `tools/feedback.py` | Owner A/B log: `snapshot` → change + render → `pair` → owner listens → `log <name> A|B|same "note"`; `report` = which metrics predict the owner |
| `tools/zones.py` | Builds `samples/zones.json`; `--only a,b` rebuilds just those (pull their folders from R2 first). Measures pitch, level and, for Iowa / Philharmonia, the silence before each attack (`start`) |
| `tools/fetch_samples.py` | Downloads Iowa MIS / Philharmonia from their publishers (once, on the laptop), before `assets.mjs push` |

## State of the work (2026-10-21)

- Pieces: golden-hour (owner 10/10), mass-entry, spring-dream, pahadi-winter, city-lights, neon-bhairav (awaiting review), sandhya (review 1 applied: warmer intro, percussion low end, flute levels).
- **Sandhya**: review 2 (mix and arrangement) chosen by the owner in the first A/B (RULES 4d). Still open: melody too on-beat and even (RULES 4d critique; ask before changing it, the owner likes the flute line); breaths before the mukhda are inaudible (make them an arrangement drop, not just a fader dip); low-mids still thinner than the references.
- **Preference log**: `feedback/feedback.jsonl` has 1 owner choice. Use `tools/feedback.py snapshot/pair/log` on every revision the owner judges; `report` after 20+ choices.
- **Samples added 2026-10-21:** Iowa MIS (26 zones: solo strings and pizz, horn/trumpet/trombone/tuba, flutes incl. alto, bass and non-vibrato, oboe, clarinets, bassoon, soprano/alto sax, bowed vibes, marimba, crotales, Thai gong) and Philharmonia (mandolin, guitar, banjo, cor anglais, `phil_perc` kit). Facts in RULES §4e; listening test `pieces/sample-tour.mjs` (owner has not heard it yet). No piece uses them yet.
- **Samples still to add** (docs/research-roadmap.md §3): Freesound CC0 Indian kit (tabla strokes, tanpura), CC0 ambience for videos. Avoid Splice loops (Content ID).
- **Future Lab** (`pieces/future-lab.mjs`, 2026-10-22): owner kept every preset; next is a full western / futuristic piece built on `tools/lib/palette.mjs`.
- **Deep Desert** (`pieces/deep-desert.mjs`, 2026-10-22): owner's Dune idea. References `refs/dune-*` (RULES 4g); Dune presets (`eCello`, `warHorn`, `duduk*` + `dudukGlide`, `voxPad`/`voxWail`, `subDrone`, `subPulse`) auditioned in `pieces/dune-lab.mjs`. Review 1: 6/10, "generic, predictable framing"; version B reworks the form (RULES 4g). **A/B pair `work/ab/deep-desert.{A,B}.mp3` awaiting the owner's pick:** `feedback.py log deep-desert A|B|same "note"`.
- Embeddings: Sandhya is the closest of our pieces to the Hindi references but outside their cluster (RULES 4d); Intro and Outro drift most.
- Copying guard: match every voice of the Demucs "other" MIDI, not just its skyline (RULES 4d; Demucs catches 76 % of the City Lights trumpet). RoFormer separation does not work here: keep Demucs.
- **Sampler clamp warning fires in six older pieces** (all but golden-hour): fix each when it is next revised (lower `sampler.level`, raise group `volume`).
- Open owner decisions: recreate the GitHub repo to free 615 MB of old LFS storage (history already rewritten); lower the maximizer ceiling on the loud pieces.
- A stray `node --test tests/comment-attachment-upload.test.js` process from another project was running on the machine; not ours.

## Next research-backed steps

See [docs/research-roadmap.md](docs/research-roadmap.md): sfizz pilot (SFZ + pitch-bend meend), OpenAIR convolution reverb, Iowa MIS / Philharmonia samples, Freesound CC0 Indian kit, Surge XT via DawDreamer, a focus-music profile.

## Working agreements

- Every musical decision lives in the generator; renders are reproducible (seeded humanisation).
- Measure before asking for a listen; report numbers honestly.
- Commit to `main` with the attribution line from the session; push when the owner asks. Generators and docs in git; audio in R2.
