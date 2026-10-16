# Sample libraries (not in git)

Audio is **not committed**. Licences and how we credit them: [CREDITS.md](../CREDITS.md).

The libraries are mirrored in the project's private Cloudflare R2 bucket (`samples/salamander/`, `samples/vsco2/`, `samples/vcsl/`). `tools/render.mjs` downloads only the files a piece uses, so this folder is a cache: `node tools/assets.mjs prune` empties it (only for folders R2 holds in full), `node tools/assets.mjs pull samples/vsco2/Strings/` fetches a whole folder, and `node tools/assets.mjs mirror OWNER/REPO samples/<name>` adds a library from GitHub without using local disk.

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
