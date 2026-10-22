// Western / futuristic instrument presets, from pieces/future-lab.mjs (owner kept every one, 2026-10-22).
// Usage: const P = presets(bpm);  const ev = s.instrument('EVDrive', P.evDrive);
//        override with a spread: s.instrument('Lead', { ...P.evDrive, volume: -2, pan: 0 }).
// Volumes balance each preset to about -12..-22 dB RMS alone at velocity 85-100 (RULES 4f). Sends go to a
// reverb named `hall` (default 'Hall'): create it in the piece with s.reverb(hall, 'plate_reverb', {...}).

export const eq = (type, freq, gain = 0, q = 0.7) => ({ plugin: 'eq_1band', params: { type, freq, gain, q } });
export const syn = params => ({ plugin: 'subtractive_synth', params });

export function presets(bpm, hall = 'Hall') {
  const beat = 60000 / bpm;
  const delay = (beats, feedback, mix) => ({ plugin: 'mod_delay', params: { time: Math.round(beat * beats), feedback, mix, lpf: 7000 } });
  const send = db => ({ [hall]: db });

  // Electric violin: the Iowa solo violin (dry, mono) through amp-like chains.
  const vn = { zones: 'violin_solo', sampler: { attack: 12, release: 220, velocity: 40, level: 4 }, sends: send(-10), pan: 0.1 };
  // Brass: Iowa solo (ff only) and VSCO sections; their raw levels differ a lot (RULES 4e).
  const solo = (zones, volume, pan) => ({ zones, sampler: { attack: 20, release: 260, velocity: 30, level: 6 }, sends: send(-9), volume, pan, maxShift: 7 });
  const sect = (zones, volume, pan, extra = {}) => ({ zones, sampler: { attack: 15, release: 300, velocity: 45, level: 2 }, sends: send(-7), volume, pan, maxShift: 7, ...extra });
  const hit = (zones, volume, extra = {}) => ({ zones, oneShot: true, sampler: { attack: 0.5, release: 600, velocity: 50 }, sends: send(-10), volume, ...extra });

  return {
    evClean: { ...vn, inserts: [eq(3, 180), delay(0.75, 25, 18)] },
    evDrive: { ...vn, volume: -4.5, inserts: [eq(3, 220), { plugin: 'saturator', params: { drive: 16, tone: 6500, mix: 75 } }, { plugin: 'chorus', params: { rate: 0.4, depth: 25, mix: 25 } }, delay(0.75, 30, 20)] },
    evOctave: { ...vn, volume: -1, inserts: [eq(3, 120), { plugin: 'pitch_shifter', params: { semitones: -12, mix: 40 } }, { plugin: 'saturator', params: { drive: 10, tone: 5000, mix: 60 } }, delay(0.75, 25, 18)] },
    evPhaser: { ...vn, inserts: [eq(3, 220), { plugin: 'saturator', params: { drive: 8, tone: 8000, mix: 50 } }, { plugin: 'phaser', params: { rate: 0.35, depth: 80, stages: 3, feedback: 55, mix: 55 } }, delay(0.5, 35, 22)] },
    // Saw layer to double an electric violin line (same notes, legato 0).
    evSaw: { synth: syn({ osc1_wave: 0, osc2_wave: 0, osc2_detune: 7, osc_mix: 50, cutoff: 2400, resonance: 15, filter_env_amount: 20, filter_decay: 250, filter_sustain: 60, amp_attack: 15, amp_decay: 300, amp_sustain: 80, amp_release: 200, glide: 40, level: -16 }),
      inserts: [eq(3, 250), { plugin: 'chorus', params: { rate: 0.5, depth: 40, mix: 40 } }], sends: send(-12), volume: -4, pan: -0.15 },

    trumpetSolo: solo('trumpet_iowa', 1, 0.2), hornSolo: solo('horns_iowa', 2, -0.2), tromboneSolo: solo('trombone_iowa', 12, 0.15), tubaSolo: solo('tuba_iowa', 4, -0.1),
    trumpets: sect('trumpet', -3, 0.25), horns: sect('horns', 3, -0.3), tuba: sect('tuba', 12, 0),
    trombones: sect('trombones', 12, 0.3, { sampler: { attack: 15, release: 300, velocity: 45, level: 6 } }), // quietest: about -22 dB even at max
    trumpetsStac: sect('trumpet_stac', 0, 0.25, { oneShot: true }), hornsStac: sect('horns_stac', 2, -0.3, { oneShot: true }),
    trombonesStac: sect('trombones_stac', 0, 0.3, { oneShot: true }), tubaStac: sect('tuba_stac', 2, 0, { oneShot: true }),
    // Braam: low trombones plus an octave below, driven. Play D2 A2 D3 F3 together, with tubaSolo D2 and perc gong 52.
    braam: { zones: 'trombones', sampler: { attack: 60, release: 900, velocity: 30, level: 4 }, sends: send(-5), volume: 0, maxShift: 7,
      inserts: [{ plugin: 'pitch_shifter', params: { semitones: -12, mix: 45 } }, { plugin: 'saturator', params: { drive: 12, tone: 4000, mix: 60 } }, eq(3, 35)] },

    // Metallic percussion. Pitched ranges: crotales 84-108, vibes 53-88, Thai gong 60-72.
    crotales: hit('crotales', 5, { pan: 0.3 }), vibes: hit('vibes_hard', 3, { pan: -0.2 }), thaiGong: hit('thai_gong', 0),
    vibesBow: { zones: 'vibes_bow', sampler: { attack: 200, release: 1200, velocity: 30, level: 6 }, sends: send(-6), volume: -3 },
    // perc keys: 51 sus cymbal, 52 gong, 53 cymbal swell, 56 cowbell, 61 triangle, 63 anvil, 64-70 timpani.
    perc: { zones: 'perc', oneShot: true, sampler: { attack: 0.5, release: 500, velocity: 60 }, sends: send(-12), volume: 4 },
    // phil_perc keys: 60 hand cymbals, 66 agogo, 68 cowbell, 74 triangle, 75 bell tree, 76 chimes, 77 Thai gong, 78 tam-tam, 81 clash, 82 sus cymbal.
    philPerc: { zones: 'phil_perc', oneShot: true, sampler: { attack: 0.5, release: 600, velocity: 50 }, sends: send(-10), volume: 8 },
    metalFX: hit('crotales', 12, { inserts: [{ plugin: 'rectifier', params: { mode: 1, mix: 45 } }, { plugin: 'flanger', params: { rate: 0.15, depth: 80, feedback: 70, mix: 50 } }, delay(0.75, 45, 30)] }),
    gongDown: hit('thai_gong', 5, { inserts: [{ plugin: 'pitch_shifter', params: { semitones: -12, mix: 100 } }, eq(3, 40)] }),
    anvilDelay: { zones: 'perc', oneShot: true, sampler: { attack: 0.5, release: 400, velocity: 60 }, sends: send(-14), volume: 11, pan: -0.25, inserts: [eq(2, 2500, -3), delay(0.75, 40, 35)] },
    drums: { synth: { plugin: 'drum_synth', params: { level: -6, kick_decay: 520, kick_tune: -4, snare_snappy: 80, snare_decay: 220, hat_decay: 35, open_hat_decay: 260, cymbal_decay: 2000 } },
      inserts: [{ plugin: 'compressor', params: { threshold: -16, ratio: 4, attack: 5, release: 100, makeup: 3 } }], sends: send(-16), volume: 3 },

    // Synths.
    pad: { synth: syn({ osc1_wave: 0, osc2_wave: 0, osc2_detune: 14, osc_mix: 50, cutoff: 1400, resonance: 10, filter_env_amount: 10, amp_attack: 700, amp_decay: 1000, amp_sustain: 85, amp_release: 1500, level: -12 }),
      inserts: [{ plugin: 'chorus', params: { rate: 0.3, depth: 50, mix: 50 } }, eq(3, 180)], sends: send(-6), volume: 11, pan: -0.15 },
    arp: { synth: syn({ osc1_wave: 1, osc2_wave: 0, osc2_detune: 6, osc_mix: 40, cutoff: 1900, resonance: 35, filter_env_amount: 40, filter_decay: 150, filter_sustain: 15, amp_attack: 1, amp_decay: 160, amp_sustain: 20, amp_release: 120, level: -12 }),
      inserts: [delay(0.75, 35, 25), eq(3, 220)], sends: send(-12), volume: 12, pan: 0.3 },
    bass: { synth: syn({ osc1_wave: 0, osc2_wave: 1, osc2_semitones: -12, osc_mix: 50, cutoff: 300, resonance: 30, filter_env_amount: 55, filter_decay: 120, filter_sustain: 10, amp_attack: 1, amp_decay: 180, amp_sustain: 40, amp_release: 60, level: -8 }),
      inserts: [{ plugin: 'saturator', params: { drive: 5, mix: 45 } }, eq(3, 30)], volume: 12 },
    synthLead: { synth: syn({ osc1_wave: 0, osc2_wave: 1, osc2_detune: 8, osc_mix: 45, cutoff: 3000, resonance: 20, filter_env_amount: 25, filter_decay: 300, filter_sustain: 50, amp_attack: 5, amp_sustain: 80, amp_release: 200, glide: 90, level: -12 }),
      inserts: [delay(0.75, 30, 20)], sends: send(-10), volume: 12 },
    tremPhaser: { zones: 'violins_trem', sampler: { attack: 80, release: 500, velocity: 40, level: 4 }, sends: send(-8), volume: 0,
      inserts: [{ plugin: 'phaser', params: { rate: 0.25, depth: 90, stages: 4, feedback: 60, mix: 60 } }, eq(3, 200)] },
  };
}
