# Indian music theory for the pipeline (Hindustani and Hindi film)

Rules and tables a composition program can follow. The machine-readable version is `tools/lib/raga.mjs` (`RAGAS`, `TAALS`, `GROOVES`, `FILLS`, and helpers). Facts come from the sources at the end. **(?)** marks places where sources disagree or where something is our own stylisation rather than documented practice. Film-song titles are listed only to orient listening. Per RULES.md 4c, take a raga's grammar, never a song's melody.

## 0. Notation

| Degree | 0 | 1 | 2 | 3 | 4 | 5 | 6 | 7 | 8 | 9 | 10 | 11 | 12 |
|---|---|---|---|---|---|---|---|---|---|---|---|---|---|
| Sargam | S | r | R | g | G | m | M | P | d | D | n | N | S' |
| Name | Sa | komal Re | Re | komal Ga | Ga | Ma | tivra Ma | Pa | komal Dha | Dha | komal Ni | Ni | taar Sa |

Lower-case means komal (flat). `M` is tivra (sharp) Ma. A `.` after a swara puts it in the lower octave (mandra: `N.` = -1) and `'` puts it in the upper octave (taar: `S'` = 12). `sw("N. R G")` returns `[-1, 2, 4]`. `sargam("N. R G", 62)` returns MIDI notes for Sa = D4.

Terms:
- **Thaat**: Bhatkhande's parent scale (10 in all).
- **Aroha / avaroha**: the ascent and descent. They can use different notes, and they can be *vakra* (zig-zag).
- **Vadi / samvadi**: the most important note and its consonant partner, usually a 4th or 5th apart. Modern writers treat this pair as approximate (see the Bhairavi source).
- **Pakad / chalan**: the catch phrase and the typical movement. A raga is recognised by these phrases, not by its scale.
- **Nyas**: the resting notes where phrases end.
- **Varjit**: omitted swaras.
- **Alpa** (`weak` in the module): passing notes you do not dwell on.

## 1. Raga rules for a program

1. **Pick the raga by mood and time, then fix Sa** (a 5th of the drone and of the lead's range matter more than "key").
2. **Use only `degrees`**. Use `colour` notes only as short touches, under one beat, never at a phrase end.
3. **Respect direction.** A note missing from the aroha can be used only while descending, and the reverse for the avaroha. Bhimpalasi R and D, Khamaj and Desh n, and Desh G and D in ascent are the common traps. Turns that the raga's own lines take (vakra) are allowed. `checkPhrase()` learns those turns from the aroha, avaroha and pakad.
4. **Build phrases from the pakad.** Each section should state a pakad-shaped movement within its first 2 bars. Vary rhythm and octave, and keep the contour.
5. **End phrases on nyas notes.** End the song or section on Sa, or on the vadi. The vadi gets long notes and strong beats.
6. **Do not hold `weak` notes** for a beat or more.
7. **Register follows the raga.** Darbari, Malkauns and Pahadi live low, with mandra D and P. Yaman and Bhupali rise freely to taar Sa.
8. **Ornament per raga** (section 2). Darbari, Malkauns and Bhairav need slow andolan on their komal notes. Thumri ragas (Khamaj, Kafi, Bhairavi, Pahadi, Desh) want murki and khatka.
9. **Run `checkBarsRaga(raga, bars, saMidi)`** on every melody array. Fix `varjit` and `outside` warnings. Treat `aroha`, `avaroha` and `weak` as review notes.

## 2. Ragas

Degrees are semitones from Sa. Aroha and avaroha use sargam letters.

| Raga | Thaat | Degrees | Aroha | Avaroha | Vadi / Samvadi | Nyas | Time / mood |
|---|---|---|---|---|---|---|---|
| Yaman | Kalyan | 0 2 4 6 7 9 11 | N. R G M P D N S' (S and P often skipped going up) | S' N D P M G R S | G / N | R G P N | early night; serene, romantic, auspicious |
| Bhairavi | Bhairavi | 0 1 3 5 7 8 10 | S r g m P d n S' | S' n d P m g r S | m / S (?) (also given as P / S) | S m P g | morning, and the concert closer; devotional, pathos |
| Kafi | Kafi | 0 2 3 5 7 9 10 | S R g m P D n S' | S' n D P m g R S | P / R (?) | R P S | night; playful, Hori, folk |
| Khamaj | Khamaj | 0 2 4 5 7 9 10 11 | S G m P D N S' | S' n D P m G R S | G / N | G P S | night; romantic, light (thumri) |
| Pahadi | Bilawal (core is S R G P D) | 0 2 4 5 7 9 10 | P. D. S R G P D S' | S' n D P m G R S D. P. | G / D (?) | S G P D. | any; longing, nostalgia, hills |
| Desh | Khamaj | 0 2 4 5 7 9 10 11 | N. S R m P N S' | S' n D P D m G R G N. S | R / P | R P S | night, monsoon; yearning |
| Bhimpalasi | Kafi | 0 2 3 5 7 9 10 | n. S g m P n S' | S' n D P m g R S | m / S | m (main), P, S | early afternoon; tender longing |
| Darbari Kanada | Asavari | 0 2 3 5 7 8 10 | n. S R g m P d n S' | S' d n P m P g m R S | R / P | R P S d. | midnight; grave, majestic |
| Bhupali | Kalyan | 0 2 4 7 9 | S R G P D S' | S' D P G R S | G / D | S G P | early night; peaceful, devotional |
| Durga | Bilawal | 0 2 5 7 9 | S R m P D S' | S' D P m R S | m / S | S m D (not P in descent) | night; romantic, bright |
| Shivranjani | Kafi | 0 2 3 7 9 | S R g P D S' | S' D P g R S | P / S (?) | S g P | night; pathos, separation |
| Kirwani | none (harmonic minor) | 0 2 3 5 7 8 11 | S R g m P d N S' | S' N d P m g R S | no strict pair (R g P d important) | R g P | midnight; romantic pathos |
| Charukeshi | none (Carnatic mela 26) | 0 2 4 5 7 8 10 | S R G m P d n S' | S' n d P m G R S | P / S (?) | G P S | any; poignant, bittersweet |
| Malkauns | Bhairavi | 0 3 5 8 10 | n. S g m d n S' | S' n d m g m g S | m / S | S m g | 12 to 3 am; meditative, heavy |
| Bhairav | Bhairav | 0 1 4 5 7 8 11 | S r G m P d N S' | S' N d P m G r S | d / r | S m P d | dawn; solemn, devotional |
| Marwa | Marwa | 0 1 4 6 9 11 (no P) | N. r G M D N r' S' | r' N D M G r S | r / D (Patwardhan: D / G) | r D G | sunset; anxious longing |

Characteristic movements, as degree sequences (these are `pakad` in the module):

| Raga | Movements |
|---|---|
| Yaman | N. R G R S = [-1 2 4 2 0]; P M G R S = [7 6 4 2 0]; N. R G M D N S' = [-1 2 4 6 9 11 12] |
| Bhairavi | n. S g m d P = [-2 0 3 5 8 7]; g m g r S = [3 5 3 1 0]; d n S' n d P |
| Kafi | m P D P m g R = [5 7 9 7 5 3 2]; g R S; n. D. S = [-2 -3 0] |
| Khamaj | n D m P D m G = [10 9 5 7 9 5 4]; G m P D N S' (N rising) / S' n D P (n falling) |
| Pahadi | D. P. S = [-3 -5 0]; S R G P G; G R S D. = [4 2 0 -3] (dwell on low D and P) |
| Desh | R m P N S' = [2 5 7 11 12]; R' n D P = [14 10 9 7]; P D m G R (vakra); R G N. S |
| Bhimpalasi | n. S m = [-2 0 5]; P m g R S; g m P n D P (rest on m) |
| Darbari | g m R S = [3 5 2 0] (g swung from above); d. n. S R S = [-4 -2 0 2 0]; d n P m P g m R S |
| Bhupali | G R S D. S R G = [4 2 0 -3 0 2 4]; G R P G; P G D P G R S |
| Durga | R m P D; m P D; m R; S R D. S = [0 2 -3 0] |
| Shivranjani | g R S D. = [3 2 0 -3]; P D S' D P g R |
| Kirwani | d P g R S = [8 7 3 2 0]; R g m P d P; N S' N d P |
| Charukeshi | d n S' n d P = [8 10 12 10 8 7]; m G R S; G m d P |
| Malkauns | g m d m g m g S = [3 5 8 5 3 5 3 0]; n. S g m |
| Bhairav | G m d d P = [4 5 8 8 7]; G m r r S = [4 5 1 1 0] (andolan on r and d) |
| Marwa | D M G r = [9 6 4 1]; N. r G M D; D M G r N. r S (Sa only at the very end) |

Commonly cited film songs (titles only, for orientation; attributions in film music are loose):

- **Yaman**: Chandan Sa Badan, Jab Deep Jale Aana, Abhi Na Jao Chhod Kar, Ehsan Tera Hoga Mujh Par, Kabhi Kabhi Mere Dil Mein
- **Bhairavi**: Babul Mora, Laga Chunari Mein Daag, Duniya Banane Wale, Dost Dost Na Raha (forum-level sources)
- **Kafi**: Chupke Chupke Raat Din, Ye Pyar Kya Hai (Gupt), Titli, Jiya (Gunday)
- **Khamaj**: Woh Na Aayenge Palat Kar, Piya Tose Naina Lage Re, Kuch To Log Kahenge, Tere Mere Milan Ki Ye Raina
- **Pahadi**: Lag Ja Gale, Meri Aankhon Mein Bas Gaya Koi Re, Awaz De Kahan Hai, Sun Ri Sakhi Mohe Sajna Bulaye
- **Desh**: Pyar Hua Chupke Se, Agar Tum Saath Ho, Sarfaroshi Ki Tamanna, Door Koi Gaaye
- **Bhimpalasi**: Khoya Khoya Chand, Naino Mein Badra Chhaye, Aaj Mere Man Sakhi Bansuri Bajaye
- **Darbari**: O Duniya Ke Rakhwale, Tora Man Darpan Kehlaye, Jhanak Jhanak Tori Baaje Payaliya **(?)** These are from general knowledge; the Wikipedia page we read does not list them.
- **Bhupali**: Jyoti Kalash Chhalke, Pankh Hote To Ud Aati Re, Dil Hoom Hoom Kare, Dekha Ek Khwab, Neel Gagan Ki Chhaon Mein
- **Durga**: Geet Gaya Patharon Ne, Chanda Re Mori Patiya Le Ja
- **Shivranjani**: Mere Naina Sawan Bhado, Jaane Kahan Gaye Woh Din, O Mere Sanam, Karoge Yaad To
- **Kirwani**: Ka Karoon Sajni Aaye Na Balam **(?)** Other titles in online lists have wrong film credits.
- **Charukeshi**: Baiyan Na Dharo, Aaj Purani Raahon Se, Bedardi Balma Tujhko, Teri Ummeed Tera Intezaar
- **Malkauns**: Man Tarpat Hari Darshan Ko Aaj, Aadha Hai Chandrama Raat Aadhi, Chham Chham Ghunghroo Bole
- **Bhairav**: Jago Mohan Pyare, Poochho Na Kaise Maine Rain Bitayi, Mohe Bhool Gaye Saawariya
- **Marwa**: no reliable film examples found

Film practice: composers base a song "on" a raga and then borrow freely. Shuddha Ga appears in Shivranjani, all 12 notes in light Bhairavi, and shuddha Ma in Yaman (which makes Yaman Kalyan). The module's `colour` field lists the documented liberties. Anything else is "outside".

## 3. Ornaments (alankar) on sampled instruments

Our samplers have no pitch bend. Only `subtractive_synth` has `glide`. At TPB 960 and about 90 BPM, a beat is about 667 ms. A fraction `f` of 0.125 beat is about 80 ms, and a 70-tick grace note is about 50 ms.

| Ornament | What it is | Approximation | Helper | Ragas that need it |
|---|---|---|---|---|
| **Kan** | A grace note touched before the main note, which outlasts it | `melody()` `[note, grace]` with `grace` 60-90 ticks. Take the grace from the next raga note above when descending and from below when rising. It must be a raga note (or a colour note). | built in | all; essential in bansuri lines, Bhupali (N and m appear only as kan), Yaman |
| **Meend** | A smooth glide across one or more notes | Synth: `glide` on `subtractive_synth`. Samples: step through the raga notes between the two pitches in 1/8-beat notes, softer, landing on the target. Never step chromatically through varjit notes. | `meend(raga, from, to, sa, beats)` | Darbari, Malkauns, Bhairavi, Marwa, Shivranjani; all slow alap passages |
| **Andolan** | A slow sway of a note toward its lower neighbour (microtonal in reality) | Hold the note and add 2-3 short, soft dips to the lower raga note (`f` = 1/4 beat). Or use a vibrato sample layer (`flute`, `tenor_sax_vib`, `dan_tranh_vib`). | `andolan(main, lower, beats)` | Darbari (g, d), Malkauns (g, d), Bhairav (r, d), Bhairavi (r, d) |
| **Gamak** | A forceful, wide oscillation, heavier than vibrato | Fast alternation of the main note and its upper raga neighbour in 32nds, with accents, then hold | `gamak(main, upper, beats)` | Malkauns, Darbari, Bhairav taans; avoid in light ragas |
| **Murki** | A quick, light turn (upper-main-lower-main) | Three 1/8-beat notes before the held main note | `murki(main, up, low, beats)` | Khamaj, Kafi, Pahadi, Bhairavi, Desh; the 1960s playback-vocal sparkle |
| **Khatka** | A sharper cluster of 3-5 notes snapped into a note | 1/16-beat notes (about 40 ms), first one accented | `khatka([notes], main, beats)` | thumri ragas, as for murki; Bhairavi and Khamaj endings |

Rules:
- Ornament no more than about one note in four in a lead line. Leave the vadi and the final nyas plain, or give them a kan only.
- Grace and ornament notes are quieter than the main note. `melody()` already plays the grace 10 velocity lower.
- On plucked stand-ins such as Dan Tranh for santoor, do not ornament. Use double strokes (tremolo of repeated 16ths) and fast 3-note pickups instead, as RULES.md 4b does with piano.

## 4. Taal

A **matra** is a beat and a **vibhag** is a section. **Sam** (X) is beat 1, where every cycle and every tihai lands. **Tali** sections are clapped. The **khali** section is waved and played "empty", with treble-only bols and no bass resonance. A **theka** is the drummer's basic bol pattern.

| Taal | Matras | Vibhag | Tali | Khali | Theka |
|---|---|---|---|---|---|
| Keherwa | 8 | 4+4 | 1 | 5 | dha ge na ti \| na ka dhi na |
| Dadra | 6 | 3+3 | 1 | 4 | dha dhi na \| dha tin na |
| Rupak | 7 | 3+2+2 | 4, 6 | 1 (sam is khali) | tin tin na \| dhi na \| dhi na |
| Teentaal | 16 | 4+4+4+4 | 1, 5, 13 | 9 | dha dhin dhin dha \| dha dhin dhin dha \| dha tin tin ta \| ta dhin dhin dha |
| Jhaptaal | 10 | 2+3+2+3 | 1, 3, 8 | 6 | dhi na \| dhi dhi na \| ti na \| dhi dhi na |
| Deepchandi / Chanchar | 14 | 3+4+3+4 | 1, 4, 11 | 8 | dha dhin - \| dha dha tin - \| ta tin - \| dha dha dhin - |

Notes:
- Teentaal is written differently from source to source. Matra 9 is "dha" or "na", and matra 13 is "ta" or "na".
- Deepchandi as used in film and thumri is often felt as a slow 14 or a 16-beat variant. **(?)**

### Bol to stroke to key (proposed)

Strokes:
- **GE**: bass open (bayan).
- **KA**: bass closed.
- **NA**: treble rim, ringing.
- **TIN**: treble open.
- **TI** and **RA**: treble closed.
- **TUN**: treble centre.

Compound bols: `dha` = GE+NA, `dhin`/`dhi` = GE+TIN, `dhe` = GE+TI, `tirakita` = TI RA KA NA.

| Stroke | Tabla on `hand` | Dholak on `hand` | Conga on `perc` |
|---|---|---|---|
| GE | 60 darbuka 1 (peaks near 143 Hz, longest ring) | 65 large frame open | 41 tumba |
| KA | 71 muted low bongo | 66 large frame muted | 46 conga slap |
| NA | 62 darbuka 3 (rings near 740 Hz) | 67 small frame open | 45 quinto |
| TIN | 70 high bongo open | 67 | 43 conga |
| TI | 72 muted high bongo | 68 small frame muted | 47 quinto slap |
| RA | 64 darbuka 5 (brightest) | 68 | 47 |
| TUN | 69 low bongo open | 69 | 43 |
| SAM boom (added on beat 1 when it has bass) | 65 | - | - |

The tabla mapping was chosen by measuring the local darbuka samples. Darbuka strokes 2 and 4 (61 and 63) were not on disk and are unassigned. Audition the mapping and swap keys in `KEYS` if a stroke reads wrong. **(?)**

### Grids

`TAALS[name].grid` is generated from the theka by `thekaGrid()` at 2 steps per matra and `step` = TPB/4, so one matra is an eighth note. Set `Session({ beatsPerBar: taal.barBeats })` to make one bar equal one cycle, or pass `step: TPB/2` to `drums()` for a slow taal where a matra is a quarter note. Accents follow the `drums()` convention: X on sam, x on each matra, o on subdivisions.

| Taal | Steps (16ths) | Bar | Grid (tabla keys) |
|---|---|---|---|
| Keherwa | 16 | 4/4 | 60 `X.x.........x...` 62 `X...x...x.....x.` 72 `......x.........` 71 `..........x.....` 70 `............x...` 65 `X...............` |
| Dadra | 12 | 6/8 (beatsPerBar 3) | 60 `X.x...x.....` 62 `X...x.x...x.` 70 `..x.....x...` 65 `X...........` |
| Rupak | 14 | 7/8 (3.5) | 70 `X.x...x...x...` 62 `....x...x...x.` 60 `......x...x...` (no boom: sam is khali) |
| Jhaptaal | 20 | 5/4 | 60 `X...x.x.......x.x...` 70 `X...x.x.......x.x...` 62 `..x.....x...x.....x.` 72 `..........x.........` |
| Deepchandi | 28 | 7/4 | 60 `X.x...x.x...........x.x.x...` 62 `X.....x.x.....x.....x.x.....` 70 `..x.......x.....x.......x...` |
| Teentaal | 32 | two 4/4 bars | 60 `X.x.x.x.x.x.x.x.x.........x.x.x.` 62 `X.....x.x.....x.x.....x.x.....x.` 70 `..x.x.....x.x.....x.x.....x.x...` |

Film grooves (`GROOVES`). These are our stylisations, not classical notation **(?)**:
- **filmiKeherwa** is a dholak 3-3-2 groove, one 4/4 bar. 65 `X.....x.....x...`, 67 `....x.....x...x.`, 68 `..o...o.o.o...o.`, 66 `.......o.......o`. Its low head matches the 3-3-2 kick measured in Tum Hi Ho (`X.....X.x.....X.`, RULES.md 4c). Layer it with a kit kick on the same steps in modern ballads.
- **bhajan** is the bhajani keherwa "dhin dhin na ka | tin tin na ka" on dholak keys. Play it with `swing` 0.12-0.2.
- **qawwali** puts the heavy low head on matras 1 and 5, with pushes before 3 and 7. Add claps on steps 4 and 12, using any clap sound (a drum-synth clap, or 46/47 slaps). Swing 0.15. Qawwali thekas differ by source.
- **dadraFilmi** is the dholak 6/8 lilt, 12 steps.
- **Garba / dandiya** (not in the module) is dadra or keherwa at 120-140 BPM with a constant dholak eighth-note chug.

### Fills and tihai

- A **tihai** is a phrase played three times, with two equal gaps, so that its last stroke lands on sam. Length = 3p + 2g. Start it at `cycle - (3p + 2g - 1)` steps. `tihai('dha ti ra ki ta', 16)` returns `{ start: -2, grid }`, which means start 2 steps before the cycle that leads into the target sam. Use it at section ends: the last bar of the antara, going into the mukhda.
- `FILLS.tirakita`, `dhaRoll` and `khaliLift` are 12-step phrases for `bolGrid()`. Place them in the last 2-3 beats before sam.
- Rule: at most one fill per 4-8 bars. Every section change in a film song gets one, landing on sam with a crash or a SAM boom.

## 5. Hindi film song form

| Part | What it does | Typical length (at 85-100 BPM, 4/4) |
|---|---|---|
| Prelude (intro music) | An instrumental hook, often the mukhda melody on flute or strings, or a free alap over a drone | 4-8 bars |
| **Mukhda** | The refrain and the title line. It returns after every antara. | 8 bars (4+4), often sung twice, the second time with a fuller arrangement |
| Interlude 1 | Instrumental. A new idea or a call-and-response between two instruments, with a change of instrumentation and mood | 8 bars |
| **Antara** 1 | The verse. A new tune that sits **higher**, often starting near taar Sa or the vadi's upper octave. It ends on a connector line that falls back to the mukhda's starting pitch. | 8-16 bars |
| Mukhda | The return, often only its first half | 4-8 bars |
| Interlude 2 | Different from interlude 1 | 8 bars |
| Antara 2 | Same tune as antara 1, new words; arranged differently | 8-16 bars |
| Mukhda (+ outro) | The final refrain, sometimes lifted a semitone or tone (modern), then a fade or a tihai ending | 8-16 bars |

Rules:
- There are 2 or 3 antaras, and each has the same melody. The connector at the end of each antara must lead naturally into the mukhda's first note. Write the connector first.
- **Register:** the mukhda sits in the middle register (around Sa to Pa'). The antara opens higher, often on Ga', Pa' or Sa', and comes back down.
- **Hook:** the mukhda's title phrase arrives within its first 2 bars. Repeat it 3-4 times in the song. The prelude often quotes it.
- **Sanchari (?)**: in dhrupad, the third section (sthayi, antara, sanchari, abhog). In film usage it is loosely a contrasting bridge line in one antara. Use it rarely, as a one-off 4-bar departure before the last mukhda.
- **Call and response:** the lead phrase is answered by an instrument in the gaps (bansuri, sarangi, violin section, sax in 1970s RD Burman style). Duets alternate lines, then join on the mukhda.
- **Key lift:** a semitone or tone lift before the last mukhda is a 1990s and later habit, not a 1960s one. Use at most one.
- **Total length:** 1960s songs ran 3-4 min with 2-3 antaras. 1990s songs ran 5-6 min with long interludes. 2010s ballads run 4-5 min, often with 2 antaras, a mukhda-like hook chorus, and a final hook repeated twice.

Instrumentation by era **(?)** (broad trends, not a measured survey):

| Era | Rhythm | Melody / colour | Harmony |
|---|---|---|---|
| 1950s-60s | tabla or dholak keherwa / dadra, little kit | violins in unison (big string section), bansuri, sitar, santoor, sarangi, mandolin, accordion | sparse; drone, bass on Sa and Pa, occasional piano or guitar chords |
| 1970s-80s | dholak + bongos + kit, Latin percussion (RD Burman), madal | strings, sax, electric guitar, synth leads late 80s | more triads; bVII and bVI borrowed in minor songs |
| 1990s | dholak loops, kit, programmed drums, "dholak + kick" in the 3-3-2 | strings, bansuri, shehnai for weddings, synth pads | full pop progressions; key lifts; long interludes |
| 2010s ballad (Arijit era) | soft kit, 3-3-2 kick, dholak or tabla loops, claps | piano, acoustic guitar, strings, bansuri; vocal processing | minor key with i-bVI-bIII-bVII and iv-bVII-bVI-i (as measured in RULES.md 4c), pads |

## 6. Harmony

Traditional raga music has no chords. It has a drone (tanpura: Pa-Sa-Sa-Sa, or Ma-Sa when Pa is varjit, or Ni-Sa / Dha-Sa) and the melody. Film music adds chords. The safe rule is that **every chord tone must be a raga note**. The melody owns the raga, and the chords must not contradict it.

1. **Drone first.** Harp or tanpura on `drone` degrees, with low strings holding Sa (and Pa). This always works and is the right choice for alap, Malkauns, Marwa and Darbari.
2. **Chords from the raga only.** `ragaChords(raga, sa)` lists chords whose tones are all raga notes. The test in section 7 verifies this for every raga. Do not use a chord whose third or seventh is a varjit or opposite-variant note. Examples: no IV (shuddha m) in Yaman, no V major (N) in Bhairavi, Kafi or Darbari, no bVI in Shivranjani (its D is shuddha), no Pa-bearing chords in Malkauns or Marwa.
3. **Keep the bass on Sa (pedal) or on the vadi/samvadi** most of the time. Change chords slowly, one or two per bar. Hindi ballads hold a tonic pedal for bars at a time (Kesariya: I-I-I-V).
4. **Avoid chords that harmonise a passing or varjit note.** If the melody touches a colour note, keep the chord neutral (sus or open fifth) under it.
5. **Cadence by the raga's own pull.** Bhairav and Bhairavi: bII to I or i (the Phrygian cadence). Kirwani: V7 to i (harmonic minor). Charukeshi: iv minor to I. Yaman: II to I (Lydian), or V/vii to I. Kafi and Bhimpalasi: IV to i (Dorian). Khamaj and Desh: bVII to I.
6. **Modal minor for film ragas in Asavari, Kafi or Bhairavi colour.** Use i-bVI-bIII-bVII and iv-bVII-bVI-i only when the raga contains those tones. Aeolian ragas such as Darbari and Asavari do. Kafi lacks bVI. Bhairavi adds bII.

| Raga | Safe chords (Sa = C) | Signature move | Avoid |
|---|---|---|---|
| Yaman | C Cmaj7 D Dsus2 Em Em7 G Gsus4 Am Am7 Bm Bm7 | D/C to C (II over a Sa pedal) | F, Dm, anything with F natural |
| Bhairavi | Cm Db Dbmaj7 Eb Fm Fm7 Ab Abmaj7 Bbm Ebsus2 | Db to Cm; Fm to Cm | G major, Bb major (needs D) |
| Kafi | Cm Cm7 Dm7 Eb F Fadd9 Gm Gm7 Bb Bbadd9 | Cm to F (i-IV) | Ab, G major |
| Khamaj | C Cadd9 Dm7 F Fadd9 Gm Gm7 Am Bb Csus4 | C-Bb-F-C | G major held under a falling line (n vs N) |
| Pahadi | C Cadd9 Dm7 Em F Fadd9 G Gsus4 Am Am7 Bb | C-Am-F-G, Bb as folk colour | minor i |
| Desh | C Dm Dm7 F G Gsus4 Bb Am7 | Dm7 to G to C; Bb to C | G7 under descending lines |
| Bhimpalasi | Cm Cm7 Eb F Fadd9 Bb Bbadd9 Ebmaj7 | Bb-F-Cm, with Fm-ish m emphasis | bass on D or A |
| Darbari | Cm Cm7 Fm Fm7 Ab Abmaj7 Bb Eb Gm | Cm-Ab-Fm-Cm, low | G major |
| Bhupali | C C6 Cadd9 Csus2 D7sus Am Am7 Gsus4 Gsus2 | C6 to Am7 (pentatonic colour) | held F or B |
| Durga | Csus2 Csus4 Dm Dm7 F F6 Fsus2 Gsus4 | Dm7 to Csus2 | any E or B |
| Shivranjani | Cm Cm6 Cmadd9 Am7b5 Gsus4 D7sus (film adds F) | Cm6 to Gsus4 | Ab, Bb |
| Kirwani | Cm Cmmaj7 Fm Fm7 G G7 G7b9 Ab Abmaj7 Dm7b5 Bdim | Fm-G7-Cm | Bb |
| Charukeshi | C C7 Fm Fm6 Abaug Bb Bbadd9 Gm7 Dm7b5 Edim | C-Fm-C; Bb-C | Eb, Ab major |
| Malkauns | Fm Fm7 Ab Absus2 Bbsus4 Ebsus4 | drone Ma-Sa; Fm over C pedal | any G or D |
| Bhairav | C Cmaj7 Db Dbmaj7 Fm Fmmaj7 Em Abaug | Db to C; Fm to C | G, Dm |
| Marwa | A Asus2 F#m F#m7 Esus2 (over a C drone) | A/C held | anything with G |

The table was generated by `ragaChords()`, and `chord()` from `music.mjs` checked every chord tone.

## 7. Using `tools/lib/raga.mjs`

```js
import { RAGAS, TAALS, GROOVES, FILLS, KEYS, sargam, ragaNotes, checkBarsRaga, ragaChords, murki, andolan, meend, thekaGrid, bolGrid, tihai } from '../tools/lib/raga.mjs';
const SA = 62; // D4
const pool = ragaNotes('yaman', SA, 57, 79);            // MIDI notes to draw a melody from
const line = sargam("N. R G R S", SA);                   // a pakad as MIDI
checkBarsRaga('yaman', MUKHDA, SA).forEach(w => console.warn(w.kind, w.msg));
barChords(ragaChords('yaman', 'D')[0]);                  // chords for music.mjs
const bar = [[64, 1], ...murki(66, 67, 64, 1), [69, 2]];  // a melody() bar with a murki on G
drums(hand, t0, TAALS.keherwa.grid, { vel: 80, h });     // tabla keherwa (one 4/4 bar)
drums(hand, t0, GROOVES.filmiKeherwa, { vel: 84, h });   // dholak 3-3-2
const t = tihai('dha ti ra ki ta', 16); drums(hand, t0 + t.start * TPB / 4, t.grid, { vel: 90 }); // lands on the next sam
```

Self-test: `node --input-type=module -e "import * as R from './tools/lib/raga.mjs'; console.log(R.checkPhrase('bhupali', ['D4','E4','F#4','G4'], 62))"` warns that G (m) is varjit.

## Sources

- Yaman: https://en.wikipedia.org/wiki/Yaman_(raga) ; https://artiumacademy.com/music-theory/hindustani-classical/ragas/yaman
- Bhairavi: https://en.wikipedia.org/wiki/Bhairavi_(Hindustani) ; https://shankarmahadevanacademy.com/raga/hindustani-bhairavi/ ; https://www.indiaforums.com/forum/post/7872199 (film list, forum-level)
- Kafi: https://en.wikipedia.org/wiki/Kafi_(raga)
- Khamaj: https://en.wikipedia.org/wiki/Khamaj
- Pahadi: https://soundofindia.com/posts/raga-pahadi-majestic-maharani-of-mountain-melodies ; https://ragajunglism.org/ragas/pahadi ; https://songsofyore.com/film-songs-based-on-classical-ragas-3-music-from-the-mountains
- Desh: https://en.wikipedia.org/wiki/Desh_(raga)
- Bhimpalasi: https://en.wikipedia.org/wiki/Bhimpalasi ; https://ragajunglism.org/ragas/bhimpalasi/
- Darbari Kanada: https://en.wikipedia.org/wiki/Darbari_Kanada ; https://raga.hu/en/raga-darbari-kanada-2/
- Bhupali: https://en.wikipedia.org/wiki/Bhupali
- Durga: https://en.wikipedia.org/wiki/Durga_(raga)
- Shivranjani: https://en.wikipedia.org/wiki/Shivaranjani ; https://songsofyore.com/film-songs-based-on-mand-and-shivranjani
- Kirwani: https://en.wikipedia.org/wiki/Kirwani ; https://en.wikipedia.org/wiki/Ka_Karoon_Sajni_Aaye_Na_Baalam ; https://www.ragasphere.com/post/musings-with-nitin-amin-raga-kirwani
- Charukeshi: https://en.wikipedia.org/wiki/Charukesi ; https://www.ragasphere.com/post/musings-with-nitin-amin-raga-charukeshi
- Malkauns: https://en.wikipedia.org/wiki/Malkauns
- Bhairav: https://en.wikipedia.org/wiki/Bhairav_(raga)
- Marwa: https://en.wikipedia.org/wiki/Marwa_(raga)
- Film songs by raga (general): https://en.wikipedia.org/wiki/List_of_film_songs_based_on_ragas
- Ornaments: https://raag-hindustani.com/Embellishment.html ; https://swarganga.org/articles/icmconcepts/icm29 ; https://en.wikipedia.org/wiki/Alankara ; https://riyazapp.com/blog/hindustani-music-alankar-and-palte-spicing-up-the-swaras/
- Taals and thekas: https://sites.math.washington.edu/~gangolli/Music428Thekas.html ; https://en.wikipedia.org/wiki/Vibhag ; https://en.wikipedia.org/wiki/Keherwa ; https://www.tablatheka.com/2022/07/kawali-theka-8-beats.html
- Tihai: https://en.wikipedia.org/wiki/Tihai
- Tabla strokes: https://transactions.ismir.net/articles/150
- Song form: https://www.songsofyore.com/where-is-the-mukhada-gone-where-is-antara-gone/ ; https://www.southasianist.ed.ac.uk/southasianist/article/view/167
- Harmony and ragas: https://journal.iftawm.org/wp-content/uploads/2023/09/Morris_AAWM_Vol_11_1.pdf (Morris, harmonising raga melodies from the raga's notes) ; https://soundofindia.com/lessons/harmonium-lessons-chords-part-i
- Our own measurements: RULES.md 4c (Hindi film benchmark: 3-3-2 kick, i-bVI-bIII-bVII, 89-96 BPM)
