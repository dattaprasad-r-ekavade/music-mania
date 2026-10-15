# Music

15 October 2026. How Super Cricket's music is made, what we've learned about the tools, and the rules for ownership. Read this before adding or changing a track.

## 1. Status

| Track | File | State |
| --- | --- | --- |
| Title / menu theme | `assets/audio/music/title-theme.wav` (+ `.scraft` session) | First draft, owner approved by ear ("epic"). Written and rendered by Claude; no human melodic input yet (see §6) |
| In-match bed | — | Planned: quieter loop that sits under crowd ambience |
| Stings | — | Planned: four, six, wicket, fifty/hundred, innings break |
| Victory / defeat | — | Planned |

Nothing in `assets/audio/` is committed yet.

## 2. Tool: SoundCraft

- **What it is:** an open-source desktop DAW (a clean-room reimplementation of a Pro Tools-style workflow, written in Rust). Installed version **0.7.0** at `C:\Program Files\SoundCraft\` (`soundcraft.exe` app, `soundcraft-cli.exe` command line).
- **Licence:** MIT OR Apache-2.0 (stated in the installed exe's file properties and in the [source repository](https://github.com/storytold/soundcraft)). The licence covers the software, not what you make with it, and puts no conditions or royalties on our music. The project states its 27 built-in plugins are original and it ships no third-party samples.
- **Publisher check:** both executables carry a valid Authenticode signature from *Learning Machines Inc, Atlanta, Georgia*; the public project credits the "ArtCraft team" (GitHub org `storytold`). Unofficial mirrors exist (SourceForge, a `soundcraft-app` GitHub repo). **Update only from the official GitHub releases.**
- **Built-in instruments:** `subtractive_synth` (2 oscillators, filter, amp/filter envelopes, glide), `drum_synth` (kick, snare, hats, toms, cymbal), `sampler`.
- **Built-in effects:** EQ (1- and 7-band), compressor/limiter, expander/gate, de-esser, maximizer, channel strip, room and plate reverb, mod delay, chorus, flanger, phaser, saturator, lo-fi, rectifier, pitch shifter, and utility plugins.
- **Not used:** the paid AI mixing assistant and Craft credits. The sampler (to avoid third-party audio).

## 3. Automation setup

**MCP server.** `soundcraft-cli mcp` is an MCP server on stdio. It's registered for this project in Claude Code's *local* scope (private to this machine, not in the repo):

```
claude mcp add soundcraft --scope local -- "C:\Program Files\SoundCraft\soundcraft-cli.exe" mcp \
  --automation-read-root D:\Projects\super-cricket\assets\audio \
  --automation-write-root D:\Projects\super-cricket\assets\audio
```

The two roots confine every file the agent opens, saves or bounces to `assets/audio/`. Status: *Connected*. MCP tools load in a new Claude Code session. `soundcraft-cli mcp --connect PORT` drives a running app instead (it can't be combined with the roots).

**Script mode** (what we used, works without MCP): `soundcraft-cli script FILE --save S.scraft --bounce OUT.wav`, one `command-id JSON` per line. Other useful commands: `commands [filter]`, `describe ID`, `run --cmd ID=JSON …`, `info FILE`.

## 4. Command facts learned (verified by probing)

| Fact | Detail |
| --- | --- |
| **Ticks per beat = 960** | Not 480, even though `midi.note_add`'s default length is 480. Measured: a note at tick 1920 at 120 BPM starts at 1.000 s. Our first render used 480 and played the whole piece in half the time, leaving bars 9–16 silent. |
| Positions | Bar\|beat\|tick strings (`"1|1|000"` = session start, `"17|1|000"` = after 16 bars), or plain numbers = samples at 48 kHz. `"2 bars"`, `"4s"` and `{bars:2}` are rejected. |
| IDs | `track.new` returns track ids 1, 2, 3… in creation order; clips created afterwards get the next ids. Create all tracks first, then all clips, and the ids are predictable. |
| Notes | `midi.note_add {clip, pitch, start_ticks, length_ticks, velocity}`; `start_ticks` is relative to the clip start. |
| Instruments | `track.new {kind:"instrument", name, instrument}`, then `mix.instrument {track, plugin, params}` (unknown parameter ids are errors; values are clamped). |
| Effects | `mix.insert {track, slot 0–9, plugin, params}`. |
| Drum synth notes | General MIDI mapping works: 36 kick, 38 snare, 42 closed hat, 46 open hat, 45/50 low/high tom, 49 crash. |
| Mix | `mix.volume {tracks, db}`, `mix.pan {tracks, pan}`; `event.tempo {bpm}`. |
| Output | `--bounce` writes 48 kHz / 24-bit stereo WAV and prints LUFS, peak and true peak. |

## 5. Process for a track

1. **Brief.** Purpose (menu, in-match, sting), length, loop or one-shot, mood, tempo, key.
2. **Compose in a generator script** under `tools/music/<track>.mjs`. It holds every musical decision as data: chord progression, melody, bass, drum patterns, instrument settings, effects. It writes a SoundCraft script to `assets/audio/work/<track>.txt` (generated, don't commit).
3. **Render:** `soundcraft-cli script assets/audio/work/<track>.txt --save assets/audio/music/<track>.scraft --bounce assets/audio/music/<track>.wav`.
4. **Check by measurement** (Claude can't hear the audio): RMS, low-band and high-band energy, and peak per bar, plus the level at the loop point. This catches silence, timing errors, clipping and a section that doesn't build.
5. **Human listening review** by the owner. Changes go back into the generator, not the session, so the track stays reproducible.
6. **Record origin** in `assets/ASSET-ORIGINS.md` (§7) and commit the generator, `.scraft` and `.wav` together.

## 6. Title theme: what we made

- **Brief:** upbeat, broadcast-anthem title/menu loop with a light Indian touch.
- **Form:** 128 BPM, D major, 16 bars = 30.0 s, loops back to bar 1.

| Bars | Content |
| --- | --- |
| 1–4 | Intro: pad and 16th-note arpeggio; kick, hats and bass enter from bar 3; snare roll into bar 5 |
| 5–12 | Theme: lead melody over D–A–Bm–G / D–A–G–A, driving 8th-note bass with octave pops, full drum groove, crash on bar 5 |
| 13–16 | Lift: higher melody over Bm–G–D–A, crash, dhol-style tom groove ("dha–na" pattern on low and high toms), fill into the loop |

- **Instruments:** Lead (saw + square, detuned, glide; dotted-8th delay and plate reverb), Pad (two detuned saws, slow attack; chorus and plate reverb), Bass (square + saw an octave down; saturator), Arp (square + triangle; 16th delay, panned left), Drums (drum synth; compressor and room reverb), Dhol (drum synth toms; room reverb, panned right).
- **Measured result:** −20.5 LUFS integrated, peak −1.8 dB, no clipping. Per-bar RMS: intro −35 → −24 dB, theme about −22 dB, lift about −20.5 dB. The intended build is present.
- **Iteration log:** render 1 used 480 ticks per beat and was silent after bar 9; we measured the real resolution (960) with a one-note probe and fixed the generator. Render 2 is the current file.
- **Owner feedback:** "holy smokes, that was some epic music".
- **Open:** the loop seam cuts reverb and delay tails; for seamless in-game looping, render one extra bar and crossfade, or bounce with tails and loop from bar 1 in the audio engine.

## 7. Copyright and ownership

General information, not legal advice. Get a short consultation with an Indian IP lawyer before a commercial release.

**What went into the title theme.** Every note, chord, rhythm and sound setting was written by Claude in `tools/music/title-theme.mjs`. No SoundCraft templates, presets, demo material, samples or loops were used; the session started empty and used only built-in synthesis. The chord progression (I–V–vi–IV family) is a common pop progression and isn't protected. The melody is original, but nobody can guarantee a short, simple melody resembles nothing existing; have a listener with a good ear check before release.

**Use rights.** We can use the track freely: SoundCraft's licence claims nothing over output, and Anthropic's terms assign output rights to the user.

**Copyright protection** is a separate question: whether *we* could stop someone else copying it.

- **United States** (Copyright Office, *Copyright and Artificial Intelligence, Part 2*, January 2025): copyright needs human authorship. Prompts alone aren't enough. Human creative modifications, or creative selection and arrangement of AI material, are protected at a "minimal creativity" bar, **but only those human parts**; AI-made material must be disclaimed when registering. Human material that is perceptible in the output (for example, a melody a person hummed or played) is protected. Decided case by case; no percentage rule.
- **India:** the Copyright Act, s. 2(d)(vi), makes the author of a computer-generated work "the person who causes the work to be created", which arguably points to the user. No court has tested this for generative AI. DPIIT's December 2025 working paper covered training data only; its part on AI outputs and authorship hasn't been published yet.
- **Title theme today:** the owner gave the brief and approved the result, so under the US approach it is probably **not copyrightable**. Practical risk for game background music is low; the risk is only that others could copy it.

**Process for tracks we want to own:**

1. The owner supplies the core musical idea: a melody or rhythm hummed (voice memo, transcribed by Claude), played (MIDI keyboard into SoundCraft), or written as changes to a generator.
2. Claude arranges: harmony, drums, instruments, mix.
3. The owner makes real creative choices during iteration (rewrites phrases, changes sections, adds parts), not only picks between options.
4. Keep the evidence: the owner's contributions as separate commits under their name, and an origin entry per track.

**Origin record** (`assets/ASSET-ORIGINS.md`, one entry per track):

```
title-theme.wav / title-theme.scraft
  Made: 2026-10-15
  Composition and arrangement: Claude (Opus 5.5), via tools/music/title-theme.mjs
  Human input: brief and approval by the project owner; no human melodic or arrangement contribution yet
  Tools: SoundCraft 0.7.0 (MIT OR Apache-2.0), built-in subtractive_synth and drum_synth only
  Third-party material: none (no samples, presets, templates or demo content)
```

## 8. Next

1. Create `assets/ASSET-ORIGINS.md` with the entry above; add `assets/audio/work/` to `.gitignore`.
2. Fix the loop seam (§6, Open).
3. In-match bed, then stings (four, six, wicket, milestone, innings break), then victory/defeat. Stings should share the title theme's key and motif so the game sounds like one score.
4. Wire music into the game (title screen, between overs, events from the match event bus) with volume and mute in settings.
5. Try the owner-melody workflow (§7) on one track.

## Sources

- [SoundCraft source repository](https://github.com/storytold/soundcraft) and [soundcraft.run](https://soundcraft.run/)
- [U.S. Copyright Office, Part 2 report announcement](https://newsroom.loc.gov/news/copyright-office-releases-part-2-of-artificial-intelligence-report/s/f3959c36-d616-498d-b8f9-67641fd18bab); summaries by [Jones Day](https://www.jonesday.com/en/insights/2025/02/copyrightability-of-ai-outputs-us-copyright-office-analyzes-human-authorship-requirement) and [Crowell](https://www.crowell.com/en/insights/client-alerts/us-copyright-office-releases-part-2-of-artificial-intelligence-report-clarifying-copyrightability-of-generative-ai-outputs)
- [DPIIT Working Paper on Generative AI and Copyright](https://www.dpiit.gov.in/static/uploads/2025/12/ff266bbeed10c48e3479c941484f3525.pdf); [Chambers AI & IP 2026: India](https://practiceguides.chambers.com/practice-guides/ai-intellectual-property-2026/india)
