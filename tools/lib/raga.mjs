// Ragas and taals for code-written pieces in a Hindustani / Hindi-film idiom. No dependencies.
// Background, sources and the rules behind these tables: docs/theory-indian.md.
//
// Degree notation: semitones above Sa. 0 S, 1 r (komal Re), 2 R, 3 g (komal Ga), 4 G, 5 m (shuddha Ma),
// 6 M (tivra Ma), 7 P, 8 d (komal Dha), 9 D, 10 n (komal Ni), 11 N. Octaves are ±12: -1 is mandra N (N.), 12 is taar Sa (S').
// Sargam strings use the same letters with '.' (lower octave) or "'" (upper) after the swara: "N. R G M D N S'".
//   sw("N. R G")  -> [-1, 2, 4]
//
// A raga: { thaat, degrees (pitch classes, 0..11, sorted), aroha, avaroha (degree sequences), vadi, samvadi,
//   pakad: [[degrees]...] (characteristic movements), nyas (resting notes), varjit (omitted swaras),
//   weak (alpa: pass through, do not dwell), colour (outside notes film / light-classical practice admits as touches),
//   andolan (notes that want a slow sway), drone (tanpura degrees), chords (harmony that does not contradict the raga,
//   as 'degree+quality' tokens for music.mjs chord(), e.g. '9m7' = vi7; 'degree:quality' when the quality starts with a digit,
//   '0:6' = I6; every chord tone is a raga note), mood, time }.
// Notes marked (?) in comments are where sources disagree; see the doc.

const SW = { S: 0, r: 1, R: 2, g: 3, G: 4, m: 5, M: 6, P: 7, d: 8, D: 9, n: 10, N: 11 };
const NAME = Object.fromEntries(Object.entries(SW).map(([k, v]) => [v, k]));
export function sw(s) {
  return s.replace(/[,|]/g, ' ').split(/\s+/).filter(Boolean).map(t => {
    const m = /^([SrRgGmMPdDnN])([.']*)$/.exec(t);
    if (!m) throw new Error(`bad swara ${t}`);
    return SW[m[1]] + 12 * ([...m[2]].filter(c => c === "'").length - [...m[2]].filter(c => c === '.').length);
  });
}
// Degree -> sargam name with octave marks (inverse of sw).
export const swName = d => NAME[((d % 12) + 12) % 12] + (d < 0 ? '.'.repeat(Math.ceil(-d / 12)) : "'".repeat(Math.floor(d / 12)));

const R = o => ({
  ...o, aroha: sw(o.aroha), avaroha: sw(o.avaroha), pakad: o.pakad.map(sw),
  degrees: [...new Set(sw(o.notes).map(d => ((d % 12) + 12) % 12))].sort((a, b) => a - b),
  varjit: o.varjit ? sw(o.varjit) : [], nyas: sw(o.nyas), weak: o.weak ? sw(o.weak) : [], colour: o.colour ? sw(o.colour) : [],
  andolan: o.andolan ? sw(o.andolan) : [], drone: sw(o.drone ?? 'P. S'), vadi: sw(o.vadi)[0], samvadi: sw(o.samvadi)[0],
  chords: o.chords.split(' '),
});

export const RAGAS = {
  yaman: R({ thaat: 'Kalyan', notes: 'S R G M P D N', aroha: "N. R G M P D N S'", avaroha: "S' N D P M G R S",
    vadi: 'G', samvadi: 'N', nyas: 'R G P N', colour: 'm', // shuddha m as a touch (G m G R) = Yaman Kalyan
    pakad: ['N. R G R S', 'P M G R S', 'N. R G M D N S\'', 'G M D N D P', 'M G R G R S'], // Sa and Pa are often skipped going up
    drone: 'P. S', chords: '0 0maj7 2 2sus2 4m 4m7 7 7sus4 9m 9m7 11m 11m7', // Lydian: II major (holds M); avoid IV (shuddha m)
    mood: 'serene, romantic, auspicious', time: 'first part of the night (about 6-9 pm)' }),
  bhairavi: R({ thaat: 'Bhairavi', notes: 'S r g m P d n', aroha: "S r g m P d n S'", avaroha: "S' n d P m g r S",
    vadi: 'm', samvadi: 'S', nyas: 'S m P g', colour: 'R M N', andolan: 'r d', // (?) vadi given as m or P; light Bhairavi admits all 12
    pakad: ['n. S g m d P', 'g m g r S', "d n S' n d P", 'm g r g r S', 'S g m d n S\''],
    drone: 'P. S', chords: '0m 1 1maj7 3 5m 5m7 8 8maj7 10m 3sus2', // Phrygian: bII-i is the cadence; avoid V major (needs N)
    mood: 'devotional, tender, pathos; the closing raga', time: 'morning (traditionally); used any time as a closer' }),
  kafi: R({ thaat: 'Kafi', notes: 'S R g m P D n', aroha: "S R g m P D n S'", avaroha: "S' n D P m g R S",
    vadi: 'P', samvadi: 'R', nyas: 'R P S', colour: 'G N', // (?) some give S/P; hori/thumri add shuddha G and N
    pakad: ['m P D P m g R', 'g R S', 'n. D. S', 'S R g m P D n D P'],
    drone: 'P. S', chords: '0m 0m7 2m7 3 5 5add9 7m 7m7 10 10add9', // Dorian: i-IV is the colour
    mood: 'playful, springtime (Hori), shringar of both union and separation', time: 'night (about 9 pm-12)' }),
  khamaj: R({ thaat: 'Khamaj', notes: 'S R G m P D n N', aroha: "S G m P D N S'", avaroha: "S' n D P m G R S",
    vadi: 'G', samvadi: 'N', nyas: 'G P S', weak: 'R', // N going up, n coming down
    pakad: ['n D m P D m G', 'G m P D N S\'', "S' n D P m G", 'm G R S'],
    drone: 'P. S', chords: '0 0add9 2m7 5 5add9 7m 7m7 9m 10 0sus4', // Mixolydian: I-bVII-IV; V7 sparingly (N only rising)
    mood: 'romantic, light, coquettish (thumri)', time: 'night (about 9 pm-12)' }),
  pahadi: R({ thaat: 'Bilawal', notes: 'S R G m P D n', aroha: "P. D. S R G P D S'", avaroha: "S' n D P m G R S D. P.",
    vadi: 'G', samvadi: 'D', nyas: 'S G P D.', weak: 'm n', colour: 'N', // (?) light raga, sources do not fix vadi; core is Bhupali-like
    pakad: ['D. P. S', 'S R G P G', 'G R S D.', 'P. D. S R G R S', 'G P D P m G R S'], // dwell low: mandra D and P
    drone: 'P. S', chords: '0 0add9 2m7 4m 5 5add9 7 7sus4 9m 9m7 10', // major; IV and bVII carry the m and n colour
    mood: 'longing, nostalgia, the hills, folk', time: 'any (light raga)' }),
  desh: R({ thaat: 'Khamaj', notes: 'S R G m P D n N', aroha: "N. S R m P N S'", avaroha: "S' n D P D m G R G N. S",
    vadi: 'R', samvadi: 'P', nyas: 'R P S', weak: 'G D',
    pakad: ['R m P N S\'', "R' n D P", 'P D m G R', 'R G N. S'],
    drone: 'P. S', chords: '0 2m 2m7 5 7 7sus4 10 9m7', // Mixolydian-ish: I-IV-bVII, ii for the R emphasis
    mood: 'monsoon, yearning, also patriotic', time: 'night (about 9 pm-12); rainy season' }),
  bhimpalasi: R({ thaat: 'Kafi', notes: 'S R g m P D n', aroha: "n. S g m P n S'", avaroha: "S' n D P m g R S",
    vadi: 'm', samvadi: 'S', nyas: 'm P S', weak: 'R D', // R and D only in descent, never held
    pakad: ['n. S m', 'm g', 'P m g R S', 'g m P n D P', 'm P g m g R S'],
    drone: 'P. S', chords: '0m 0m7 3 5 5add9 10 10add9 3maj7', // Dorian, but keep the bass off R and D
    mood: 'yearning, tender longing', time: 'early afternoon (12-3 pm)' }),
  darbari: R({ thaat: 'Asavari', notes: 'S R g m P d n', aroha: "n. S R g m P d n S'", avaroha: "S' d n P m P g m R S",
    vadi: 'R', samvadi: 'P', nyas: 'R P S d.', andolan: 'g d', // vakra: g approached from m above, d from n above
    pakad: ['g m R S', 'd. n. S R S', 'm P d n P', 'n. S R g m R S', "d n P m P g m R S"],
    drone: 'P. S', chords: '0m 0m7 5m 5m7 8 8maj7 10 3 7m', // Aeolian, low and slow; no V major
    mood: 'grave, majestic, serious', time: 'midnight' }),
  bhupali: R({ thaat: 'Kalyan', notes: 'S R G P D', aroha: "S R G P D S'", avaroha: "S' D P G R S",
    vadi: 'G', samvadi: 'D', nyas: 'S G P', varjit: 'm N',
    pakad: ['G R S D. S R G', 'G R P G', 'G R S R D. S', 'P G D P G R S', "S' D P G R S"],
    drone: 'P. S', chords: '0 0:6 0add9 0sus2 2:7sus 9m 9m7 7sus4 7sus2', // pentatonic-safe; IV and V only if m and N stay unheld
    mood: 'peaceful, devotional', time: 'early night (about 7-9 pm)' }),
  durga: R({ thaat: 'Bilawal', notes: 'S R m P D', aroha: "S R m P D S'", avaroha: "S' D P m R S",
    vadi: 'm', samvadi: 'S', nyas: 'S m D', varjit: 'G N', // Pa not a resting note in descent
    pakad: ['R m P D', 'm P D', 'm R', 'S R D. S', "S' D m P D m R"],
    drone: 'P. S', chords: '0sus2 0sus4 2m 2m7 5 5:6 5sus2 7sus4', // no G or N: suspended and ii/IV colour
    mood: 'romantic, bright, folk-like', time: 'night (about 9 pm-12)' }),
  shivranjani: R({ thaat: 'Kafi', notes: 'S R g P D', aroha: "S R g P D S'", avaroha: "S' D P g R S",
    vadi: 'P', samvadi: 'S', nyas: 'S g P', varjit: 'm n', colour: 'G', // (?) vadi varies by source; film adds shuddha G
    pakad: ['g R S D.', 'S R g R S D. S', "P D S' D P g R", 'D. S R g P g R S'],
    drone: 'P. S', chords: '0m 0m6 0madd9 9m7b5 7sus4 2:7sus', // no bVI or bVII (D is shuddha, n absent); film adds IV (F) as colour
    mood: 'pathos, separation, longing', time: 'night (light raga, any time in film)' }),
  kirwani: R({ thaat: '(none: harmonic minor)', notes: 'S R g m P d N', aroha: "S R g m P d N S'", avaroha: "S' N d P m g R S",
    vadi: 'P', samvadi: 'R', nyas: 'R g P', // (?) no strict vadi-samvadi in sources; R g P d all important
    pakad: ['d P g R S', 'R g m P d P', "N S' N d P", 'g m d N S\''],
    drone: 'P. S', chords: '0m 0mmaj7 5m 5m7 7 7:7 7:7b9 8 8maj7 2m7b5 11dim', // V7-i works here
    mood: 'pathos, romantic longing', time: 'midnight' }),
  charukeshi: R({ thaat: '(none: Carnatic mela 26)', notes: 'S R G m P d n', aroha: "S R G m P d n S'", avaroha: "S' n d P m G R S",
    vadi: 'P', samvadi: 'S', nyas: 'G P S', // (?) vadi-samvadi not standardised
    pakad: ["d n S' n d P", 'm G R S', 'G m d P', 'P d n d P m G'],
    drone: 'P. S', chords: '0 0:7 5m 5m6 8aug 10 10add9 7m7 2m7b5 4dim', // major I with minor iv: the signature; no bVI major (needs g)
    mood: 'poignant, bittersweet', time: 'any' }),
  malkauns: R({ thaat: 'Bhairavi', notes: 'S g m d n', aroha: "n. S g m d n S'", avaroha: "S' n d m g m g S",
    vadi: 'm', samvadi: 'S', nyas: 'S m g', varjit: 'R P', andolan: 'g d',
    pakad: ['g m d m g m g S', 'm g m g S', 'n. S g m', 'd n S\' n d m'],
    drone: 'm. S', chords: '5m 5m7 8 8sus2 10sus4 3sus4', // no Pa: avoid i with fifth, tune drone to Ma
    mood: 'serious, meditative, heavy', time: 'late night (12-3 am)' }),
  bhairav: R({ thaat: 'Bhairav', notes: 'S r G m P d N', aroha: "S r G m P d N S'", avaroha: "S' N d P m G r S",
    vadi: 'd', samvadi: 'r', nyas: 'S m P d', andolan: 'r d',
    pakad: ['G m d d P', 'G m r r S', 'S G m P d d P m G m r S', "d N S' r' S'"],
    drone: 'P. S', chords: '0 0maj7 1 1maj7 5m 5mmaj7 4m 8aug', // I and bII; iv minor; no V (needs D)
    mood: 'solemn, devotional, dawn', time: 'dawn' }),
  marwa: R({ thaat: 'Marwa', notes: 'S r G M D N', aroha: "N. r G M D N r' S'", avaroha: "r' N D M G r S",
    vadi: 'r', samvadi: 'D', nyas: 'r D G', varjit: 'P', // Sa sounded rarely, only at phrase ends; N does not lead to S
    pakad: ['D M G r', 'G M G r S', 'N. r G M D', 'D M G r N. r S'],
    drone: 'D. S', chords: '9 9sus2 6m 6m7 4sus2', // static; a major triad on D over the Sa drone
    mood: 'anxious longing, solemn expectation', time: 'sunset' }),
};

// Midi helpers. saMidi is the Sa you choose (e.g. 62 for D4).
const PCN = { C: 0, D: 2, E: 4, F: 5, G: 7, A: 9, B: 11 };
const toMidi = n => typeof n === 'number' ? n : (m => 12 * (+m[3] + 1) + PCN[m[1]] + (m[2] === '#' ? 1 : m[2] === 'b' ? -1 : 0))(/^([A-G])(#|b)?(-?\d)$/.exec(n));
const pcOf = (n, sa) => ((toMidi(n) - toMidi(sa)) % 12 + 12) % 12;
const rg = r => typeof r === 'string' ? RAGAS[r] : r;

// Every raga note in [lo, hi]; colour notes too with { colour: true }.
export function ragaNotes(raga, saMidi, lo, hi, { colour = false } = {}) {
  const r = rg(raga), ok = new Set([...r.degrees, ...(colour ? r.colour.map(d => (d % 12 + 12) % 12) : [])]);
  const out = [];
  for (let p = toMidi(lo); p <= toMidi(hi); p++) if (ok.has(pcOf(p, saMidi))) out.push(p);
  return out;
}
export const inRaga = (raga, n, saMidi) => rg(raga).degrees.includes(pcOf(n, saMidi));
// Nearest raga note (dir -1 below, +1 above, 0 either, ties go down).
export function snap(raga, n, saMidi, dir = 0) {
  const p = toMidi(n);
  for (let k = 0; k < 12; k++) for (const s of dir > 0 ? [1] : dir < 0 ? [-1] : [-1, 1]) if (inRaga(raga, p + s * k, saMidi)) return p + s * k;
}
// Sargam string -> midi, e.g. sargam("N. R G", 62) for Sa = D4.
export const sargam = (s, saMidi) => sw(s).map(d => toMidi(saMidi) + d);
// Chord symbols for music.mjs chord()/barChords(), e.g. ragaChords('yaman', 'D') -> ['D', 'Dmaj7', 'E', ...].
const FL = ['C', 'Db', 'D', 'Eb', 'E', 'F', 'Gb', 'G', 'Ab', 'A', 'Bb', 'B'];
export const ragaChords = (raga, sa = 'C') => rg(raga).chords.map(t => { const [d, q = ''] = t.includes(':') ? t.split(':') : /^(\d+)(.*)$/.exec(t).slice(1); return FL[(PCN[sa[0]] + (sa[1] === '#' ? 1 : sa[1] === 'b' ? -1 : 0) + +d + 12) % 12] + q; });

// Warnings for a phrase (midi numbers or note names). opts.durs: beats per note (enables the dwell checks).
// kinds: 'varjit' (omitted swara), 'outside' (not in the raga at all), 'colour' (allowed touch, say so),
// 'aroha' / 'avaroha' (note not used in that direction, unless the raga's own aroha/avaroha/pakad take that step), 'weak' (alpa note held >= 1 beat), 'nyas' (phrase ends off a resting note).
export function checkPhrase(raga, notes, saMidi, { durs = null, end = true } = {}) {
  const r = rg(raga), w = [], pcs = notes.map(n => pcOf(n, saMidi)), ps = notes.map(toMidi);
  const set = a => new Set(a.map(d => (d % 12 + 12) % 12));
  const up = set(r.aroha), down = set(r.avaroha), varj = set(r.varjit), col = set(r.colour), weak = set(r.weak), nyas = set(r.nyas);
  const pc12 = d => (d % 12 + 12) % 12, seen = new Set(); // steps the raga's own lines take (vakra turns like Desh 'P D m G')
  for (const l of [r.aroha, r.avaroha, ...r.pakad]) l.slice(1).forEach((d, k) => seen.add(`${pc12(l[k])}>${pc12(d)}${Math.sign(d - l[k])}`));
  const known = i => seen.has(`${pcs[i - 1]}>${pcs[i]}${Math.sign(ps[i] - ps[i - 1])}`);
  pcs.forEach((pc, i) => {
    const nm = swName(pc);
    if (!r.degrees.includes(pc)) {
      if (col.has(pc)) w.push({ i, kind: 'colour', msg: `${nm} is a colour note in ${r.thaat} style: touch it, do not dwell` });
      else w.push({ i, kind: varj.has(pc) ? 'varjit' : 'outside', msg: `${nm} is ${varj.has(pc) ? 'varjit' : 'not in the raga'}` });
      return;
    }
    if (i > 0 && ps[i] > ps[i - 1] && !up.has(pc) && !known(i)) w.push({ i, kind: 'aroha', msg: `${nm} is not used going up` });
    if (i > 0 && ps[i] < ps[i - 1] && !down.has(pc) && !known(i)) w.push({ i, kind: 'avaroha', msg: `${nm} is not used coming down` });
    if (durs && weak.has(pc) && durs[i] >= 1) w.push({ i, kind: 'weak', msg: `${nm} is a passing note here; ${durs[i]} beats is a dwell` });
  });
  if (end && pcs.length && !nyas.has(pcs.at(-1))) w.push({ i: pcs.length - 1, kind: 'nyas', msg: `ends on ${swName(pcs.at(-1))}; resting notes are ${r.nyas.map(swName).join(' ')}` });
  return w;
}
// The same check for melody() bars ([[note|[note,grace]|null, beats]...] per bar); ignores rests and graces.
export function checkBarsRaga(raga, bars, saMidi, opts) {
  const ns = [], ds = [];
  for (const b of bars) for (const [n, d] of b) if (n) { ns.push(Array.isArray(n) ? n[0] : n); ds.push(d); }
  return checkPhrase(raga, ns, saMidi, { durs: ds, end: false, ...opts });
}

// Ornaments as melody() fragments ([note, beats] lists summing to `beats`); sampled instruments have no pitch bend.
// f is the length of each quick note in beats (1/8 = a 32nd; at 90 BPM about 80 ms).
// kan: use melody()'s [note, grace] directly (grace from the neighbour above when descending, below when rising).
export const murki = (main, up, low, beats, f = 0.125) => [[up, f], [main, f], [low, f], [main, beats - 3 * f]];
export const khatka = (cluster, main, beats, f = 0.0625) => [...cluster.map(n => [n, f]), [main, beats - cluster.length * f]];
// gamak: forceful alternation main/other for `span` beats, then hold main.
export function gamak(main, other, beats, { f = 0.125, span = beats / 2 } = {}) {
  const out = []; let t = 0, k = 0;
  while (t + f <= span + 1e-9) { out.push([k++ % 2 ? other : main, f]); t += f; }
  out.push([main, beats - t]);
  return out;
}
// andolan: slow sway; hold main and dip to the lower neighbour `n` times as short touches.
export function andolan(main, lower, beats, { n = 2, f = 0.25 } = {}) {
  const seg = (beats - n * f) / (n + 1), out = [[main, seg]];
  for (let k = 0; k < n; k++) out.push([lower, f], [main, seg]);
  return out;
}
// meend on samples: step through raga notes from `from` to `to` (exclusive), quick and soft, landing on `to`.
export function meend(raga, from, to, saMidi, beats, f = 0.125) {
  const a = toMidi(from), b = toMidi(to), dir = Math.sign(b - a), path = [];
  for (let p = a; p !== b; p += dir) if (inRaga(raga, p, saMidi)) path.push(p);
  return [...path.map(p => [p, f]), [b, beats - path.length * f]];
}

// ---- Taal ----
// Bols -> strokes. GE bass open, KA bass closed, NA treble rim (ringing), TIN treble open, TI/RA treble closed, TUN treble centre.
const BOL = {
  dha: ['GE', 'NA'], dhin: ['GE', 'TIN'], dhi: ['GE', 'TIN'], din: ['GE', 'TIN'], dhe: ['GE', 'TI'], ge: ['GE'], ghe: ['GE'], ga: ['GE'],
  ka: ['KA'], ke: ['KA'], kat: ['KA'], ki: ['KA'], na: ['NA'], ta: ['NA'], tin: ['TIN'], ti: ['TI'], te: ['TI'], ra: ['RA'], tun: ['TUN'], tu: ['TUN'], '-': [],
};
// Stroke -> midi key. tabla/dholak on the 'hand' kit (60-64 darbuka, 65/66 large frame open/muted, 67/68 small frame,
// 69/70 bongo low/high open, 71/72 muted); conga on 'perc'. SAM adds a low boom on the first stroke of the cycle.
// Proposed mapping, chosen by sound (darbuka 1 peaks near 143 Hz and rings longest; darbuka 3 rings near 740 Hz).
export const KEYS = {
  tabla: { GE: 60, KA: 71, NA: 62, TIN: 70, TI: 72, RA: 64, TUN: 69, SAM: 65 },
  dholak: { GE: 65, KA: 66, NA: 67, TIN: 67, TI: 68, RA: 68, TUN: 69 },
  conga: { GE: 41, KA: 46, NA: 45, TIN: 43, TI: 47, RA: 47, TUN: 43 },
};
// Bol string -> drums() patterns, one step per bol ('-' rests). Accent X on the first, x on `strong` steps, o otherwise.
export function bolGrid(bols, keys = KEYS.tabla, { strong = null } = {}) {
  const b = bols.trim().split(/\s+/), g = {};
  const put = (key, i, c) => { g[key] ??= '.'.repeat(b.length).split(''); g[key][i] = c; };
  b.forEach((bol, i) => {
    const st = BOL[bol.toLowerCase()];
    if (!st) throw new Error(`unknown bol ${bol}`);
    const c = i === 0 ? 'X' : !strong || strong.includes(i) ? 'x' : 'o';
    for (const s of st) put(keys[s], i, c);
  });
  if (keys.SAM && BOL[b[0].toLowerCase()].includes('GE')) put(keys.SAM, 0, 'X');
  return Object.fromEntries(Object.entries(g).map(([k, v]) => [k, v.join('')]));
}
// A theka (one entry per matra; a matra may hold several bols, 'dha ge') on a grid of `spm` 16th steps per matra.
export function thekaGrid(taal, keys = KEYS.tabla, spm = 2) {
  const t = typeof taal === 'string' ? TAALS[taal] : taal, flat = [], strong = [];
  t.theka.forEach(m => {
    const b = m.split(' ');
    if (b.length > spm) throw new Error(`matra '${m}' needs ${b.length} steps`);
    strong.push(flat.length);
    flat.push(...b, ...Array(spm - b.length).fill('-'));
  });
  return bolGrid(flat.join(' '), keys, { strong });
}

// Taals. beats = matras; vibhag sizes; sam = 1; tali/khali = matra numbers (1-based).
// The grids (tabla keys) use 2 steps per matra at step = TPB/4, so a matra is an eighth note:
// keherwa = one 4/4 bar, dadra 12 steps (beatsPerBar 3, 6/8), rupak 14 (3.5), jhaptaal 20 (5), deepchandi 28 (7),
// teentaal 32 (two 4/4 bars). For a slow taal (matra = a quarter), pass step: TPB/2 to drums().
const T = o => ({ ...o, step: 240, spm: 2, steps: o.beats * 2, barBeats: o.beats / 2 });
export const TAALS = {
  keherwa: T({ beats: 8, vibhag: [4, 4], sam: 1, tali: [1], khali: [5], theka: ['dha', 'ge', 'na', 'ti', 'na', 'ka', 'dhi', 'na'] }),
  dadra: T({ beats: 6, vibhag: [3, 3], sam: 1, tali: [1], khali: [4], theka: ['dha', 'dhi', 'na', 'dha', 'tin', 'na'] }),
  rupak: T({ beats: 7, vibhag: [3, 2, 2], sam: 1, tali: [4, 6], khali: [1], theka: ['tin', 'tin', 'na', 'dhi', 'na', 'dhi', 'na'] }), // sam is khali
  teentaal: T({ beats: 16, vibhag: [4, 4, 4, 4], sam: 1, tali: [1, 5, 13], khali: [9],
    theka: ['dha', 'dhin', 'dhin', 'dha', 'dha', 'dhin', 'dhin', 'dha', 'dha', 'tin', 'tin', 'ta', 'ta', 'dhin', 'dhin', 'dha'] }),
  jhaptaal: T({ beats: 10, vibhag: [2, 3, 2, 3], sam: 1, tali: [1, 3, 8], khali: [6], theka: ['dhi', 'na', 'dhi', 'dhi', 'na', 'ti', 'na', 'dhi', 'dhi', 'na'] }),
  deepchandi: T({ beats: 14, vibhag: [3, 4, 3, 4], sam: 1, tali: [1, 4, 11], khali: [8],
    theka: ['dha', 'dhin', '-', 'dha', 'dha', 'tin', '-', 'ta', 'tin', '-', 'dha', 'dha', 'dhin', '-'] }),
};
for (const t of Object.values(TAALS)) t.grid = thekaGrid(t);

// Film grooves (stylisations, not classical notation). 16th steps; hand kit unless noted.
export const GROOVES = {
  // dholak 3-3-2: low head on 1, the 'and' of 2, 4; high head answers; ghosts fill. One 4/4 bar.
  filmiKeherwa: { 65: 'X.....x.....x...', 67: '....x.....x...x.', 68: '..o...o.o.o...o.', 66: '.......o.......o' },
  // keherwa theka on dholak keys, with swing ~0.15 for a bhajan / qawwali lilt.
  bhajan: thekaGrid({ theka: ['dhin', 'dhin', 'na', 'ka', 'tin', 'tin', 'na', 'ka'] }, KEYS.dholak),
  // qawwali: heavy low head on 1 and 5, pushes before 3 and 7; claps (any clap sound) on matras 3 and 7 = steps 4 and 12.
  qawwali: { 65: 'X.....x.X.....x.', 67: '..x.x...o.x.x...', 68: 'o.o...o.o.o...o.', clapSteps: [4, 12] },
  // dadra on dholak: one 6/8 bar (12 steps), 'dha - ge na ti na' feel.
  dadraFilmi: { 65: 'X.....x...x.', 67: '..x.x...x...', 68: '....o.o....o' },
};

// Fills (bol strings, one step each; use bolGrid). A tirakita roll and a 'dha' landing.
export const FILLS = {
  tirakita: 'ti ra ki ta ti ra ki ta dha - - -',
  dhaRoll: 'dha ti ra ki ta dha ti ra ki ta dha -',
  khaliLift: 'ta - ti ra ki ta ta ka dhi - dha -',
};
// Tihai: a phrase three times with equal gaps so its last stroke lands on sam.
// phrase: bol string (one step per bol). Returns { start, grid } where grid starts `start` steps into the cycle
// (negative = that many steps before the cycle's start) and its last step is the next sam.
export function tihai(phrase, cycleSteps, { gap = 2, keys = KEYS.tabla } = {}) {
  const p = phrase.trim().split(/\s+/), all = [...p, ...Array(gap).fill('-'), ...p, ...Array(gap).fill('-'), ...p];
  const start = cycleSteps - (all.length - 1);
  return { start, steps: all.length, grid: bolGrid(all.join(' '), keys, { strong: [0, p.length + gap, 2 * (p.length + gap)] }) };
}
