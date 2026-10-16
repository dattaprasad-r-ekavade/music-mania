# Melody and arrangement theory for a program that cannot listen

Checkable rules and target numbers. `tools/lib/theory.mjs` measures them and `tools/critique.mjs` runs it on a piece:
`node tools/critique.mjs pieces/<name>.mjs <Instrument>`. Confidence tags:
**[firm]** means corpus or experimental evidence. **[practice]** means textbook or arranging convention.
**[heuristic]** means a number we chose; tune it per style. **[unverified]** means remembered from the literature but not checked against the source this session.

Interval classes follow `tools/analyze.py`, so our numbers compare with reference profiles. A step is |interval| ≤ 2 semitones (repeats included), a leap is ≥ 5, thirds (3 and 4) are counted apart, and exact octaves are left out.

## 1. Melody construction

| Rule | Check (theory.mjs field) | Target |
| --- | --- | --- |
| Mostly steps. Melodic intervals cluster near 2 semitones and fall off with size [firm: Vos & Troost 1989; Huron, *Sweet Anticipation*, "pitch proximity"]. | `stepPct`, `leapPct`, `thirdPct`, `meanInterval` | Hindi-film vocals: steps 65–70 %, leaps 19–27 %, repeats 26–30 % (RULES 4c). Default 60–75 / 12–30. |
| Repeated notes are part of the step count. Sung lines repeat a pitch for syllables; instrumental lines repeat less. | `repeatPct` | References 26–30 % (Basic Pitch splits sustained notes, so this is inflated) [heuristic: 8–35 %] |
| **Post-skip reversal / gap fill.** After a leap, change direction, usually by step. Von Hippel & Huron (2000) show this is largely regression to the mean: a leap usually lands near the edge of the tessitura, so the next note tends back. Leaps that land toward the centre need not reverse. | `gapFillPct`, `stepFillPct`, `outwardReversalPct` | ≥ 55 % of leaps reverse; outward leaps (away from the median) should reverse nearly always [heuristic bound on a firm finding] |
| **Step declination.** Small intervals mostly descend and large ones mostly ascend (Vos & Troost 1989). Leap up, then walk down. | `stepDownPct`, `leapUpPct` | steps down 50–75 %, leaps up > 50 % [heuristic bounds] |
| **Arch contour.** Phrases in Western folk song are most often convex (rise then fall) [firm: Huron 1996, Essen collection, 3-point method]. Vary the shape: an antecedent arch, a descending consequent, a bowl in a bridge. | `contour` per phrase (`arch`, `bowl`, `ascending`, `descending`, `level`) | Arch is the most common type, but not every phrase [heuristic] |
| **One climax per phrase.** Strike the high point once, late-ish (about the 2/3 point of a verse, or the 3rd of 4 chorus phrases), on a stable chord, then resolve lower [practice: songwriting texts]. Choruses usually hold a song's highest vocal note [firm, cited in ISMIR 2023]. | `peaks[].hits`, `peaks[].at`, `highPointAt`, `highPointBars`, `multiPeakPhrases` | Peak struck ≤ 2 times per phrase; whole line's peak at 0.35–0.9 of the line [heuristic] |
| **Range / tessitura.** One line spans about an octave to a 10th. The references' 5–95 % spans are 15–22 semitones, including transcription octave errors. Keep the median where the instrument is warm (flute is weak below about A4). | `rangeSemis`, `range5_95`, `median` | 9–19 semitones [heuristic] |
| **Motif and repetition with variation.** Music is extremely repetitive. Catchy, memorable tunes have a common overall contour plus one unusual interval or rhythm [firm: Jakubowski et al. 2017]. Conventional patterns predicted long-term recall better than surprising ones [Burgoyne et al., Hooked]. Repeat a 2-bar basic idea, vary its end, then fragment it (sentence). | `motifRepetition`: `pitchPct` (share of notes inside a recurring 3-interval pattern), `rhythmPct`, `barRhythmRepeatPct`, `barShapeRepeatPct` | Within an 8–16 bar section: pitch-motif coverage 30–90 %, bar rhythm repeats 20–75 % [heuristic]. 100 % is a loop and 0 % is through-composed. |
| **Chord tones on strong beats.** Strong beats (1 and 3 in 4/4) carry chord tones or *prepared* dissonances: accented passing tones, neighbours, appoggiaturas (leap in, step out), and suspensions (held, then resolve down by step) [practice: Open Music Theory]. Weak positions carry passing tones, neighbours, escape tones and anticipations. Pop allows "melodic-harmonic divorce", looser in verses than choruses [firm: Temperley; Arthur & Condit-Schultz]. | `chordTonePct(line, harmony)`: `strongPct`, `kinds`, `nct` | Strong-beat chord tones 65–95 % [heuristic]. Count of `free` (unprepared, unresolved) should be 0–2 per 16 bars. |
| **Tension and release.** Expectation is built by schemas and confirmed by closure. Delay the tonic: approach it via the leading note or 2nd, land on a long note on a strong beat at the cadence. Prediction, then a small surprise, then resolution, is the "sweet anticipation" loop [Huron 2006]. | cadence notes: the last note of a phrase is long and is a chord tone | [practice] |
| **Implication–realization (Narmour; Schellenberg's simplification).** Small intervals imply continuation in the same direction at similar size. Large intervals (≥ 7) imply a reversal by a smaller interval (registral direction, intervallic difference). Also proximity, registral return, closure. | covered by `gapFillPct` and the step stats | [firm as listener expectation; strength varies by style] |
| **Phrase length and breathing.** The references average 22–25 notes per phrase (split at silences > 1 beat). A singer or wind player needs a gap: a rest of ≥ ½ beat every 2–4 bars. | `phraseNotes`, `phraseBeats`, `restPct` | 10–26 notes per phrase; 10–40 % of the line's span silent [heuristic] |

## 2. Phrase and form

- **Sentence vs period** [practice: Caplin]. Themes are paradigmatically 8 bars, built from a 2-bar *basic idea*.
  - A *sentence* is the basic idea and its varied repeat (4 bars), then a continuation that fragments into 1-bar units, speeds up, and cadences. It drives forward, which suits a hook or chorus.
  - A *period* is an antecedent (basic idea, contrasting idea, weak half cadence) then a consequent (basic idea again, stronger authentic cadence). It is balanced, which suits a verse or mukhda statement.
  - 16-bar compound versions double each part.
- **Hypermeter.** Phrases come in 4 and 8 bars, and odd lengths are deliberate effects. Structural events (entries, cadences, drum fills, key changes) land on hypermetric downbeats (bars 1, 5, 9, 13 of a section). A 2-bar extension before a cadence is the standard way to break symmetry.
- **Section energy curve.** Choruses are louder and denser, with heavier instrumentation, a smaller dynamic range and more timbral variety [firm: Van Balen et al. 2013; ISMIR 2023 review]. The second chorus is often the fullest and loudest [Taiwanese pop study]. A typical curve: intro 2/10, verse 4, pre-chorus 6 (rising), chorus 8, verse 2 at 5 (keeps some of the chorus layers), chorus 9, bridge 4–6 (contrast, often a drop), final chorus 10, outro decaying.
- **Where hooks go.** The title or hook falls on the first and/or last line of the chorus and recurs at least twice per chorus. Introduce it, or a fragment, in the intro or instrumental so it is heard before the vocal [practice].
- **Contrast between sections.** Change at least two of these between verse and chorus [practice/heuristic]:
  - register: the chorus median is about 3–5 semitones higher
  - rhythm density: the chorus has more notes, or fewer and longer ones
  - harmonic rhythm: a verse holds one chord per bar; a chorus moves 2 per bar, or the reverse
  - texture

  `tools/critique.mjs` flags neighbouring sections with the same median (within 2 semitones) and the same density (within 15 %).

## 3. Harmony

- **Function.** The tonic group is I, vi, iii; the predominant group is IV, ii; the dominant group is V and vii°. Motion is T → PD → D → T. In pop and rock, IV, V and **bVII** are the commonest chords after I. bVII is the third most common pre-tonic chord, ahead of ii. In the rock corpus, bVII is about 8 % of roots (37 % of songs) and bVI about 4 % (22 %). bIII, bVI and bVII cluster together as the "flat side" [firm: de Clercq & Temperley 2011].
- **Cadences.**
  - Authentic (V–I; strongest with the melody landing on the tonic note)
  - Half (ends on V; for the antecedent)
  - Plagal (IV–I; "amen", gospel and pop endings, iv–I borrowed)
  - Deceptive (V–vi; extends a phrase by 2–4 bars)
  - Aeolian / modal (bVI–bVII–i or bVI–bVII–I, the "Mario cadence"; avoids the leading note and suits minor-key film and pop)
  - Suspended dominant (V7sus4–V7–I; this repo's Golden Hour habit)
- **Modal mixture.** Borrow iv, bVI, bVII and bIII from the parallel minor into major; in minor, use the Picardy I at the end. Mixture darkens one bar without leaving the key. Use at most one borrowed chord per 4-bar phrase unless the whole section is modal [heuristic].
- **Secondary dominants.** Precede a diatonic target with its own V or V7 (V/V, V/vi, V/ii, V/IV = I7). The chromatic note is a leading tone that must rise to the target's root. The Hindi references use iv–bVII–bVI–i (Tum Hi Ho) and i–bVI–iv–bIII (Channa Mereya): flat-side loops with almost no secondary dominants.
- **Pedal points.** Hold the tonic (or dominant) in the bass under changing chords in intros and outros. A dominant pedal under a build creates tension; Kesariya uses a long tonic pedal.
- **Harmonic rhythm.** One chord per bar is the default at 85–100 BPM, and two per bar near cadences, which accelerates into them. Change chords on strong beats; a change on a weak beat sounds like a push, or a mistake if unintended.
- **Voice-leading for pads and countermelodies** [firm: Huron 2001, six perceptual principles]. Parallel unisons, octaves and fifths fuse two voices into one (tonal fusion), so avoid them between *independent* lines. They are fine in deliberate doublings.
  - Move pads by the nearest chord tone (`voice()` already does this).
  - Use contrary or oblique motion against the lead.
  - Keep pad voicings below the lead (the lead must stay the top voice) and avoid crossing.
  - Avoid spacing under a minor third low down (masking).
  - Check with `parallelsAgainst(lead, other)`.
- **Key changes.**
  - *Truck-driver lift*: up a semitone or whole tone for the last chorus, usually after a 1-bar pivot (V of the new key) or with no pivot.
  - About a quarter of US No. 1 hits from the 1960s to the 1990s changed key. Almost none did in 2010–2020 [firm: Dalla Riva via NPR/Tedium].
  - Use it as a deliberate retro or ballad gesture, not as a default.
  - For these pieces, raise the final mukhda a whole tone (`Session` `transpose`, or `shift` on `melody()`).

## 4. Rhythm and groove

- **Syncopation measures.**
  - *LHL* (Longuet-Higgins & Lee 1984): metrical weights on a 16th grid are bar 0, half-bar −1, beat −2, 8th −3, 16th −4. A note followed by silence or its own sustain across a *stronger* position before the next onset scores (that weight − its weight). theory.mjs reports `lhlPerBar`.
  - *WNBD* (Gómez, Melvin, Rappaport & Toussaint 2005): per note, T is the distance to the nearest beat. The score is 0 on the beat, otherwise 1/T, doubled when the note is held over the next beat (but not the one after). theory.mjs reports `wnbd` as the mean per note.
  - Plain 8th-note runs on the "&" are not syncopated by LHL. Syncopation needs a note held over, or a rest on, a stronger position.
- **Pushes and anticipations.** Rock and pop vocals routinely *anticipate* a strong beat by an 8th or 16th (a fourth-position syncopation: the note on "4-a" tied into 1) [firm: Tan, Lustig & Temperley 2019; Temperley 2021]. The Hindi references put only 26–35 % of onsets on the beat, and 16th positions "e" and "a" carry 14–26 % each (RULES 4c profiles). An 8th-only line can never match that profile.
- **Groove has an inverted U.** Medium syncopation maximises the wish to move and pleasure [firm: Witek et al. 2014]. Syncopate the melody *against a steady* kick or hat; do not syncopate everything.
- **Swing.** This repo uses `swing` = the fraction of a step that every second 16th is delayed (City Lights 0.14). About 0.1–0.2 is lo-fi or neo-soul; 0.33 is a full triplet feel [practice].
- **Density per section.** The reference vocals average 6.4–6.9 notes per bar. Verses can be denser and lower; choruses use longer notes on higher pitches (the hook breathes). A countermelody should be *sparser* than the lead when the lead is busy, and move when the lead holds [practice].

## 5. Arrangement and orchestration

- **Register slots.** Give each part an octave band and keep it out of the lead's octave while the lead plays [practice].
  - The lead and vocal presence band is about 1–4 kHz.
  - Bass and kick sit at 60–120 Hz, low-mid rhythm at 200–400 Hz, and hats above 8 kHz.
  - Pads go an octave below the lead or spread wide and soft. Mix them 6–8 dB under (RULES 5).
  - `registerAgainst(lead, others)` reports how often another part is **above** the lead (crossing: the lead loses the top voice) or within 2 semitones (masking). Aim for under 10 % for both while the lead plays [heuristic].
- **Call and response.** Answer phrases fill the lead's rests (the lead's breathing space is where the answer goes). Use a different timbre and register and keep it shorter than the call. Sandhya's sax interlude is an answer *section*; also try 1–2 bar answers inside the mukhda gaps.
- **Countermelody.**
  - Use contrary or oblique motion to the lead, long notes when the lead is busy, and movement when the lead holds.
  - Keep it below the lead, or above only if much softer and slower (a descant).
  - Introduce it in later sections only, so the arrangement grows.
  - Avoid parallel octaves and fifths with the lead unless it is a deliberate doubling.
- **Doubling.** Unison or octave doubling thickens a hook (flute + violins at the octave in a final chorus). Treat it as one voice and do not count it as a countermelody.
- **Dynamics curve.** Shape the whole piece: the build reaches its peak around 70–85 % of the duration (final chorus), then releases [practice/heuristic]. Enter in stages (RULES 4). Make no jump of more than 6 dB unless it is a hit (RULES 5).

## Defaults in `TARGETS` (tools/lib/theory.mjs)

`stepPct` 60–75, `leapPct` 12–30, `repeatPct` 8–35, `notesPerBar` 4–8, `phraseNotes` 10–26, `onBeatPct` 20–45, `restPct` 10–40, `rangeSemis` 9–19, `gapFillPct` 55–100, `stepDownPct` 50–75, `highPointAt` 0.35–0.9, `strongPct` 65–95, `pitchPct` 30–90, `barRhythmRepeatPct` 20–75.

- The first six come from the Hindi-film reference vocals (RULES 4c).
- The rest are heuristic bounds around the findings above.
- Override them per style with `critique(name, bars, { targets: { … } })`. A lobby piece like Golden Hour wants `onBeatPct` up to 80 and `notesPerBar` from 2.
- Pads and long-note countermelodies are not leads: judge them by `parallelsAgainst` and `registerAgainst`, not by `TARGETS`.

## Sources

- Von Hippel & Huron (2000), *Why do skips precede reversals?*: https://labs.sonicfield.org/library/why-do-skips-precede-reversals-the-effect-of-tessitura-on-melodic-structure
- Vos & Troost (1989), ascending and descending intervals: https://labs.sonicfield.org/library/ascending-and-descending-melodic-intervals-statistical-findings-and-their-percep ; discussion https://auditory.org/postings/2007/594.html
- Huron (2006), *Sweet Anticipation*: https://researchgate.net/profile/David-Huron-2/publication/209436188_Sweet_Anticipation_Music_and_the_Psychology_of_Expectation/links/0c96052e02be139f9f000000/Sweet-Anticipation-Music-and-the-Psychology-of-Expectation.pdf
- Huron (1996), melodic arch (secondary accounts): https://arxiv.org/pdf/2604.13119 ; https://jornadassecyt.fba.unlp.edu.ar/Jidap_pdf/eje_3/Malbranyequipo.pdf
- Step declination and step inertia (Cenkerová & Parncutt 2015, cited in): https://sonicfield.org/library/style-dependency-of-melodic-expectation
- Narmour's implication–realization and Schellenberg/Krumhansl simplifications: https://en.wikipedia.org/wiki/Implication-Realization ; https://pmc.ncbi.nlm.nih.gov/articles/PMC3706544
- Jakubowski et al. (2017), *Dissecting an earworm*: https://gold.ac.uk/news/scientists-find-key-to-writing-catchy-pop-hits ; https://musicscience.net/projects/music-memory/earworms/
- Burgoyne et al. (2013), *Hooked*: https://archives.ismir.net/ismir2013/paper/000101.pdf ; https://en.wikipedia.org/wiki/Catchiness
- Van Balen et al. (2013), chorus features: https://archives.ismir.net/ismir2013/paper/000180.pdf ; ISMIR 2023 review of chorus loudness and pitch: https://archives.ismir.net/ismir2023/paper/000093.pdf ; Taiwanese pop verse–chorus study: https://tdr.lib.ntu.edu.tw/handle/123456789/15976
- Climax placement (songwriting practice): https://www.secretsofsongwriting.com/2012/12/13/where-to-place-a-climactic-moment-in-a-song-melody/ ; https://www.secretsofsongwriting.com/2018/07/02/the-chorus-hook-and-the-climactic-high-point/
- Caplin, sentence and period: https://en.wikipedia.org/wiki/Theory_of_Formal_Function ; https://www.piano-composer-teacher-london.co.uk/post/analysing-classical-sonatas-the-sentence
- Non-chord tones: https://human.libretexts.org/Bookshelves/Music/Music_Theory/Open_Music_Theory_1e_(Wharton_and_Shaffer_Eds)/02%3A_Voice-Leading_and_Model_Composition/2.18%3A_Strict_Four-Voice_Composition_-_Embellishing_Tones ; https://musictheory.pugetsound.edu/mt21c/NonChordTonesIntroduction.html
- Melodic–harmonic divorce in pop (Arthur & Condit-Schultz; Temperley): https://guide.societymusictheory.org/sessions/nov7/afternoon/corpus-approaches-to-popular
- De Clercq & Temperley (2011), rock harmony corpus: https://www.cambridge.org/core/journals/popular-music/article/corpus-analysis-of-rock-harmony/C5210A8EC985DDF170B53124F4464DA4 ; slides with bVII and bVI counts https://www.midside.com/presentations/declercq_2014_euromac_slides.pdf
- Huron (2001), *Tone and Voice* (voice-leading from perception): https://journals.ou.edu/jmtp/article/download/657/1498/1488 ; https://muse.jhu.edu/book/47915
- Key-change decline (Dalla Riva): https://tedium.co/2022/11/09/the-death-of-the-key-change ; https://www.keranews.org/2022-11-25/why-the-key-change-has-disappeared-from-top-charting-tunes ; truck-driver modulation: https://www.musicradar.com/news/how-to-use-key-changes-songwriting-music-theory
- Syncopation measures (LHL, WNBD): https://archive.bridgesmathart.org/2005/bridges2005-73.html ; https://code.soundsoftware.ac.uk/hg/syncopation-dataset/file/tip/synpy/WNBD.py ; https://bpb-us-e1.wpmucdn.com/wp.nyu.edu/dist/4/23414/files/2022/01/SiorosGuedes2014.pdf ; https://www.mcg.uva.nl/mcg-2023/papers/smith-honing-2006.pdf
- Anticipatory syncopation in rock (Tan, Lustig & Temperley 2019): https://sonicfield.org/library/anticipatory-syncopation-in-rock-a-corpus-study ; fourth-position syncopation (Temperley 2021): https://labs.sonicfield.org/library/the-origins-of-syncopation-in-american-popular-music
- Witek et al. (2014), syncopation and groove: https://doaj.org/article/743d9013fbde436999b78a244c718d37
- Frequency masking and slotting (practitioner): https://theproducerschool.com/blogs/music-production/frequency-masking-explained-complete-guide-for-producers ; https://borisfx.com/blog/frequency-masking-explained-and-how-to-fix-it/
- Countermelody practice: https://fastrhymes.com/blog/how-to-write-countermelodies-adding-depth-to-your-arrangements ; https://revolutionharmony.org/home/blog/backing-melody-rule

**[unverified] items.** The energy-curve numbers (intro 2/10 … final chorus 10), the 70–85 % peak point and "one borrowed chord per phrase" are arranging conventions, not measured. The Hindi reference repeat and 16th-onset percentages come from Basic Pitch transcriptions, which split held and ornamented notes, so they overstate repeats and 16th onsets.
