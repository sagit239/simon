import { PADS, type PadColor } from '../config';

export type RandomSource = () => number;

// Each item is drawn independently with equal probability; repeats are allowed.
export function generateSequence(length: number, random: RandomSource = Math.random): PadColor[] {
  const sequence: PadColor[] = [];
  for (let i = 0; i < length; i++) {
    sequence.push(PADS[Math.floor(random() * PADS.length)].color);
  }
  return sequence;
}
