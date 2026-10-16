// Melody and arrangement measurements a composer-program can check (it cannot listen).
// Rules, targets and sources: docs/theory-western.md. CLI over a piece's notes: tools/critique.mjs.
//
// Input everywhere is a "line": either melody bars as written in pieces ([[note|null, beats], …] per bar,
// a note may be [note, grace]) or an events array from events()/fromNotes(): { p (MIDI), t (beats from the
// start), d (beats), bar (0-based) }. Harmony is per-bar chord strings as in barChords ('Am7 D'), or a
// function t → { pcs: Set of pitch classes, sym }.
// Interval classes match tools/analyze.py so numbers compare with reference profiles: step = |iv| ≤ 2
// (repeats included), leap = |iv| ≥ 5, exact octaves left out of the shape stats.

import { midi, TPB } from './session.mjs';
import { barChords } from './music.mjs';

const NAMES = ['C', 'C#', 'D', 'Eb', 'E', 'F', 'F#', 'G', 'Ab', 'A', 'Bb', 'B'];
export const noteName = p => NAMES[p % 12] + (Math.floor(p / 12) - 1);
const pct = (a, b) => (b ? Math.round(a / b * 1000) / 10 : null);
const r2 = x => Math.round(x * 100) / 100;
const median = a => { const s = [...a].sort((x, y) => x - y); return s.length ? s[Math.floor(s.length / 2)] : null; };
const quantile = (a, q) => { const s = [...a].sort((x, y) => x - y); return s[Math.min(s.length - 1, Math.max(0, Math.round(q * (s.length - 1))))]; };
const EPS = 1e-6;

// ---------- Input ----------
// Bars → events. Grace notes are ornaments: counted, not analysed.
export function events(bars, { beats = 4 } = {}) {
  if (bars.length && bars[0] && typeof bars[0].p === 'number') return bars; // already events
  const out = [];
  let graces = 0;
  bars.forEach((b, i) => {
    let beat = 0;
    for (const [n, d] of b) {
      if (n) {
        const [note, g] = Array.isArray(n) ? n : [n, null];
        if (g) graces++;
        out.push({ p: midi(note), t: i * beats + beat, d, bar: i });
      }
      beat += d;
    }
  });
  out.graces = graces;
  return out;
}

// Snap a time in beats to the nearest 16th or triplet-8th, whichever is closer (humanised notes, pad offsets).
const snap = t => { const a = Math.round(t * 4) / 4, b = Math.round(t * 3) / 3; return Math.abs(b - t) < Math.abs(a - t) - EPS ? b : a; };

// Session notes ({pitch, start, length} in ticks) → a monophonic events line, as tools/analyze.py does for stems:
// drop grace notes (≤ graceTicks and followed by another onset within graceTicks), keep the highest note of
// each onset (skyline; `lowest` keeps the lowest, for a bass line), snap to the grid, cut each note at the next onset.
export function fromNotes(notes, { tpb = TPB, beats = 4, graceTicks = 150, lowest = false, from = 0, to = Infinity } = {}) {
  const ns = notes.filter(n => n.start >= from && n.start < to).sort((a, b) => a.start - b.start || a.pitch - b.pitch);
  let graces = 0;
  const kept = ns.filter((n, i) => {
    const next = ns.slice(i + 1).find(m => m.start > n.start + 20);
    const g = n.length <= graceTicks && next && next.start - n.start <= graceTicks && next.pitch !== n.pitch;
    if (g) graces++;
    return !g;
  });
  const by = new Map();
  for (const n of kept) {
    const t = snap(n.start / tpb), e = Math.max(snap((n.start + n.length) / tpb), t + 1 / 12);
    const k = Math.round(t * 12);
    const cur = by.get(k);
    if (!cur || (lowest ? n.pitch < cur.p : n.pitch > cur.p)) by.set(k, { p: n.pitch, t, d: e - t });
  }
  const out = [...by.values()].sort((a, b) => a.t - b.t);
  out.forEach((e, i) => { if (out[i + 1]) e.d = Math.min(e.d, out[i + 1].t - e.t); e.bar = Math.floor(e.t / beats + EPS); });
  out.graces = graces;
  return out;
}

// Phrases: split where the silence between notes exceeds `gap` beats (analyze.py uses one beat).
export function phrases(ev, { gap = 1 } = {}) {
  const out = [];
  ev.forEach((e, i) => {
    if (!i || e.t - (ev[i - 1].t + ev[i - 1].d) > gap + EPS) out.push([]);
    out[out.length - 1].push(e);
  });
  return out;
}

// ---------- Rhythm ----------
// Longuet-Higgins & Lee metrical weights on a 16th grid: bar 0, half bar -1, beat -2, 8th -3, 16th -4.
const lhlWeight = (k, beats) => {
  const s = ((k % (beats * 4)) + beats * 4) % (beats * 4);
  if (s === 0) return 0;
  if (beats % 2 === 0 && s === beats * 2) return -1;
  if (s % 4 === 0) return -2;
  return s % 2 === 0 ? -3 : -4;
};
// LHL (as computed by Smith & Honing / Sioros & Guedes): a note followed by silence or its own sustain over a
// stronger position before the next onset scores (that weight − its own). Off-grid (triplet) notes are skipped.
export function lhl(ev, { beats = 4 } = {}) {
  let total = 0, n = 0;
  ev.forEach((e, i) => {
    const s = e.t * 4; if (Math.abs(s - Math.round(s)) > EPS) return;
    const k = Math.round(s), end = Math.round((ev[i + 1] ? ev[i + 1].t : e.t + e.d) * 4);
    let best = -Infinity;
    for (let j = k + 1; j < end; j++) best = Math.max(best, lhlWeight(j, beats));
    const w = lhlWeight(k, beats);
    if (best > w) { total += best - w; n++; }
  });
  return { total, syncopated: n };
}
// Weighted note-to-beat distance (Gómez, Melvin, Rappaport & Toussaint 2005): per note, T = distance to the
// nearest beat (in beats); 0 on the beat, else 1/T, doubled when the note is held past the next beat but no
// further than the one after. Mean over notes.
export function wnbd(ev) {
  let s = 0;
  for (const e of ev) {
    const f = e.t - Math.floor(e.t + EPS), T = Math.min(f, 1 - f);
    if (T < EPS) continue;
    const e1 = Math.ceil(e.t - EPS), end = e.t + e.d;
    s += (end > e1 + EPS && end <= e1 + 1 + EPS ? 2 : 1) / T;
  }
  return ev.length ? s / ev.length : 0;
}

// ---------- Melody ----------
// Huron's three-point phrase contour: first note, mean of the middle, last note.
export function contour(ph) {
  if (ph.length < 3) return 'short';
  const I = ph[0].p, F = ph[ph.length - 1].p, M = ph.slice(1, -1).reduce((s, e) => s + e.p, 0) / (ph.length - 2);
  const c = (a, b) => (Math.abs(a - b) < 0.5 ? '=' : a < b ? '<' : '>');
  return { '<>': 'arch', '><': 'bowl', '<<': 'ascending', '>>': 'descending' }[c(I, M) + c(M, F)] ?? `level(${c(I, M)}${c(M, F)})`;
}

export function melodyStats(line, { beats = 4, gap = 1 } = {}) {
  const ev = events(line, { beats });
  const n = ev.length;
  if (n < 2) return { notes: n };
  const ivAll = ev.slice(1).map((e, i) => e.p - ev[i].p);
  const iv = ivAll.filter(x => Math.abs(x) !== 12);
  const ps = ev.map(e => e.p), med = median(ps);
  const phs = phrases(ev, { gap });
  const firstBar = ev[0].bar, lastBar = ev[n - 1].bar;
  const active = new Set(ev.map(e => e.bar)).size;
  // Onset position in the beat on the 16th grid (analyze.py's on/e/&/a); triplets counted apart.
  const pos = { on: 0, e: 0, '&': 0, a: 0, trip: 0 };
  for (const e of ev) { const f = (e.t % 1 + 1) % 1, k = f * 4; pos[Math.abs(k - Math.round(k)) > EPS ? 'trip' : ['on', 'e', '&', 'a'][Math.round(k) % 4]]++; }
  // Leaps and what follows them (post-skip reversal / gap fill, within a phrase).
  let leaps = 0, rev = 0, stepRev = 0, outLeaps = 0, outRev = 0;
  const phraseOf = new Map(); phs.forEach((ph, j) => ph.forEach(e => phraseOf.set(e, j)));
  for (let i = 0; i + 2 < n; i++) {
    const a = ev[i + 1].p - ev[i].p, b = ev[i + 2].p - ev[i + 1].p;
    if (Math.abs(a) < 5 || phraseOf.get(ev[i]) !== phraseOf.get(ev[i + 2])) continue;
    leaps++;
    const r = Math.sign(b) === -Math.sign(a);
    if (r) rev++;
    if (r && Math.abs(b) <= 2) stepRev++;
    if (Math.abs(ev[i + 1].p - med) > Math.abs(ev[i].p - med)) { outLeaps++; if (r) outRev++; }
  }
  const steps = iv.filter(x => x !== 0 && Math.abs(x) <= 2), bigs = iv.filter(x => Math.abs(x) >= 5);
  // High points: per phrase, how often its top note is struck and where it first falls (0 start .. 1 end).
  const peaks = phs.map(ph => {
    const hi = Math.max(...ph.map(e => e.p)), hits = ph.filter(e => e.p === hi);
    const t0 = ph[0].t, span = ph[ph.length - 1].t + ph[ph.length - 1].d - t0;
    return { hi: noteName(hi), hits: hits.length, at: r2((hits[0].t - t0) / span), bar: hits[0].bar + 1 };
  });
  const top = Math.max(...ps);
  const spanBeats = (lastBar - firstBar + 1) * beats;
  const sounding = ev.reduce((s, e) => s + e.d, 0);
  const ct = {}; for (const ph of phs) { const c = contour(ph); ct[c] = (ct[c] ?? 0) + 1; }
  const l = lhl(ev, { beats });
  return {
    notes: n, graces: ev.graces ?? 0, bars: lastBar - firstBar + 1, activeBars: active,
    stepPct: pct(iv.filter(x => Math.abs(x) <= 2).length, iv.length), leapPct: pct(bigs.length, iv.length),
    thirdPct: pct(iv.filter(x => Math.abs(x) === 3 || Math.abs(x) === 4).length, iv.length),
    repeatPct: pct(iv.filter(x => x === 0).length, iv.length), octavePct: pct(ivAll.length - iv.length, ivAll.length),
    meanInterval: r2(iv.reduce((s, x) => s + Math.abs(x), 0) / (iv.length || 1)),
    stepDownPct: pct(steps.filter(x => x < 0).length, steps.length), leapUpPct: pct(bigs.filter(x => x > 0).length, bigs.length),
    notesPerBar: r2(n / active), notesPerBarSpan: r2(n / (lastBar - firstBar + 1)),
    phrases: phs.length, phraseNotes: r2(n / phs.length), phraseBeats: r2(phs.reduce((s, ph) => s + ph[ph.length - 1].t + ph[ph.length - 1].d - ph[0].t, 0) / phs.length),
    restPct: pct(spanBeats - sounding, spanBeats),
    onset: Object.fromEntries(Object.entries(pos).map(([k, v]) => [k, pct(v, n)])), onBeatPct: pct(pos.on, n),
    lhlPerBar: r2(l.total / active), lhlSyncopatedPct: pct(l.syncopated, n), wnbd: r2(wnbd(ev)),
    range: [noteName(Math.min(...ps)), noteName(top)], rangeSemis: top - Math.min(...ps),
    range5_95: [noteName(quantile(ps, 0.05)), noteName(quantile(ps, 0.95))], median: noteName(med), medianMidi: med,
    highPointBars: [...new Set(ev.filter(e => e.p === top).map(e => e.bar + 1))],
    highPointAt: r2((ev.find(e => e.p === top).t - ev[0].t) / (ev[n - 1].t + ev[n - 1].d - ev[0].t)),
    peaks, multiPeakPhrases: peaks.filter(p => p.hits > 2).length,
    leaps, gapFillPct: pct(rev, leaps), stepFillPct: pct(stepRev, leaps), outwardLeaps: outLeaps, outwardReversalPct: pct(outRev, outLeaps),
    contour: ct,
  };
}

// ---------- Harmony ----------
// Per-bar chord strings → function t (beats) → { pcs, sym }.
export function harmonyFrom(harmony, { beats = 4 } = {}) {
  if (typeof harmony === 'function') return harmony;
  const parsed = harmony.map(s => (s ? barChords(s, beats) : []));
  return t => {
    const b = Math.floor(t / beats + EPS), x = t - b * beats, chs = parsed[b] ?? [];
    const c = [...chs].reverse().find(c => c.at <= x + EPS);
    return c ? { pcs: new Set(c.ch.tones), sym: c.ch.sym } : null;
  };
}
const soundingAt = (ev, t) => ev.find(e => e.t <= t + EPS && t < e.t + e.d - EPS);

// Which notes sounding on strong beats (default beats 1 and 3 in 4/4, 1 in 3/4) are chord tones, and what the
// others are: passing, neighbour, appoggiatura (leap in, step out), suspension (held over, resolves down a step),
// held (held over, no step-down resolution), free (anything else). Also chord-tone % over all onsets.
export function chordTonePct(line, harmony, { beats = 4, strong } = {}) {
  const ev = events(line, { beats }), H = harmonyFrom(harmony, { beats });
  strong ??= beats % 2 === 0 ? [0, beats / 2] : [0];
  if (!ev.length) return null;
  const nct = [], kinds = {};
  let n = 0, ok = 0;
  const end = ev[ev.length - 1].t + ev[ev.length - 1].d;
  for (let b = ev[0].bar; b * beats < end; b++) for (const s of strong) {
    const t = b * beats + s, e = soundingAt(ev, t), h = H(t);
    if (!e || !h) continue;
    n++;
    if (h.pcs.has(e.p % 12)) { ok++; continue; }
    const i = ev.indexOf(e), prev = ev[i - 1], next = ev[i + 1];
    const a = prev ? e.p - prev.p : null, z = next ? next.p - e.p : null;
    let kind = 'free';
    if (e.t < t - EPS) kind = z != null && z < 0 && z >= -2 ? 'suspension' : 'held';
    else if (a != null && z != null && Math.abs(a) <= 2 && Math.abs(z) <= 2 && a && z) kind = Math.sign(a) === Math.sign(z) ? 'passing' : 'neighbour';
    else if (a != null && z != null && Math.abs(a) >= 3 && Math.abs(z) <= 2 && z) kind = 'appoggiatura';
    kinds[kind] = (kinds[kind] ?? 0) + 1;
    nct.push({ bar: b + 1, beat: s + 1, note: noteName(e.p), chord: h.sym ?? [...h.pcs].map(p => NAMES[p]).join(''), kind });
  }
  const all = ev.filter(e => { const h = H(e.t); return h && h.pcs.has(e.p % 12); }).length;
  return { strongBeats: n, strongPct: pct(ok, n), allOnsetsPct: pct(all, ev.filter(e => H(e.t)).length), kinds, nct };
}

// ---------- Two lines ----------
// Parallel perfect fifths / octaves (and unisons) between a lead and another monophonic line: consecutive
// simultaneities (at every onset of either) where both voices move in the same direction and stay a P5 or P8 apart.
// doublingPct: share of lead time doubled at the unison/octave (a doubled line, not a voice-leading slip).
export function parallelsAgainst(lead, other, { beats = 4 } = {}) {
  const A = events(lead, { beats }), B = events(other, { beats });
  const times = [...new Set([...A, ...B].map(e => e.t))].sort((x, y) => x - y);
  const out = [];
  let prev = null, both = 0, doubled = 0;
  for (const t of times) {
    const a = soundingAt(A, t), b = soundingAt(B, t);
    if (!a || !b) { prev = null; continue; }
    const ic = Math.abs(a.p - b.p) % 12;
    both++; if (ic === 0) doubled++;
    if (prev && (ic === 0 || ic === 7) && prev.ic === ic && a.p !== prev.a && b.p !== prev.b && Math.sign(a.p - prev.a) === Math.sign(b.p - prev.b))
      out.push({ bar: Math.floor(t / beats + EPS) + 1, beat: r2(t % beats + 1), type: ic ? 'P5' : 'P8', lead: [noteName(prev.a), noteName(a.p)], other: [noteName(prev.b), noteName(b.p)] });
    prev = { a: a.p, b: b.p, ic };
  }
  return { parallels: out, simultaneities: both, doublingPct: pct(doubled, both) };
}

// Register crowding: of the lead's onsets with the other part sounding, how often the other is above the lead
// (crossing; the lead loses the top) or within `near` semitones of it (masking risk; arrange an octave away).
export function registerAgainst(lead, others, { beats = 4, near = 2 } = {}) {
  const A = events(lead, { beats }), B = Array.isArray(others[0]) ? others : [others];
  let n = 0, above = 0, close = 0;
  for (const a of A) {
    const s = B.flatMap(ev => ev.filter(e => e.t <= a.t + EPS && a.t < e.t + e.d - EPS).map(e => e.p));
    if (!s.length) continue;
    n++;
    if (s.some(p => p > a.p)) above++;
    if (s.some(p => Math.abs(p - a.p) <= near && p !== a.p)) close++;
  }
  return { overlaps: n, abovePct: pct(above, n), nearPct: pct(close, n) };
}

// ---------- Repetition ----------
// How much the line repeats itself (transposition-free): share of notes inside a k-interval (k+1 note) pattern that recurs
// (pitch: intervals; rhythm: inter-onset times; both), share of bars whose rhythm / shape repeats an earlier bar,
// and the commonest patterns.
export function motifRepetition(line, { beats = 4, k = 3 } = {}) {
  const ev = events(line, { beats });
  const ioi = ev.map((e, i) => r2((ev[i + 1]?.t ?? e.t + e.d) - e.t));
  const iv = ev.map((e, i) => (ev[i + 1] ? ev[i + 1].p - e.p : 0));
  const cover = key => {
    const m = new Map(), keys = [];
    for (let i = 0; i + k < ev.length; i++) { const s = key(i); keys.push(s); m.set(s, (m.get(s) ?? 0) + 1); }
    const covered = new Set();
    keys.forEach((s, i) => { if (m.get(s) > 1) for (let j = i; j <= i + k; j++) covered.add(j); });
    return { pct: pct(covered.size, ev.length), top: [...m].filter(([, c]) => c > 1).sort((a, b) => b[1] - a[1]).slice(0, 3) };
  };
  const pitch = cover(i => iv.slice(i, i + k).join(',')), rhythm = cover(i => ioi.slice(i, i + k).join(','));
  const both = cover(i => iv.slice(i, i + k).map((x, j) => `${x}/${ioi[i + j]}`).join(','));
  const bars = new Map();
  for (const e of ev) { if (!bars.has(e.bar)) bars.set(e.bar, []); bars.get(e.bar).push(e); }
  const seenR = new Set(), seenS = new Set();
  let rRep = 0, sRep = 0;
  for (const b of [...bars.keys()].sort((x, y) => x - y)) {
    const es = bars.get(b);
    const r = es.map(e => r2(e.t - b * beats) + ':' + r2(e.d)).join(' '), s = r + '|' + es.map(e => e.p - es[0].p).join(',');
    if (seenR.has(r)) rRep++; else seenR.add(r);
    if (seenS.has(s)) sRep++; else seenS.add(s);
  }
  return { pitchPct: pitch.pct, rhythmPct: rhythm.pct, bothPct: both.pct, barRhythmRepeatPct: pct(rRep, bars.size), barShapeRepeatPct: pct(sRep, bars.size), topIntervalPatterns: pitch.top };
}

// ---------- Targets and critique ----------
// [lo, hi] per measure. Lead-line defaults: the Hindi-film reference vocals (RULES.md 4c) where measured, else
// the research in docs/theory-western.md (marked there as firm or heuristic). Pass overrides per style.
export const TARGETS = {
  stepPct: [60, 75],          // refs 65–70 (|iv| ≤ 2, repeats included); folk/pop corpora are step-dominated
  leapPct: [12, 30],          // refs 19–27
  repeatPct: [8, 35],         // refs 26–30 (transcribed vocals; an instrumental line repeats less)
  notesPerBar: [4, 8],        // refs 6.4–6.9
  phraseNotes: [10, 26],      // refs 22–25; shorter instrumental phrases are fine
  onBeatPct: [20, 45],        // refs 26–35; a line mostly on beats sounds square in this style
  restPct: [10, 40],          // breathing space inside the line (heuristic)
  rangeSemis: [9, 19],        // an octave to an octave-and-a-sixth for one line (heuristic)
  gapFillPct: [55, 100],      // post-skip reversal: most leaps turn back (von Hippel & Huron; heuristic bound)
  stepDownPct: [50, 75],      // step declination: small intervals mostly fall (Vos & Troost; heuristic bound)
  highPointAt: [0.35, 0.9],   // the line's peak after its opening, before the very end (heuristic)
  strongPct: [65, 95],        // strong-beat chord tones; lower reads as wrong notes unless they are appoggiaturas
  pitchPct: [30, 90],         // motif coverage: memorable but not a loop (heuristic)
  barRhythmRepeatPct: [20, 75],
};

// Returns { stats, harmony, motif, warnings }; prints when print is true.
export function critique(name, line, { harmony, beats = 4, targets = {}, print = true } = {}) {
  const T = { ...TARGETS, ...targets };
  const stats = melodyStats(line, { beats });
  const harm = harmony ? chordTonePct(line, harmony, { beats }) : null;
  const motif = motifRepetition(line, { beats });
  const all = { ...stats, ...(harm ? { strongPct: harm.strongPct } : {}), ...motif };
  const warnings = [];
  // Over more than 16 bars, repeated sections make motif numbers trivially high and the peak position meaningless.
  const skip = stats.bars > 16 ? new Set(['pitchPct', 'barRhythmRepeatPct', 'highPointAt']) : new Set();
  for (const [k, [lo, hi]] of Object.entries(T)) {
    const v = all[k];
    if (skip.has(k)) continue;
    if (v == null || Number.isNaN(v)) continue;
    if (v < lo) warnings.push(`${k} ${v} below ${lo}–${hi}`);
    else if (v > hi) warnings.push(`${k} ${v} above ${lo}–${hi}`);
  }
  if (stats.multiPeakPhrases) warnings.push(`${stats.multiPeakPhrases} phrase(s) strike their high note 3+ times (no single climax)`);
  if (harm?.kinds?.free) warnings.push(`${harm.kinds.free} unprepared non-chord tone(s) on strong beats: ${harm.nct.filter(x => x.kind === 'free').slice(0, 4).map(x => `bar ${x.bar}.${x.beat} ${x.note}/${x.chord}`).join(', ')}`);
  if (print) {
    console.log(`\n== ${name}: ${stats.notes} notes over ${stats.bars} bars (${stats.phrases} phrases, ${stats.graces} graces)`);
    console.log(`  intervals  step ${stats.stepPct}%  leap ${stats.leapPct}%  third ${stats.thirdPct}%  repeat ${stats.repeatPct}%  mean ${stats.meanInterval} st  steps down ${stats.stepDownPct}%  leaps up ${stats.leapUpPct}%`);
    console.log(`  density    ${stats.notesPerBar}/active bar (${stats.notesPerBarSpan}/bar over span)  phrase ${stats.phraseNotes} notes / ${stats.phraseBeats} beats  rest ${stats.restPct}%`);
    console.log(`  rhythm     on ${stats.onset.on}%  e ${stats.onset.e}%  & ${stats.onset['&']}%  a ${stats.onset.a}%${stats.onset.trip ? `  triplet ${stats.onset.trip}%` : ''}  LHL ${stats.lhlPerBar}/bar  WNBD ${stats.wnbd}`);
    console.log(`  pitch      ${stats.range.join('–')} (${stats.rangeSemis} st; 5–95% ${stats.range5_95.join('–')}), median ${stats.median}; top in bar(s) ${stats.highPointBars.join(',')} at ${stats.highPointAt} of the line`);
    console.log(`  shape      leaps ${stats.leaps}: reverse ${stats.gapFillPct}%, by step ${stats.stepFillPct}%; outward leaps ${stats.outwardLeaps} reverse ${stats.outwardReversalPct}%  contours ${JSON.stringify(stats.contour)}`);
    console.log(`  motif      pitch ${motif.pitchPct}%  rhythm ${motif.rhythmPct}%  both ${motif.bothPct}%  bar rhythm repeats ${motif.barRhythmRepeatPct}%  bar shape repeats ${motif.barShapeRepeatPct}%`);
    if (harm) console.log(`  harmony    strong-beat chord tones ${harm.strongPct}% of ${harm.strongBeats}  (all onsets ${harm.allOnsetsPct}%)  non-chord: ${JSON.stringify(harm.kinds)}`);
    for (const w of warnings) console.log(`  ! ${w}`);
  }
  return { stats, harmony: harm, motif, warnings };
}
