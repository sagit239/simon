import { describe, expect, it } from 'vitest';
import { generateSequence } from './sequence';

const COLORS = ['blue', 'red', 'yellow', 'green'];

describe('generateSequence', () => {
  it('creates sequences of length 1 to 10 using only the four colors', () => {
    for (let length = 1; length <= 10; length++) {
      const seq = generateSequence(length);
      expect(seq).toHaveLength(length);
      for (const c of seq) expect(COLORS).toContain(c);
    }
  });

  it('allows repeats and does not force variety', () => {
    expect(generateSequence(10, () => 0)).toEqual(Array(10).fill('blue'));
  });

  it('maps the random range evenly onto the four colors', () => {
    const values = [0, 0.25, 0.5, 0.75, 0.999];
    let i = 0;
    expect(generateSequence(5, () => values[i++])).toEqual(['blue', 'red', 'yellow', 'green', 'green']);
  });

  it('draws one random value per item', () => {
    let calls = 0;
    generateSequence(7, () => {
      calls++;
      return 0.4;
    });
    expect(calls).toBe(7);
  });
});
