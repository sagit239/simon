export const STAGE_COUNT = 10;
export const LIGHT_MS = 500;
export const GAP_MS = 250;

export type PadColor = 'blue' | 'red' | 'yellow' | 'green';

export interface Pad {
  color: PadColor;
  label: string;
}

// DOM order. In an RTL 2x2 grid this places blue top-right, red top-left,
// yellow bottom-right and green bottom-left, as required by DESIGN.md.
export const PADS: readonly Pad[] = [
  { color: 'blue', label: 'כחול' },
  { color: 'red', label: 'אדום' },
  { color: 'yellow', label: 'צהוב' },
  { color: 'green', label: 'ירוק' },
];

// Press feedback length and the pause before the next stage's sequence.
export const FEEDBACK_MS = 300;
export const STAGE_PAUSE_MS = 500;

// One fixed, distinct tone per color (classic Simon pitches).
export const TONE_HZ: Readonly<Record<PadColor, number>> = {
  green: 415,
  red: 310,
  yellow: 252,
  blue: 209,
};
