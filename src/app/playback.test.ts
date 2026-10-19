import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import type { PadColor } from '../config';
import { createPlayback } from './playback';

function setup() {
  const events: string[] = [];
  const audio = {
    play: vi.fn((color: PadColor, ms: number) => events.push(`${Date.now()} tone ${color} ${ms}`)),
    stopAll: vi.fn(),
  };
  const setLit = vi.fn((color: PadColor | null) => events.push(`${Date.now()} lit ${color}`));
  const onDone = vi.fn(() => events.push(`${Date.now()} done`));
  return { events, audio, setLit, onDone, playback: createPlayback(audio, setLit) };
}

describe('playback', () => {
  beforeEach(() => {
    vi.useFakeTimers();
    vi.setSystemTime(0);
  });
  afterEach(() => vi.useRealTimers());

  it('lights each item for 500ms with a 250ms gap only between items', () => {
    const { events, playback, onDone } = setup();
    playback.play(['red', 'red', 'green'], onDone);
    vi.runAllTimers();
    expect(events).toEqual([
      '0 lit null', // play() first clears any previous run
      '0 lit red',
      '0 tone red 500',
      '500 lit null',
      '750 lit red',
      '750 tone red 500',
      '1250 lit null',
      '1500 lit green',
      '1500 tone green 500',
      '2000 lit null',
      '2000 done',
    ]);
  });

  it('starts light and tone together for every item', () => {
    const { events, playback, onDone } = setup();
    playback.play(['blue', 'yellow'], onDone);
    vi.runAllTimers();
    const lit = events.filter((e) => / lit (blue|yellow)$/.test(e)).map((e) => e.split(' ')[0]);
    const tones = events.filter((e) => e.includes(' tone ')).map((e) => e.split(' ')[0]);
    expect(lit).toEqual(tones);
  });

  it('finishes exactly at n*500 + (n-1)*250', () => {
    for (let n = 1; n <= 10; n++) {
      vi.setSystemTime(0);
      const { playback, onDone } = setup();
      playback.play(Array<PadColor>(n).fill('blue'), onDone);
      vi.advanceTimersByTime(n * 500 + (n - 1) * 250 - 1);
      expect(onDone).not.toHaveBeenCalled();
      vi.advanceTimersByTime(1);
      expect(onDone).toHaveBeenCalledTimes(1);
    }
  });

  it('cancel turns the light off, stops sound and runs no later callbacks', () => {
    const { audio, setLit, playback, onDone } = setup();
    playback.play(['blue', 'red', 'green'], onDone);
    vi.advanceTimersByTime(800);
    audio.play.mockClear();
    setLit.mockClear();
    playback.cancel();
    expect(setLit).toHaveBeenLastCalledWith(null);
    expect(audio.stopAll).toHaveBeenCalled();
    setLit.mockClear();
    vi.runAllTimers();
    expect(setLit).not.toHaveBeenCalled();
    expect(audio.play).not.toHaveBeenCalled();
    expect(onDone).not.toHaveBeenCalled();
  });

  it('a new play cancels the previous one', () => {
    const { playback } = setup();
    const first = vi.fn();
    const second = vi.fn();
    playback.play(['blue', 'blue'], first);
    vi.advanceTimersByTime(300);
    playback.play(['red'], second);
    vi.runAllTimers();
    expect(first).not.toHaveBeenCalled();
    expect(second).toHaveBeenCalledTimes(1);
  });
});
