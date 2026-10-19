import { describe, expect, it } from 'vitest';
import { GAP_MS, LIGHT_MS, PADS, STAGE_COUNT, TONE_HZ } from './config';

describe('config', () => {
  it('defines four unique pads in board order with Hebrew labels', () => {
    expect(PADS.map((p) => p.color)).toEqual(['blue', 'red', 'yellow', 'green']);
    expect(PADS.map((p) => p.label)).toEqual(['כחול', 'אדום', 'צהוב', 'ירוק']);
  });

  it('uses the game constants from the PRD', () => {
    expect(STAGE_COUNT).toBe(10);
    expect(LIGHT_MS).toBe(500);
    expect(GAP_MS).toBe(250);
  });

  it('assigns four distinct tones, one per color', () => {
    expect(new Set(PADS.map((p) => TONE_HZ[p.color])).size).toBe(4);
  });
});
