# Credits and origins

## Sample libraries

**Salamander Grand Piano V3** by Alexander Holm (Yamaha C5, 48 kHz/24-bit), SFZ remap by kinwie.
Licence: Creative Commons Attribution 3.0 Unported. Commercial use allowed **with credit**.
Source: https://github.com/sfzinstruments/SalamanderGrandPiano (original: https://archive.org/details/SalamanderGrandPianoV3)

**VS Chamber Orchestra: Community Edition (VSCO 2 CE)** by Versilian Studios (Sam Gossner) and Simon Dalzell (Ivy Audio).
Licence: CC0 1.0 (public domain). The readme asks us not to sell the samples directly, and to credit Versilian Studios/Sam Gossner and Simon Dalzell with a link to http://vis.versilstudios.net/vsco-community.html.
Source: https://github.com/sgossner/VSCO-2-CE

Credit line for releases (YouTube descriptions, album notes, licence documents):

> Piano: Salamander Grand Piano by Alexander Holm (CC BY 3.0). Orchestral samples: VSCO 2 Community Edition by Versilian Studios and Simon Dalzell.

## Track origins

```
golden-hour.wav
  Made: 2026-10-15
  Composition and arrangement: Claude (Opus 5.5), via pieces/golden-hour.mjs (original melody and harmony)
  Human input: brief by the owner; no human melodic or arrangement contribution yet
  Tools: SoundCraft 0.7.0 (MIT OR Apache-2.0), built-in sampler, EQ, plate reverb, maximizer
  Third-party material: the sample libraries above, played as instruments; no loops, presets or existing compositions
```

```
duniya-gol-hai.wav  (song: Golden Hour instrumental + Hindi vocal)
  Made: 2026-10-16
  Lyrics (Hindi) and vocal melody fitting: Claude (Opus 5.5), pieces/duniya-gol-hai.json
  Voice: the owner's own voice clone on ElevenLabs (model eleven_v4), owner holds 100% rights;
         spoken lines turned into singing by tools/sing.py (Praat PSOLA pitch and timing)
  Instrumental: golden-hour (see above)
  Human input: brief ("absurdist satirical Hindi song"), the owner's voice
  Mix offsets: vocal_db +12, Piano grp −2.5, Violins grp +7.5, octave_shift −12
```
