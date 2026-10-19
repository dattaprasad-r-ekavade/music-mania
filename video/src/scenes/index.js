// Scene registry: composition id = piece name (pieces/<name>.mjs, out/<name>.wav).
import { drawGoldenHour } from './GoldenHour.js';
import { drawNeonBhairav } from './NeonBhairav.js';
import { drawPahadiWinter } from './PahadiWinter.js';

export const SCENES = {
  'golden-hour': { draw: drawGoldenHour, title: 'golden hour', accent: '#ffd08a' },
  'neon-bhairav': { draw: drawNeonBhairav, title: 'neon bhairav', accent: '#2ff3ff' },
  'pahadi-winter': { draw: drawPahadiWinter, title: 'pahadi winter', accent: '#cfe0ff' },
};
