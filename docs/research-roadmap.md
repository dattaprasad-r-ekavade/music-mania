# Research notes and roadmap (2026-10-16)

Research only: nothing here is built yet. Each item says how it would fit the pipeline and what to check first. Claims marked **(unverified)** came from secondary sources.

## 1. Music for focus and productivity

| Finding | Evidence | Use for us |
| --- | --- | --- |
| Lyrics consistently hurt reading, memory and language tasks; instrumental music has a small effect (people wrongly believe it helps) | Strong: 2022 systematic review (Cheah et al., *Music & Science*), 2024 DZNE study | Focus tracks are instrumental only; avoid voice-like leads |
| Background music hurts difficult tasks, not easy ones; introverts more than extraverts | Moderate: same review; learning meta-analysis | Two variants: "deep work" (sparse, simple) and "light work" (more groove) |
| Changing-state sound distracts more than steady-state: staccato and unpredictable sequences disrupt memory more than legato and predictable ones | Strong for sound in general; a few music studies (APMB 2018, Schweppe & Knigge 2020) | Legato leads, few accents, repetition, gradual 2-4 bar transitions |
| Tempo: studies disagree (fast/positive vs slow) | Mixed | Moderate 60-90 BPM; no strong rule |
| 12-20 Hz amplitude modulation improved sustained attention in listeners with ADHD symptoms; reportedly slightly impaired others | One study (Northeastern MIND Lab with Brain.fm, *Communications Biology* 2024) seen only through company blogs **(unverified)** | Optional "ADHD focus" edition only, labelled experimental, after reading the paper |
| Binaural beats | Mixed: 2019 meta-analysis g = 0.45; later reviews doubt the entrainment mechanism | Low priority; headphones only; make no claims |

**Focus profile to add to RULES when we build one:** instrumental; legato lead; per-bar level change well under the JUMP threshold; no surprise hits or key changes; high motif repetition (`critique.mjs`); 30-60 minute seamless loops (see the loop-seam item in music.md). Closest current pieces: Golden Hour, Pahadi Winter, Spring Dream. Sandhya and Mass Entry are listening pieces, not focus pieces. Word channel descriptions carefully: effects are small and individual.

## 2. Rendering and sound tooling

| Tool | What it gives | Fit | Check first |
| --- | --- | --- | --- |
| **sfizz_render** (sfizz 1.2.3) | SFZ instrument + MIDI → WAV, headless (`--sfz --midi --wav`, `-s`, `-q`, `-p`, `--use-eot`) | **Highest value.** VSCO/VCSL ship SFZ patches with velocity layers, round robins, keyswitched articulations; one render per instrument instead of a SoundCraft track per sample zone. SFZ pitch bend gives real meend/gamaka | Whether the Windows build ships `sfizz_render` (unverified); the standalone sfizz-render repo is archived |
| **DawDreamer** (GPLv3, pip, Windows supported) | Python audio graph: VST instruments/effects, Faust DSP, parameter automation, headless render | Free VST synths/effects and pitch bends from code | Version and maintenance (0.6.5 seen) |
| **Spotify Pedalboard** | Python effects incl. convolution reverb, compressor, limiter; hosts VST3 | Real-room reverb and mastering next to our measurements | Current VST3-instrument support |
| **Surge XT** (open source) | Rich synth; CLI since 1.3; `surgepy` Python bindings (build from source) | Better pads, bass and leads for City Lights / Neon Bhairav styles | Easiest via Pedalboard or DawDreamer |
| **OpenAIR impulse responses** (University of York) | Measured halls, e.g. Jack Lyons Concert Hall (CC BY 4.0, B-format) | Convolution reverb on dry samples instead of the plate | Licence per file (some non-commercial); credit in CREDITS.md |
| **Freesound API** (freesound-python) | Search filtered by licence (`license:"Creative Commons 0"`) | Free Indian percussion/drone one-shots | API key; full-quality download needs OAuth (else 128 kbps previews) |

Already evaluated and rejected (RULES 4d): RoFormer separation via audio-separator 0.47 (silent stems on torch 2.10 CPU; ~7x real time), fadtk (needs numpy<2), `laion/larger_clap_music` (broken HF conversion), MIDI-LLM (16 GB GPU), Essentia models (Linux wheels, unclear model licence).

## 3. Sample sources

| Library | Licence | Use |
| --- | --- | --- |
| **University of Iowa MIS** | Free for any project, no restrictions stated | 23 orchestral instruments, dry (anechoic): ideal with convolution reverb; fill VSCO gaps |
| **Philharmonia Orchestra samples** | Free incl. commercial works; not to be sold/shared as samples (same terms we follow for VSCO). A CC BY-SA 3.0 claim on third-party pages is **(unverified)** | All orchestral instruments plus guitar, mandolin, banjo, much percussion; many short articulations; GitHub mirror skratchdot/philharmonia-samples |
| **Sonatina Symphonic Orchestra** | CC Sampling Plus 1.0 (read terms) | Older 16-bit SFZ; low priority |
| **VCSL** (have) | CC0 | VCSL 2 is being crowdfunded |
| **Indian instruments** | No verified CC library found. Lost Stories Academy packs, SampleScience "Sounds of India", Rajan Somasundaram percussion: "free/royalty-free" claims **(unverified)** | Freesound CC0 is the safe free route; recording a real bansuri/tabla player is best for sound and ownership |

## 4. Suggested order

1. sfizz pilot: VSCO flute SFZ with pitch-bend meend vs the current flute (`embed.py`, `visualize.py`, then a listen).
2. OpenAIR concert-hall convolution on Golden Hour through Pedalboard vs the plate.
3. Iowa MIS solo instruments into `zones.py`.
4. Freesound CC0 Indian percussion and drone kit (needs an API key).
5. Surge XT through DawDreamer for the synth pieces.
6. Focus profile and a deep-work variant of one existing piece.

## 5. Understanding music with AI (2026-10-21)

The agent cannot take audio in; it hears through measurements, images (`visualize.py`) and models that listen for it.

| Approach | State of the art | Use for us |
| --- | --- | --- |
| Audio-language models that describe music | Music Flamingo (NVIDIA, ICLR 2026): music-specialised captions and Q&A (human rating 8.3/10; self-reported best on 10+ benchmarks) but **non-commercial licence** and datacenter GPUs. Qwen2-Audio, LLark: general / older. Gemini API audio: describe, summarise, emotion, timestamped questions | Optional critic via Gemini (API key, paid): ask what it hears vs our intent. All of these hallucinate (HalluAudio benchmark): use for mismatches, not verdicts |
| Learned quality scores | **Audiobox Aesthetics** (Meta, CC-BY 4.0): CE / CU / PC / PQ without a reference. SongEval (2025): coherence, memorability, structure clarity, musicality, trained on sung songs | **Built:** `tools/aesthetics.py`, `render.mjs --aes`. Calibration in RULES 4d: compressed scale, < 0.2 is noise |
| Symbolic reasoning by LLMs | ABC-Eval (2025) and MSU-Bench (2025): leading LLMs have clear limits on scores; ChatMusician beats GPT-3.5 on theory but leans Irish and hallucinates | Keep theory as code checks (critique.mjs, raga.mjs, similarity.py), not free reasoning |
| Learning from human preference | MusicRL (Google, ICML 2024): ~300k preference pairs improved a generator; prompt fit and audio quality explain only part of preference | **Built:** `tools/feedback.py` A/B log (`feedback/feedback.jsonl`, committed) and `report`: after 20-50 owner choices, keep the metrics that predict the owner |

Next: collect A/B choices on each revision; optionally a Gemini audio critic; revisit Music Flamingo only for private research.

Sources: [Music Flamingo](https://proceedings.iclr.cc/paper_files/paper/2026/hash/7f64034009f4a5fa417a57e1a987c5cd-Abstract-Conference.html) ([model card](https://huggingface.co/nvidia/music-flamingo-hf)), [MuChoMusic](https://arxiv.org/pdf/2408.01337), [HalluAudio](https://arxiv.org/pdf/2604.19300), [Gemini audio](https://ai.google.dev/gemini-api/docs/generate-content/audio), [Audiobox Aesthetics](https://arxiv.org/html/2502.05139v1), [Cyanite review](https://cyanite.ai/tag/music-industry/page/2), [SongEval](https://arxiv.org/pdf/2505.10793), [ABC-Eval](https://arxiv.org/html/2509.23350v1), [MSU-Bench](https://arxiv.org/abs/2511.20697v1), [MusicRL](https://proceedings.mlr.press/v235/cideron24a.html).

## Sources

Productivity: [Cheah et al. review](https://livrepository.liverpool.ac.uk/3126302/), [cognitive task review](https://livrepository.liverpool.ac.uk/3166444/), [DZNE 2024](https://pub.dzne.de/record/272336), [Journal of Cognition](https://journalofcognition.org/articles/273), [PMC10162369](https://pmc.ncbi.nlm.nih.gov/articles/PMC10162369/), [Thompson et al. 2012](https://sites.utm.utoronto.ca/sites/sites.utm.utoronto.ca.glenn_website/files/download/ThompsonEtAl2012.pdf), [APMB 2018](https://riviste.unime.it/index.php/APMB/article/view/APMB.106.1.2018.OS1), [PMC7381464](https://pmc.ncbi.nlm.nih.gov/articles/PMC7381464), [PMC7066211](https://pmc.ncbi.nlm.nih.gov/articles/PMC7066211), [Brain.fm blog](https://www.brain.fm/blog/does-brain-fm-actually-work), [binaural meta-analysis](https://pubmed.ncbi.nlm.nih.gov/35842538/), [PopSci](https://www.popsci.com/science/do-binaural-beats-work-focus/).

Tooling: [sfizz_render](https://man.archlinux.org/man/sfizz_render.1.en), [DawDreamer](https://GitHub.com/DBraun/DawDreamer) ([paper](https://arxiv.org/abs/2111.09931)), [Surge](https://github.com/surge-synthesizer/surge) ([1.3 CLI](https://cdm.link/2023/12/free-surge-xt-1-3/), [jird surgepy](https://jird.readthedocs.io/en/stable/surge.html)), [OpenAIR](https://www.openair.hosted.york.ac.uk/?page_id=2) ([Jack Lyons](https://www.openair.hosted.york.ac.uk/?p=571)), [freesound-python](https://github.com/pythonthings/freesound-python), [CC Freesound intro](https://opensource.creativecommons.org/blog/entries/freesound-intro/).

Samples: [Iowa MIS](https://theremin.music.uiowa.edu/MIS.html), [Philharmonia](https://philharmonia.co.uk/audio-sound-samples/) ([mirror](https://github.com/skratchdot/philharmonia-samples/)), [Sonatina](https://www.synthtopia.com/content/2011/01/31/free-creative-commons-orchestral-sample-library-sonatina-symphonic-orchestra/), [VCSL](https://versilian-studios.com/vcsl/), [Indian libraries list](https://loststoriesacademy.com/blogs-and-tutorials/7-sample-libraries-for-indian-instruments-free-paid-in-2025).
