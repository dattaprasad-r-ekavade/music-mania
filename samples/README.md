# Sample libraries (not in git)

Audio is **not committed**. Licences and how we credit them: [CREDITS.md](../CREDITS.md).

The libraries are mirrored in the project's private Cloudflare R2 bucket (`samples/salamander/`, `samples/vsco2/`, `samples/vcsl/`, `samples/iowa/`, `samples/philharmonia/`). `tools/render.mjs` downloads only the files a piece uses, so this folder is a cache: `node tools/assets.mjs prune` empties it (only for folders R2 holds in full), `node tools/assets.mjs pull samples/vsco2/Strings/` fetches a whole folder, and `node tools/assets.mjs mirror OWNER/REPO samples/<name>` adds a library from GitHub without using local disk.

Without R2 access, clone the libraries from GitHub into these folders as below. To rebuild the zone map:

```
python -I tools/zones.py
```

That writes `samples/zones.json` (the zone map *is* in git, so you only need this when samples change).

## Salamander Grand Piano V3

CC BY 3.0, Alexander Holm. Clone into `samples/salamander/` so that `samples/salamander/Samples/*.flac` and `samples/salamander/Data/` exist:

https://github.com/sfzinstruments/SalamanderGrandPiano

## VS Chamber Orchestra 2 Community Edition

CC0 1.0, Versilian Studios / Sam Gossner and Simon Dalzell. They ask that the samples not be sold as samples. Clone into `samples/vsco2/`:

https://github.com/sgossner/VSCO-2-CE

We use a subset. A sparse clone is enough: `Strings/` (violin, viola, cello sections; harp), `Woodwinds/Flute`, `Woodwinds/Clarinet`, `Woodwinds/Oboe`, `Brass/F Horn`, `Brass/Tenor Trombone`, `Brass/Trumpet`, `Brass/Tuba`, `Percussion/Glock`, `Percussion/Marimba`, `Percussion/Xylo`, `Percussion/Timpani` and the one-shots directly in `Percussion/`.

## University of Iowa MIS (post-2012 set)

No restrictions. One note per file, chromatic, ff, 24-bit AIFF, solo and dry. `python -I tools/fetch_samples.py iowa` downloads all 2374 files (about 2.5 GB) into `samples/iowa/<Family>/<Instrument>/`.

Zones: `horns_iowa`, `trumpet_iowa`, `trombone_iowa`, `tuba_iowa`, `flute_iowa`, `flute_plain`, `alto_flute`, `bass_flute`, `oboe_iowa`, `clarinet_iowa`, `bass_clarinet`, `bassoon`, `soprano_sax`, `alto_sax`, `violin_solo`, `viola_solo`, `cello_solo`, `bass_arco`, `violin_solo_pizz`, `cello_solo_pizz`, `bass_pizz`, `vibes_bow`, `marimba_yarn`, `marimba_roll`, `crotales`, `thai_gong`.

## Philharmonia Orchestra samples

Free in our own music; never pass the samples on. MP3, mostly short notes (0.25-1.5 s) at several dynamics. `python -I tools/fetch_samples.py philharmonia` downloads the official archive (about 230 MB) and unpacks it into `samples/philharmonia/<instrument>/`.

Zones: `mandolin`, `mandolin_trem`, `guitar`, `banjo`, `cor_anglais`, and the `phil_perc` kit (keys 60-83: hand cymbals, djembe, surdo, djundjun, tom, agogo, castanets, cowbell, guiro, cabasa, woodblock, tambourine, sleigh bells, triangle, bell tree, wind chimes, Thai gong, tam-tam, snare, bass drum, clash cymbals, cymbal swell, whip; the key list is in `tools/zones.py`).

Levels, timing and pitch notes for both: RULES.md §4e.
