# Sample libraries (not in git)

Audio lives on disk here but is **not committed**. Licences and how we credit them: [CREDITS.md](../CREDITS.md). After a clone, download both libraries into these folders, then rebuild the zone map:

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
