"""Builds samples/zones.json: one entry per sample zone, with the note it really plays.

Usage: python -I tools/zones.py                      # rebuild every instrument
       python -I tools/zones.py --only vibes,hand      # rebuild only these, keep the rest of zones.json as it is
       (fetch samples first, e.g. node tools/assets.mjs pull "samples/vcsl/Idiophones/Struck Idiophones/Vibraphone/")

Root notes come from the file name plus a per-library octave offset (VSCO names most
instruments an octave below sounding pitch; measured, see README of this folder).
Each sample's pitch is then measured; if it is within 50 cents of the named note the
deviation becomes `fine_tune`, otherwise the zone is flagged and kept untuned.
Sustained instruments also get `level_trim` (dB, within +/-6): VSCO samples vary by up to 10 dB
from note to note, which makes a sustained line bump unevenly.
"""
import glob, json, os, re, sys
import numpy as np, soundfile as sf

ROOT = os.path.join(os.path.dirname(os.path.abspath(__file__)), '..', 'samples')
PC = {'C': 0, 'D': 2, 'E': 4, 'F': 5, 'G': 7, 'A': 9, 'B': 11}
ACC = {'': 0, '#': 1, 's': 1, 'b': -1}  # sharps are '#' (VSCO, VCSL) or 's' (Philharmonia: As3); Iowa names flats (Bb3)

# name: (glob, regex with groups note/acc/oct/layer, octave offset, {layer: (vel_low, vel_high)}, measure-at seconds).
# Measure-at None = don't measure: the piano keeps Salamander's own 'retuned' offsets (Data/tune_ret.txt; a real
# piano is stretch-tuned, which measuring would undo) and the harp's plucked attacks fool the pitch detector.
# Piano layers are a subset of Salamander's 16, with velocity ranges following its own map (Data/notes.txt).
INSTRUMENTS = {
    'piano': ('salamander/Samples/*.flac', r'^(?P<n>[A-G])(?P<a>#?)(?P<o>\d)v(?P<l>\d+)\.flac$', 0,
              {'4': (1, 46), '7': (47, 64), '10': (65, 88), '13': (89, 112), '16': (113, 127)}, None),
    'violins': ('vsco2/Strings/Violin Section/susVib/*.wav', r'_(?P<n>[A-G])(?P<a>#?)(?P<o>\d)_v(?P<l>\d)\.wav$', 12,
                {'1': (1, 80), '2': (81, 127)}, 0.6),
    'violas': ('vsco2/Strings/Viola Section/susvib/*.wav', r'_(?P<n>[A-G])(?P<a>#?)(?P<o>\d)_v(?P<l>\d)_1\.wav$', 12,
               {'1': (1, 80), '2': (81, 127)}, 0.6),
    'cellos': ('vsco2/Strings/Cello Section/susvib/*.wav', r'_(?P<n>[A-G])(?P<a>#?)(?P<o>\d)_v(?P<l>\d)_1\.wav$', 12,
               {'1': (1, 80), '3': (81, 127)}, 0.6),
    'harp': ('vsco2/Strings/Harp/*.wav', r'_(?P<n>[A-G])(?P<a>#?)(?P<o>\d)_(?P<l>mp|mf|f)\.wav$', 0,
             {'mp': (1, 127), 'mf': (1, 127), 'f': (1, 127)}, None),
    'flute': ('vsco2/Woodwinds/Flute/susvib/*.wav', r'_(?P<n>[A-G])(?P<a>#?)(?P<o>\d)_v(?P<l>\d)_1\.wav$', 12,
              {'1': (1, 127)}, 0.6),
}


# Instruments added for the themed collection. Same idea, with less hand work:
#   octave 'auto' = measure every file and use the most common octave offset between name and sound;
#   velocity ranges are split evenly between the layers found, quietest first;
#   files differing only in `r` are round robins (alternated by session.mjs on repeated notes);
#   tune / trim: apply measured fine-tune and level evening (sustained sounds only);
#   lead: measure the silence before each attack and skip it with the sampler's `start` (Philharmonia MP3s carry
#     24-280 ms of encoder padding and room tone, Iowa 50-80 ms), so notes land on the beat; True = attack starts
#     30 dB below the peak (bowed and blown swells), a number = that threshold (-12 for plucked and struck);
#   prefer: when several files play the same note and layer (Iowa strings record each note on every string),
#     keep the first whose name contains an entry of this list;
#   skip: file names left out (bad takes found by measurement).
V = r'_(?P<n>[A-G])(?P<a>#?)(?P<o>\d)_v(?P<l>\d)'
AUTO = {
    'violins_spic': dict(glob='vsco2/Strings/Violin Section/Spic/*.wav', rx=V + r'_rr(?P<r>\d)\.wav$', t0=0.05),
    'violins_pizz': dict(glob='vsco2/Strings/Violin Section/Pizz/*.wav', rx=V + r'_rr(?P<r>\d)\.wav$', t0=0.05),
    'violins_trem': dict(glob='vsco2/Strings/Violin Section/Trem/*.wav', rx=V + r'\.wav$', t0=0.5, tune=True, trim=True),
    'violas_spic': dict(glob='vsco2/Strings/Viola Section/spic/*.wav', rx=V + r'_rr(?P<r>\d)\.wav$', t0=0.05),
    'cellos_spic': dict(glob='vsco2/Strings/Cello Section/spic/*.wav', rx=V + r'_RR(?P<r>\d)\.wav$', t0=0.05),
    'cellos_pizz': dict(glob='vsco2/Strings/Cello Section/pizzT/*.wav', rx=V + r'_RR(?P<r>\d)\.wav$', t0=0.05),
    'cellos_trem': dict(glob='vsco2/Strings/Cello Section/trem/*.wav', rx=V + r'_1\.wav$', t0=0.5, tune=True, trim=True),
    'horns': dict(glob='vsco2/Brass/F Horn/sus/*.wav', rx=V + r'_1\.wav$', t0=0.5, tune=True, trim=True),
    'horns_stac': dict(glob='vsco2/Brass/F Horn/stac/*.wav', rx=V + r'_rr(?P<r>\d)\.wav$', t0=0.06),
    'trombones': dict(glob='vsco2/Brass/Tenor Trombone/sus/*.wav', rx=V + r'_1\.wav$', t0=0.5, tune=True, trim=True),
    'trombones_stac': dict(glob='vsco2/Brass/Tenor Trombone/stac/*.wav', rx=V + r'_rr(?P<r>\d)\.wav$', t0=0.06),
    'trumpet': dict(glob='vsco2/Brass/Trumpet/sus/*.wav', rx=V + r'_rr1\.wav$', t0=0.5, tune=True, trim=True),
    'trumpet_harmon': dict(glob='vsco2/Brass/Trumpet/harmonM-sus/*.wav', rx=V + r'_rr1\.wav$', t0=0.5, tune=True, trim=True),
    'trumpet_stac': dict(glob='vsco2/Brass/Trumpet/stac/*.wav', rx=V + r'_rr(?P<r>\d)\.wav$', t0=0.06),
    'tuba': dict(glob='vsco2/Brass/Tuba/sus/*.wav', rx=V + r'_rr1_Mid\.wav$', t0=0.5, tune=True, trim=True),
    'tuba_stac': dict(glob='vsco2/Brass/Tuba/stac/*.wav', rx=V + r'_rr(?P<r>\d)_Sum\.wav$', t0=0.06),
    'oboe': dict(glob='vsco2/Woodwinds/Oboe/Vib/*.wav', rx=V + r'_Main\.wav$', t0=0.5, tune=True, trim=True),
    'clarinet': dict(glob='vsco2/Woodwinds/Clarinet/susLong/*.wav', rx=V + r'_rr1_sum\.wav$', t0=0.5, tune=True, trim=True),
    'marimba': dict(glob='vsco2/Percussion/Marimba/*.wav', rx=r'_(?P<n>[A-G])(?P<a>#?)(?P<o>\d)_(?P<l>loud)_01\.wav$', t0=0.03),
    'xylo': dict(glob='vsco2/Percussion/Xylo/*.wav', rx=r'_(?P<n>[A-G])(?P<a>#?)(?P<o>\d)_(?P<l>ff)_01_far\.wav$', t0=0.02),
    'glock': dict(glob='vsco2/Percussion/Glock/*.wav', rx=r'glock_(?P<l>medium)_(?P<n>[A-G])(?P<a>#?)(?P<o>\d)\.wav$', octave=12),  # sounds 2 octaves over written; files are named 1 under
}

# VCSL (Versilian Community Sample Library, CC0), added 2026-10-16 for lo-fi / jazz colour and Indian stand-ins.
VC = 'vcsl/'
NOTE = r'(?P<n>[A-G])(?P<a>#?)(?P<o>\d)'
AUTO.update({
    'vibes': dict(glob=VC + 'Idiophones/Struck Idiophones/Vibraphone/Soft Mallets/*.wav', rx=r'_' + NOTE + r'_v(?P<l>\d)_rr(?P<r>\d)_Main\.wav$', t0=0.05, tune=True),
    'vibes_hard': dict(glob=VC + 'Idiophones/Struck Idiophones/Vibraphone/Hard Mallets/*.wav', rx=r'_' + NOTE + r'_v(?P<l>\d)_rr(?P<r>\d)_Main\.wav$', t0=0.05, tune=True),
    'tenor_sax': dict(glob=VC + 'Aerophones/Reed Aerophones/Tenor Saxophone/Non-Vibrato/*.wav', rx=r'_NV_Main_' + NOTE + r'_vl(?P<l>\d)_rr(?P<r>\d)\.wav$', t0=0.5, tune=True, trim=True),
    'tenor_sax_vib': dict(glob=VC + 'Aerophones/Reed Aerophones/Tenor Saxophone/Vibrato/*.wav', rx=r'_Vib_Main_' + NOTE + r'_(?P<l>var)(?P<r>\d)\.wav$', t0=0.5, tune=True, trim=True),
    'tenor_sax_stac': dict(glob=VC + 'Aerophones/Reed Aerophones/Tenor Saxophone/Staccato/*.wav', rx=r'_Staccato_Main_' + NOTE + r'_vl(?P<l>\d)_rr(?P<r>\d)\.wav$', t0=0.06),
    # Plucked zither: a santoor / swarmandal stand-in closer than high piano.
    'dan_tranh': dict(glob=VC + 'Chordophones/Zithers/Dan Tranh/Normal/*.wav', rx=r'^' + NOTE + r'_(?P<l>p|mp|mf|f|ff)_(?P<r>\d)\.wav$', t0=0.05, tune=True),
    'dan_tranh_vib': dict(glob=VC + 'Chordophones/Zithers/Dan Tranh/Vibrato/*.wav', rx=r'^' + NOTE + r'_vib_(?P<l>p|mp|mf|f|ff)_(?P<r>\d)\.wav$', t0=0.05),
    'upright': dict(glob=VC + 'Chordophones/Zithers/Upright Piano, Yamaha/Sustains/*.wav', rx=r'_Sus_' + NOTE + r'_vl(?P<l>\d)_rr(?P<r>\d)\.wav$', t0=0.1, tune=True),
    'kalimba': dict(glob=VC + 'Idiophones/Plucked Idiophones/Kalimba, Kenya/*.wav', rx=r'_MainSpirit_' + NOTE + r'_k\d+_vl(?P<l>\d)_rr(?P<r>\d)\.wav$', t0=0.05, tune=True),
})
# Philharmonia Orchestra samples (MP3, solo players; free in our own music, never to be passed on as samples).
# Most notes are 0.25-1.5 s, so they suit plucked strings and short solo phrases rather than long sustains.
PH, PN = 'philharmonia/', r'_(?P<n>[A-G])(?P<a>s?)(?P<o>\d)_'
AUTO.update({
    'mandolin': dict(glob=PH + 'mandolin/*.mp3', rx=PN + r'very-long_(?P<l>piano)_normal\.mp3$', t0=0.05, tune=True, lead=-12),
    'mandolin_trem': dict(glob=PH + 'mandolin/*.mp3', rx=PN + r'very-long_(?P<l>piano|forte)_tremolo\.mp3$', t0=0.3, tune=True, trim=True, lead=True),
    'guitar': dict(glob=PH + 'guitar/*.mp3', rx=PN + r'very-long_(?P<l>piano|forte)_normal\.mp3$', t0=0.05, tune=True, lead=-12,
                   skip=['guitar_As4_very-long_forte_normal.mp3']),  # plucked twice, the second louder at 1.75 s
    'banjo': dict(glob=PH + 'banjo/*.mp3', rx=PN + r'very-long_(?P<l>piano|forte)_normal\.mp3$', t0=0.05, tune=True, lead=-12),
    'cor_anglais': dict(glob=PH + 'cor anglais/*.mp3', rx=PN + r'15_(?P<l>piano|mezzo-forte|forte)_normal\.mp3$', t0=0.3, tune=True, trim=True, lead=True),
})
# University of Iowa MIS, post-2012 set (AIFF, one note per file, chromatic, ff only; no restrictions on use).
# Solo players with long, full notes: the chromatic coverage fills gaps where VSCO stretches samples (horn C4-D5).
# Strings record each note on every string; `prefer` keeps the highest string, as a player in low position would.
IO, IN = 'iowa/', r'\.(?P<n>[A-G])(?P<a>b?)(?P<o>\d)\.stereo\.aif$'
SUL = ['sulE', 'sulA', 'sulD', 'sulG', 'sulC']          # violin E A D G, viola and cello A D G C
BASS_SUL = ['sulG', 'sulD', 'sulA', 'sulE', 'sulC']     # bass strings run the other way; its E string plays flat up high (measured)
# Pizzicato high on the top string is barely pitched (detector and harmonic check both fail): middle strings first.
PIZZ = {'violin': ['sulA', 'sulD', 'sulG', 'sulE'], 'cello': ['sulD', 'sulG', 'sulA', 'sulC'], 'bass': ['sulD', 'sulA', 'sulG', 'sulE', 'sulC']}
AUTO.update({
    'horns_iowa': dict(glob=IO + 'Brass/Horn/*.aif', rx=r'^Horn\.(?P<l>ff)' + IN, t0=0.5, tune=True, trim=True, lead=True),
    'trumpet_iowa': dict(glob=IO + 'Brass/BbTrumpet/*.aif', rx=r'^Trumpet\.vib\.(?P<l>ff)' + IN, t0=0.5, tune=True, trim=True, lead=True),
    'trombone_iowa': dict(glob=IO + 'Brass/Tenor Trombone/*.aif', rx=r'^TenorTrombone\.(?P<l>ff)' + IN, t0=0.5, tune=True, trim=True, lead=True),
    'tuba_iowa': dict(glob=IO + 'Brass/Tuba/*.aif', rx=r'^Tuba\.(?P<l>ff)' + IN, t0=0.5, tune=True, trim=True, lead=True),
    'alto_flute': dict(glob=IO + 'Woodwinds/Alto Flute/*.aif', rx=r'^AltoFlute\.vib\.(?P<l>ff)' + IN, t0=0.5, tune=True, trim=True, lead=True),
    'bass_flute': dict(glob=IO + 'Woodwinds/Bass Flute/*.aif', rx=r'^BassFlute\.(?P<l>ff)' + IN, t0=0.5, tune=True, trim=True, lead=True),
    'bassoon': dict(glob=IO + 'Woodwinds/Bassoon/*.aif', rx=r'^Bassoon\.(?P<l>ff)' + IN, t0=0.5, tune=True, trim=True, lead=True),
    'bass_clarinet': dict(glob=IO + 'Woodwinds/Bass Clarinet/*.aif', rx=r'^BassClarinet\.(?P<l>ff)' + IN, t0=0.5, tune=True, trim=True, lead=True),
    'flute_iowa': dict(glob=IO + 'Woodwinds/Flute/*.aif', rx=r'^Flute\.vib\.(?P<l>ff)' + IN, t0=0.5, tune=True, trim=True, lead=True),
    'flute_plain': dict(glob=IO + 'Woodwinds/Flute/*.aif', rx=r'^Flute\.nonvib\.(?P<l>ff)' + IN, t0=0.5, tune=True, trim=True, lead=True),  # bansuri-style lines
    'oboe_iowa': dict(glob=IO + 'Woodwinds/Oboe/*.aif', rx=r'^Oboe\.(?P<l>ff)' + IN, t0=0.5, tune=True, trim=True, lead=True),
    'clarinet_iowa': dict(glob=IO + 'Woodwinds/Bb Clarinet/*.aif', rx=r'^BbClarinet\.(?P<l>ff)' + IN, t0=0.5, tune=True, trim=True, lead=True),
    'soprano_sax': dict(glob=IO + 'Woodwinds/Bb Soprano Saxophone/*.aif', rx=r'^SopSax\.vib\.(?P<l>ff)' + IN, t0=0.5, tune=True, trim=True, lead=True),  # shehnai / nadaswaram stand-in
    'alto_sax': dict(glob=IO + 'Woodwinds/Eb Alto Saxophone/*.aif', rx=r'^AltoSax\.vib\.(?P<l>ff)' + IN, t0=0.5, tune=True, trim=True, lead=True),
    'violin_solo': dict(glob=IO + 'Strings/Violin/*.aif', rx=r'^Violin\.arco\.(?P<l>ff)\.sul[A-G]' + IN, t0=0.5, tune=True, trim=True, lead=True, prefer=SUL),
    'violin_solo_pizz': dict(glob=IO + 'Strings/Violin/*.aif', rx=r'^Violin\.pizz\.(?P<l>ff)\.sul[A-G]' + IN, t0=0.05, tune=True, lead=-12, prefer=PIZZ['violin']),
    'viola_solo': dict(glob=IO + 'Strings/Viola/*.aif', rx=r'^Viola\.arco\.(?P<l>ff)\.sul[A-G]' + IN, t0=0.5, tune=True, trim=True, lead=True, prefer=SUL),
    'cello_solo': dict(glob=IO + 'Strings/Cello/*.aif', rx=r'^Cello\.arco\.(?P<l>ff)\.sul[A-G]' + IN, t0=0.5, tune=True, trim=True, lead=True, prefer=SUL),
    'cello_solo_pizz': dict(glob=IO + 'Strings/Cello/*.aif', rx=r'^Cello\.pizz\.(?P<l>ff)\.sul[A-G]' + IN, t0=0.05, tune=True, lead=-12, prefer=PIZZ['cello']),
    'bass_arco': dict(glob=IO + 'Strings/Double Bass/*.aif', rx=r'^Bass\.arco\.(?P<l>ff)\.sul[A-G]' + IN, t0=0.5, tune=True, trim=True, lead=True, prefer=BASS_SUL),
    'bass_pizz': dict(glob=IO + 'Strings/Double Bass/*.aif', rx=r'^Bass\.pizz\.(?P<l>ff)\.sul[A-G]' + IN, t0=0.05, tune=True, lead=-12, prefer=PIZZ['bass']),
    'vibes_bow': dict(glob=IO + 'Percussion/Vibraphone/*.aif', rx=r'^Vibraphone\.(?P<l>bow)' + IN, t0=0.5, tune=True, trim=True, lead=True),  # bowed: a glassy pad
    'marimba_yarn': dict(glob=IO + 'Percussion/Marimba/*.aif', rx=r'^Marimba\.yarn\.(?P<l>ff)' + IN, t0=0.03, tune=True, lead=-12),
    'marimba_roll': dict(glob=IO + 'Percussion/Marimba/*.aif', rx=r'^Marimba\.roll\.(?P<l>ff)' + IN, t0=0.3, tune=True, trim=True, lead=True),
    'crotales': dict(glob=IO + 'Percussion/Crotales/*.aif', rx=r'^Crotale\.(?P<l>ff)' + IN, t0=0.05, lead=-12),
    'thai_gong': dict(glob=IO + 'Percussion/Thai Gongs/*.aif', rx=r'^thaigong\.(?P<l>ff)' + IN, t0=0.1, lead=-12, octave=0),  # inharmonic: trust the names
})
LAYER_ORDER = ['ppp', 'pp', 'p', 'mp', 'mf', 'f', 'ff', 'fff', 'loud',
               'pianissimo', 'piano', 'mezzo-piano', 'mezzo-forte', 'forte', 'fortissimo']  # Philharmonia spells them out

# Percussion kit: MIDI key -> (glob, regex with optional layer `l` and round robin `r`).
P = 'vsco2/Percussion/'
KIT = {
    36: (P + 'BDrumNewhit_v*_rr*_Sum.wav', r'_v(?P<l>\d)_rr(?P<r>\d)'),            # concert bass drum
    38: (P + 'Snare2-HitSN_v*_rr*_Sum.wav', r'_v(?P<l>\d)_rr(?P<r>\d)'),           # snare
    39: (P + 'Snare2-rollSN_v*_rr1_Sum.wav', r'_v(?P<l>\d)'),                          # snare roll
    41: (P + 'Tumba-HitN_v*_rr*_Sum.wav', r'_v(?P<l>\d)_rr(?P<r>\d)'),            # low conga (tumba)
    43: (P + 'Conga-HitN_v*_rr*_Sum.wav', r'_v(?P<l>\d)_rr(?P<r>\d)'),            # conga
    45: (P + 'Quinto-HitN_v*_rr*_Sum.wav', r'_v(?P<l>\d)_rr(?P<r>\d)'),           # high conga (quinto)
    46: (P + 'Conga-Tap1_v*_rr*_Sum.wav', r'_v(?P<l>\d)_rr(?P<r>\d)'),            # conga slap/tap
    47: (P + 'Quinto-Tap1_v*_rr*_Sum.wav', r'_v(?P<l>\d)_rr(?P<r>\d)'),           # quinto tap
    49: (P + 'cymbal-crash1_*_rr*.wav', r'_(?P<l>pp|mp|mf|ff)_rr(?P<r>\d)'),     # crash
    51: (P + 'susCymb1-hit_*_rr*.wav', r'-hit_(?P<l>pp|mp|f|fff)_rr(?P<r>\d)'),  # suspended cymbal
    52: (P + 'gongHit_*.wav', r'gongHit_(?P<l>p|mf|f|fff)\.wav'),                 # gong
    53: (P + 'susCymb1-cresc-Long_v1.wav', r'(?P<l>Long)'),                        # cymbal swell (long)
    55: (P + 'susCymb1-cresc-Median_v1.wav', r'(?P<l>Median)'),                    # cymbal swell (medium)
    54: (P + 'Tamb1-Hit_v*_rr*_Sum.wav', r'_v(?P<l>\d)_rr(?P<r>\d)'),             # tambourine
    56: (P + 'Cowbell1_Hit_v*_rr*_Sum.wav', r'_v(?P<l>\d)_rr(?P<r>\d)'),          # cowbell
    58: (P + 'LogDrumLo_MedM_v*_rr*_Sum.wav', r'_v(?P<l>\d)_rr(?P<r>\d)'),        # log drum low
    59: (P + 'LogDrumHi_MedM_v*_rr*_Sum.wav', r'_v(?P<l>\d)_rr(?P<r>\d)'),        # log drum high
    60: (P + 'Claves1_Hit_v*_rr*_Sum.wav', r'_v(?P<l>\d)_rr(?P<r>\d)'),           # claves
    61: (P + 'Triangle3-Hit_v*_rr*_Sum.wav', r'_v(?P<l>\d)_rr(?P<r>\d)'),         # triangle
    62: (P + 'Sleighbells_Hit_v1_rr*_Mid.wav', r'_v(?P<l>\d)_rr(?P<r>\d)'),                    # sleigh bells
    63: (P + 'Anvil_Hit1_v*_Sum.wav', r'_v(?P<l>\d)'),                             # anvil
    64: (P + 'Timpani/Timpani1_Hit_v*_rr*_Sum.wav', r'_v(?P<l>\d)_rr(?P<r>\d)'),  # timpani 1 (lowest)..5
    65: (P + 'Timpani/Timpani2_Hit_v*_rr*_Sum.wav', r'_v(?P<l>\d)_rr(?P<r>\d)'),
    66: (P + 'Timpani/Timpani3_Hit_v*_rr*_Sum.wav', r'_v(?P<l>\d)_rr(?P<r>\d)'),
    67: (P + 'Timpani/Timpani4_Hit_v*_rr*_Sum.wav', r'_v(?P<l>\d)_rr(?P<r>\d)'),
    68: (P + 'Timpani/Timpani5_Hit_v*_rr*_Sum.wav', r'_v(?P<l>\d)_rr(?P<r>\d)'),
    69: (P + 'Timpani/Rolls/Timpani1_Roll_v5_rr1_Sum.wav', r'_v(?P<l>\d)'),        # timpani rolls
    70: (P + 'Timpani/Rolls/Timpani3_Roll_v5_rr1_Sum.wav', r'_v(?P<l>\d)'),
}


def layer_key(l):
    return (LAYER_ORDER.index(l), 0) if l in LAYER_ORDER else (0, int(l)) if l.isdigit() else (99, l)


def vel_ranges(layers):
    ls = sorted(set(layers), key=layer_key)
    return {l: (1 + round(127 * i / len(ls)), round(127 * (i + 1) / len(ls))) for i, l in enumerate(ls)}


def build_auto(name, spec, flagged):
    files = []
    for path in sorted(glob.glob(os.path.join(ROOT, spec['glob']))):
        m = re.search(spec['rx'], os.path.basename(path))
        if m and os.path.basename(path) not in spec.get('skip', ()):
            named = 12 * (int(m['o']) + 1) + PC[m['n']] + ACC[m['a'] or '']
            x, sr = sf.read(path)
            files.append((path, m, named, x, sr))
    if not files:
        raise FileNotFoundError(f'{name}: no files match {spec["glob"]} (pull the folder from R2 first)')
    if spec.get('prefer'):
        rank = lambda p: next((i for i, s in enumerate(spec['prefer']) if s in os.path.basename(p)), len(spec['prefer']))
        best = {}
        for f in sorted(files, key=lambda f: rank(f[0])):
            best.setdefault((f[2], f[1]['l'], f[1].groupdict().get('r')), f)
        files = sorted(best.values(), key=lambda f: f[0])
    db = -30 if spec.get('lead') is True else spec.get('lead')
    lead = {path: onset(x, sr, db) if db else 0.0 for path, m, named, x, sr in files}
    measured = {}
    if spec.get('octave') is None:
        offs = []
        for path, m, named, x, sr in files:
            try:
                v = 69 + 12 * np.log2(f0(x, sr, spec['t0'] + lead[path], 0.25) / 440)
                if np.isfinite(v):
                    measured[path] = v
                    offs.append(round((v - named) / 12) * 12)
            except Exception:
                pass
        octave = max(set(offs), key=offs.count)
    else:
        octave = spec['octave']
    vr = vel_ranges([m['l'] for _, m, _, _, _ in files])
    out = []
    for path, m, named, x, sr in files:
        root = named + octave
        cents = 0.0
        v = measured.get(path)
        if spec.get('lead') and (v is None or abs(v - root) > 0.5):
            # Second opinion for the Iowa / Philharmonia sets: autocorrelation locks onto noise under fast-decaying
            # pizzicato and onto the 2nd harmonic of reeds; the harmonic product spectrum doesn't (checked by hand).
            h = f0_hps(x, sr, spec['t0'] + lead[path])
            if abs(h - root) <= 2.3 and (v is None or abs(h - root) < abs(v - root)):
                v = h
        if spec.get('tune') and v is not None:
            cents = (v - root) * 100
            near = round(v)
            if abs(cents) > 50 and abs(v - near) < 0.3 and abs(near - root) <= 2:
                flagged.append(f'{name} {os.path.basename(path)}: named {root}, plays {near}; root corrected')
                root, cents = near, (v - near) * 100   # mislabelled file
            if abs(cents) > 50:
                flagged.append(f'{name} {os.path.basename(path)}: named {root}, measured {v:.2f}')
                cents = 0.0
        lo, hi = vr[m['l']]
        mono = x.mean(1) if x.ndim > 1 else x
        s = int(lead[path] * sr)
        z = {'path': os.path.relpath(path, ROOT).replace('\\', '/'), 'root': root, 'layer': m['l'], 'vel_low': lo, 'vel_high': hi,
             'fine_tune': round(-cents, 1), 'seconds': round((len(x) - s) / sr, 2),
             'rms_db': float(20 * np.log10(np.sqrt(np.mean(mono[s + int(0.4 * sr):s + int(2 * sr)] ** 2)) + 1e-9))}
        if spec.get('lead'):
            z['start'] = round(100 * s / len(x), 3)  # sampler `start` is a percentage of the file
        if 'r' in m.groupdict() and m['r']:
            z['rr'] = int(m['r'])
        out.append(z)
    if spec.get('trim'):
        for layer in {z['layer'] for z in out}:
            zs = [z for z in out if z['layer'] == layer]
            med = float(np.median([z['rms_db'] for z in zs]))
            for z in zs:
                z['level_trim'] = round(max(-6.0, min(6.0, med - z['rms_db'])), 1)
    for z in out:
        z.pop('rms_db')
    return out, octave


# Hand drums (VCSL): darbuka strokes, frame drums and bongos, closer to tabla / dholak / daf than congas.
M = VC + 'Membranophones/Struck Membranophones/'
HAND = {
    **{59 + k: (M + f'Darbuka/Darbuka_{k}_hit_vl*_rr*.wav', r'_vl(?P<l>\d)_rr(?P<r>\d)') for k in range(1, 6)},  # 60-64: darbuka strokes 1-5
    65: (M + 'Frame Drum/HDrumL_Hit_v*_rr*_Sum.wav', r'_v(?P<l>\d)_rr(?P<r>\d)'),         # large frame drum, open
    66: (M + 'Frame Drum/HDrumL_HitMuted_v*_rr*_Sum.wav', r'_v(?P<l>\d)_rr(?P<r>\d)'),    # large frame drum, muted
    67: (M + 'Frame Drum/HDrumS_Hit_v*_rr*_Sum.wav', r'_v(?P<l>\d)_rr(?P<r>\d)'),         # small frame drum, open
    68: (M + 'Frame Drum/HDrumS_HitMuted_v*_rr*_Sum.wav', r'_v(?P<l>\d)_rr(?P<r>\d)'),    # small frame drum, muted
    69: (M + 'Bongos/BongoL_Hit1_v*_rr*_Mid.wav', r'_v(?P<l>\d)_rr(?P<r>\d)'),            # low bongo
    70: (M + 'Bongos/BongoH_Hit1_v*_rr*_Mid.wav', r'_v(?P<l>\d)_rr(?P<r>\d)'),            # high bongo
    71: (M + 'Bongos/BongoL_HitMuted2_v*_rr*_Mid.wav', r'_v(?P<l>\d)_rr(?P<r>\d)'),      # low bongo, muted
    72: (M + 'Bongos/BongoH_HitMuted1_v*_rr*_Mid.wav', r'_v(?P<l>\d)_rr(?P<r>\d)'),      # high bongo, muted
}


# Philharmonia percussion (single hits; MP3 padding skipped with `start`). Hand cymbals stand in for manjira.
Q, D = PH + 'percussion/', r'__\d+_(?P<l>[a-z-]+)_'
PHIL_KIT = {
    60: (Q + 'Chinese hand cymbals/*_struck-together.mp3', D + 'struck'),   # hand cymbals (manjira / jhanj)
    61: (Q + 'djembe/djembe__05_*_undamped.mp3', D + 'undamped'),           # djembe, open
    62: (Q + 'surdo/surdo__05_*_undamped.mp3', D + 'undamped'),             # surdo, open (deep, dhol-like low end)
    63: (Q + 'surdo/surdo__05_*_damped.mp3', D + 'damped'),                 # surdo, damped
    64: (Q + 'djundjun/djundjun__05_*_struck-singly.mp3', D + 'struck'),     # djundjun
    65: (Q + 'tom-toms/tom-toms__05_*_struck-singly.mp3', D + 'struck'),     # tom
    66: (Q + 'agogo bells/agogo-bells__025_*.mp3', D + 'struck'),            # agogo
    67: (Q + 'castanets/castanets__025_*.mp3', D + 'struck'),                # castanets
    68: (Q + 'cowbell/cowbell__1_*_undamped.mp3', D + 'undamped'),          # cowbell, open
    69: (Q + 'guiro/guiro__05_*_scraped.mp3', D + 'scraped'),               # guiro scrape
    70: (Q + 'cabasa/cabasa__025_*.mp3', D + 'effect'),                      # cabasa
    71: (Q + 'woodblock/woodblock__025_*.mp3', D + 'struck'),                # woodblock
    72: (Q + 'tambourine/tambourine__025_*_hand.mp3', D + 'hand'),           # tambourine hit
    73: (Q + 'sleigh bells/sleigh-bells__05_*.mp3', D + 'shaken'),           # sleigh bells
    74: (Q + 'triangle/triangle__long_piano_struck-singly.mp3', r'_(?P<l>piano)_'),  # triangle
    75: (Q + 'bell tree/bell-tree__long_*_glissando.mp3', r'_(?P<l>mezzo-forte|forte)_'),  # bell tree sweep
    76: (Q + 'wind chimes/*.mp3', r'_(?P<l>mezzo-piano)_'),                   # wind chimes
    77: (Q + 'Thai gong/Thai-gong__long_*_undamped.mp3', r'_(?P<l>forte|fortissimo)_'),  # Thai gong
    78: (Q + 'tam-tam/tam-tam__long_mezzo-piano_undamped.mp3', r'_(?P<l>mezzo-piano)_'),  # tam-tam
    79: (Q + 'snare drum/snare-drum__025_*_with-snares.mp3', D + 'with'),    # orchestral snare
    80: (Q + 'bass drum/bass-drum__025_*_bass-drum-mallet.mp3', D + 'bass'), # concert bass drum
    81: (Q + 'clash cymbals/clash-cymbals__15_fortissimo_struck-together.mp3', D + 'struck'),  # clash cymbals
    82: (Q + 'suspended cymbal/suspended-cymbal__very-long_cresc-decresc_roll.mp3', r'_(?P<l>cresc-decresc)_'),  # cymbal swell
    83: (Q + 'whip/whip__025_*.mp3', D + 'struck'),                          # whip (slapstick)
}


def build_kit(kit=KIT, lead=None):
    out = []
    for key, (pattern, rx) in kit.items():
        files = [(p, re.search(rx, os.path.basename(p))) for p in sorted(glob.glob(os.path.join(ROOT, pattern)))]
        files = [(p, m) for p, m in files if m]
        if not files:
            raise FileNotFoundError(pattern)
        vr = vel_ranges([m['l'] for _, m in files])
        # Kit recordings sit at very different levels (congas far below the bass drum). Trim each key so its
        # loudest layer peaks at -3 dBFS, keeping the differences between its own layers.
        peaks = {p: 20 * np.log10(np.abs(sf.read(p)[0]).max() + 1e-9) for p, _ in files}
        trim = round(max(-12.0, min(12.0, -3 - max(peaks.values()))), 1)
        for p, m in files:
            info = sf.info(p)
            z = {'path': os.path.relpath(p, ROOT).replace('\\', '/'), 'root': key, 'layer': m['l'], 'vel_low': vr[m['l']][0],
                 'vel_high': vr[m['l']][1], 'fine_tune': 0, 'seconds': round(info.duration, 2), 'exact': True, 'level_trim': trim}
            if lead:  # (for MP3s sf.info's duration is an estimate, up to 14 % long: use the decoded length)
                x, sr = sf.read(p)
                t, dur = onset(x, sr, lead), len(x) / sr
                z['seconds'], z['start'] = round(dur - t, 2), round(100 * t / dur, 3)
            if 'r' in m.groupdict() and m['r']:
                z['rr'] = int(m['r'])
            out.append(z)
    return out


def onset(x, sr, db=-30):
    """Seconds before the attack reaches `db` below the file's peak, less 3 ms so the attack itself is kept.
    Plucked and struck sounds use -12: some Philharmonia files carry up to 190 ms of string or handling noise at
    -22 dB before the hit (mandolin C5, surdo), and their attacks rise past -12 dB within a few ms anyway."""
    a = np.abs(x.mean(1) if x.ndim > 1 else x)
    return max(0.0, int(np.argmax(a > 10 ** (db / 20) * a.max())) / sr - 0.003)


def f0_hps(x, sr, t0, dur=0.3):
    """Fundamental (MIDI) by harmonic product spectrum: the frequency whose 2nd-4th harmonics line up best."""
    if x.ndim > 1:
        x = x.mean(1)
    seg = x[int(t0 * sr):int((t0 + dur) * sr)]
    if len(seg) < sr // 20:
        return float('nan')
    spec = np.abs(np.fft.rfft(seg * np.hanning(len(seg)), 1 << 19))
    freq = np.fft.rfftfreq(1 << 19, 1 / sr)
    h = spec.copy()
    for k in (2, 3, 4):
        h[:len(spec) // k] *= spec[::k][:len(spec) // k]
    lo, hi = np.searchsorted(freq, [25, 4500])
    return 69 + 12 * np.log2(freq[lo + int(np.argmax(h[lo:hi]))] / 440)


def f0(x, sr, t0, dur=0.5):
    """Fundamental by normalised autocorrelation, taking the shortest strong lag (avoids octave-down errors)."""
    if x.ndim > 1:
        x = x.mean(1)
    seg = x[int(t0 * sr):int((t0 + dur) * sr)]
    seg = (seg - seg.mean()) * np.hanning(len(seg))
    n = len(seg)
    spec = np.fft.rfft(seg, 2 * n)
    ac = np.fft.irfft(spec * np.conj(spec))
    r = ac / ac[0]
    lo, hi = max(2, int(sr / 5000)), int(sr / 25)
    best = r[lo:hi].max()
    peaks = (l for l in range(lo + 1, hi - 1) if r[l] > 0.85 * best and r[l] >= r[l - 1] and r[l] >= r[l + 1])
    lag = next(peaks, lo + int(np.argmax(r[lo:hi])))
    y0, y1, y2 = r[lag - 1], r[lag], r[lag + 1]
    return sr / (lag + 0.5 * (y0 - y2) / (y0 - 2 * y1 + y2))


def salamander_tuning():
    """Root note -> cents from Data/tune_ret.txt; region N plays the Nth sample from A0 in minor thirds."""
    tunes = re.findall(r'\$TUNE(\d+) (-?\d+)', open(os.path.join(ROOT, 'salamander/Data/tune_ret.txt')).read())
    return {21 + 3 * (int(i) - 1): int(c) for i, c in tunes}


def main():
    only = set(sys.argv[sys.argv.index('--only') + 1].split(',')) if '--only' in sys.argv else None
    want = lambda name: only is None or name in only
    path_out = os.path.join(ROOT, 'zones.json')
    zones, flagged = (json.load(open(path_out)) if only else {}), []
    piano_tune = salamander_tuning() if want('piano') else {}
    for inst, (pattern, rx, octave, layers, t0) in INSTRUMENTS.items():
        if not want(inst):
            continue
        out = []
        for path in sorted(glob.glob(os.path.join(ROOT, pattern))):
            m = re.search(rx, os.path.basename(path))
            if not m or m['l'] not in layers:
                continue
            root = 12 * (int(m['o']) + 1) + PC[m['n']] + (1 if m['a'] else 0) + octave
            x, sr = sf.read(path)
            if t0 is None:
                cents = -piano_tune.get(root, 0) if inst == 'piano' else 0
            else:
                measured = 69 + 12 * np.log2(f0(x, sr, t0) / 440)
                cents = (measured - root) * 100
                if abs(cents) > 50:
                    flagged.append(f'{inst} {os.path.basename(path)}: named {root}, measured {measured:.2f}')
                    cents = 0
            lo, hi = layers[m['l']]
            out.append({'path': os.path.relpath(path, ROOT).replace('\\', '/'), 'root': root, 'layer': m['l'],
                        'vel_low': lo, 'vel_high': hi, 'fine_tune': round(-cents, 1),
                        'seconds': round(len(x) / sr, 2),
                        'rms_db': float(20 * np.log10(np.sqrt(np.mean(x.mean(1)[int(0.4 * sr):int(2 * sr)] ** 2)) + 1e-9))})
        if t0 is not None:  # sustained instruments: even out sample-to-sample level within each layer
            for layer in {z['layer'] for z in out}:
                zs = [z for z in out if z['layer'] == layer]
                med = float(np.median([z['rms_db'] for z in zs]))
                for z in zs:
                    z['level_trim'] = round(max(-6.0, min(6.0, med - z['rms_db'])), 1)
        for z in out:
            z.pop('rms_db', None)
        zones[inst] = out
        print(f'{inst}: {len(out)} zones, roots {min(z["root"] for z in out)}-{max(z["root"] for z in out)}')
    for inst, spec in AUTO.items():
        if not want(inst):
            continue
        out, octave = build_auto(inst, spec, flagged)
        zones[inst] = out
        print(f'{inst}: {len(out)} zones, roots {min(z["root"] for z in out)}-{max(z["root"] for z in out)}, octave offset {octave:+d}, '
              f'layers {sorted({z["layer"] for z in out}, key=layer_key)}' + (', round robins' if any('rr' in z for z in out) else ''))
    for name, kit, lead in (('perc', KIT, None), ('hand', HAND, None), ('phil_perc', PHIL_KIT, -12)):
        if want(name):
            zones[name] = build_kit(kit, lead)
            print(f'{name}: {len(zones[name])} zones on keys {sorted({z["root"] for z in zones[name]})}')
    with open(path_out, 'w') as f:
        json.dump(zones, f, indent=1)
    for line in flagged:
        print('FLAGGED (kept untuned):', line)


if __name__ == '__main__':
    sys.exit(main())
