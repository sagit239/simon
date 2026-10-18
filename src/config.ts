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
