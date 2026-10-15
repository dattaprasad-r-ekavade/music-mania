// Builds a SoundCraft script from notes played on sampled instruments (samples/zones.json).
//
// SoundCraft's sampler holds one sample per track, so each instrument becomes one track per
// sample zone it actually uses (root note x velocity layer). Every note is routed to the zone
// whose layer covers its velocity and whose root is nearest its pitch. Zone tracks feed a bus
// per instrument; an aux "group" track per instrument carries its level, pan, inserts and a
// send to a shared reverb.
//
// Script mode can't read back the ids commands return, so ids are predicted: tracks, loaded
// samples and clips share one counter in creation order (measured). render.mjs checks the
// predicted clip ids against what SoundCraft reports.

import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import path from 'node:path';

export const TPB = 960; // ticks per beat (measured)
const SAMPLES = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../../samples');
const ZONES = JSON.parse(readFileSync(path.join(SAMPLES, 'zones.json'), 'utf8'));

const PC = { C: 0, D: 2, E: 4, F: 5, G: 7, A: 9, B: 11 };
export const midi = n => {
  if (typeof n === 'number') return n;
  const m = /^([A-G])(#|b)?(-?\d)$/.exec(n);
  if (!m) throw new Error(`bad note ${n}`);
  return 12 * (+m[3] + 1) + PC[m[1]] + (m[2] === '#' ? 1 : m[2] === 'b' ? -1 : 0);
};

// Seeded RNG so humanisation is reproducible.
export function rng(seed) {
  return () => {
    seed |= 0; seed = (seed + 0x6d2b79f5) | 0;
    let t = Math.imul(seed ^ (seed >>> 15), 1 | seed);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

export class Session {
  constructor({ bpm, beatsPerBar = 4 }) {
    this.bpm = bpm;
    this.bar = TPB * beatsPerBar;
    this.instruments = [];
    this.reverbs = [];
    this.masterInserts = [];
  }

  // opts: { zones: key in zones.json, sampler: {attack, decay, sustain, release, velocity, level},
  //         volume (dB), pan, inserts: [{plugin, params}], sends: {reverbName: dB}, maxShift (semitones) }
  instrument(name, opts) {
    const inst = { name, notes: [], maxShift: 4, ...opts, zones: ZONES[opts.zones] };
    if (!inst.zones) throw new Error(`no zones for ${opts.zones}`);
    this.instruments.push(inst);
    return {
      // start and length in ticks; pitch as note name or MIDI number
      note: (pitch, start, length, velocity) => inst.notes.push({ pitch: midi(pitch), start: Math.max(0, Math.round(start)), length: Math.max(10, Math.round(length)), velocity: Math.max(1, Math.min(127, Math.round(velocity))) }),
    };
  }

  reverb(name, plugin, params) { this.reverbs.push({ name, plugin, params }); }
  master(plugin, params) { this.masterInserts.push({ plugin, params }); }

  zoneFor(inst, n) {
    let best = null;
    for (const z of inst.zones) {
      if (n.velocity < z.vel_low || n.velocity > z.vel_high) continue;
      const d = Math.abs(n.pitch - z.root) + (n.pitch < z.root ? 0.1 : 0); // tie: prefer shifting up
      if (!best || d < best.d) best = { z, d };
    }
    if (!best) throw new Error(`${inst.name}: no zone for velocity ${n.velocity}`);
    if (best.d > inst.maxShift) throw new Error(`${inst.name}: note ${n.pitch} is ${Math.round(best.d)} semitones from the nearest sample (${best.z.root})`);
    return best.z;
  }

  build(endTicks) {
    const out = [];
    const cmd = (id, args) => out.push(`${id} ${JSON.stringify(args)}`);
    let nextId = 1;

    // Assign notes to zone tracks.
    const tracks = [];
    for (const inst of this.instruments) {
      const byZone = new Map();
      for (const n of inst.notes) {
        const z = this.zoneFor(inst, n);
        if (!byZone.has(z)) byZone.set(z, []);
        byZone.get(z).push(n);
      }
      for (const [z, notes] of [...byZone].sort((a, b) => a[0].root - b[0].root || a[0].vel_low - b[0].vel_low))
        tracks.push({ inst, zone: z, notes, name: `${inst.name} ${z.root} ${z.layer}` });
      // A note held past the end of its sample (shortened further when shifted up) goes silent early.
      const secs = ticks => ticks / TPB * 60 / this.bpm;
      const short = inst.notes.filter(n => { const z = this.zoneFor(inst, n); return secs(n.length) > z.seconds / 2 ** ((n.pitch - z.root) / 12) - 0.2; });
      if (short.length) console.warn(`${inst.name}: ${short.length} notes outlast their samples (first at bar ${Math.floor(short[0].start / this.bar) + 1})`);
    }

    cmd('event.tempo', { bpm: this.bpm });
    // 1. All tracks: zone tracks, instrument group auxes, reverb returns.
    for (const t of tracks) { cmd('track.new', { kind: 'instrument', name: t.name, instrument: 'sampler' }); t.id = nextId++; }
    for (const inst of this.instruments) { cmd('track.new', { kind: 'aux', name: `${inst.name} grp` }); nextId++; }
    for (const r of this.reverbs) { cmd('track.new', { kind: 'aux', name: r.name }); nextId++; }
    // 2. Samples (each load creates a source id).
    for (const t of tracks) {
      cmd('mix.sampler_load', {
        track: t.name, path: path.join(SAMPLES, t.zone.path).replace(/\\/g, '/'),
        params: { root_note: t.zone.root, key_low: 0, key_high: 127, vel_low: 1, vel_high: 127, fine_tune: t.zone.fine_tune, decay: 10000, sustain: 100, ...t.inst.sampler, level: (t.inst.sampler?.level ?? 0) + (t.zone.level_trim ?? 0) },
      });
      nextId++;
    }
    // 3. One clip per zone track, then its notes.
    const end = `${Math.ceil(endTicks / this.bar) + 1}|1|000`;
    const expectedClips = [];
    for (const t of tracks) { cmd('midi.new_clip', { track: t.name, start: '1|1|000', end }); t.clip = nextId++; expectedClips.push(t.clip); }
    for (const t of tracks)
      for (const n of t.notes.sort((a, b) => a.start - b.start))
        cmd('midi.note_add', { clip: t.clip, pitch: n.pitch, start_ticks: n.start, length_ticks: n.length, velocity: n.velocity });
    // 4. Routing and mix (no ids needed from here on).
    for (const inst of this.instruments) {
      cmd('mix.new_bus', { name: `${inst.name} bus` });
      cmd('track.output', { tracks: tracks.filter(t => t.inst === inst).map(t => t.name), output: `${inst.name} bus` });
      cmd('track.input', { tracks: [`${inst.name} grp`], input: `${inst.name} bus` });
    }
    for (const r of this.reverbs) {
      cmd('mix.new_bus', { name: `${r.name} bus` });
      cmd('track.input', { tracks: [r.name], input: `${r.name} bus` });
      cmd('mix.insert', { track: r.name, slot: 0, plugin: r.plugin, params: { mix: 100, ...r.params } });
    }
    for (const inst of this.instruments) {
      const grp = `${inst.name} grp`;
      (inst.inserts ?? []).forEach((ins, slot) => cmd('mix.insert', { track: grp, slot, plugin: ins.plugin, params: ins.params }));
      Object.entries(inst.sends ?? {}).forEach(([r, db], slot) => cmd('mix.send', { track: grp, slot, bus: `${r} bus`, level_db: db }));
      if (inst.volume != null) cmd('mix.volume', { tracks: [grp], db: inst.volume });
      if (inst.pan != null) cmd('mix.pan', { tracks: [grp], pan: inst.pan });
    }
    if (this.masterInserts.length) {
      cmd('track.new', { kind: 'master' }); // always named "Master 1", whatever name is passed (measured)
      this.masterInserts.forEach((ins, slot) => cmd('mix.insert', { track: 'Master 1', slot, plugin: ins.plugin, params: ins.params }));
    }
    return { script: out.join('\n') + '\n', expectedClips, trackCount: tracks.length };
  }
}
