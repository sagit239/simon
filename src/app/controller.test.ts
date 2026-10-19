import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { createController, type ViewModel } from './controller';

const STAGE_GAP = 800; // feedback + pause before the next sequence

function setup(unlockResult = true) {
  let model!: ViewModel;
  const audio = {
    unlock: vi.fn(async () => unlockResult),
    play: vi.fn(),
    stopAll: vi.fn(),
  };
  const controller = createController({
    view: { update: (m) => (model = m) },
    audio,
    random: () => 0, // every item is blue
  });
  return { controller, audio, model: () => model };
}

// Time to present a sequence of length n.
const presentMs = (n: number) => n * 500 + (n - 1) * 250;

describe('controller', () => {
  beforeEach(() => vi.useFakeTimers());
  afterEach(() => vi.useRealTimers());

  it('opens input only when the presentation ends', async () => {
    const { controller, model } = setup();
    await controller.start();
    expect(model().state.phase).toBe('presenting');
    expect(model().lit).toBe('blue');
    vi.advanceTimersByTime(presentMs(1) - 1);
    expect(model().state.phase).toBe('presenting');
    vi.advanceTimersByTime(1);
    expect(model().state.phase).toBe('accepting');
    expect(model().lit).toBeNull();
  });

  it('has no answer timeout', async () => {
    const { controller, model } = setup();
    await controller.start();
    vi.advanceTimersByTime(presentMs(1));
    vi.advanceTimersByTime(10 * 60 * 60 * 1000);
    expect(model().state.phase).toBe('accepting');
  });

  it('ignores presses while presenting', async () => {
    const { controller, model, audio } = setup();
    await controller.start();
    audio.play.mockClear();
    controller.press('red');
    expect(model().state.phase).toBe('presenting');
    expect(audio.play).not.toHaveBeenCalled();
  });

  it('gives light and sound feedback for a press', async () => {
    const { controller, model, audio } = setup();
    await controller.start();
    vi.advanceTimersByTime(presentMs(1));
    controller.press('blue');
    expect(model().lit).toBe('blue');
    expect(audio.play).toHaveBeenLastCalledWith('blue', 300);
  });

  it('advances one stage with one point and locks input immediately', async () => {
    const { controller, model } = setup();
    await controller.start();
    vi.advanceTimersByTime(presentMs(1));
    controller.press('blue');
    controller.press('blue');
    controller.press('blue');
    expect(model().state).toMatchObject({ phase: 'presenting', stage: 2, score: 1 });
    vi.advanceTimersByTime(STAGE_GAP + presentMs(2));
    expect(model().state.phase).toBe('accepting');
  });

  it('ends on a wrong press and ignores later presses', async () => {
    const { controller, model } = setup();
    await controller.start();
    vi.advanceTimersByTime(presentMs(1));
    controller.press('red');
    expect(model().state).toMatchObject({ phase: 'lost', score: 0 });
    controller.press('blue');
    vi.runAllTimers();
    expect(model().state).toMatchObject({ phase: 'lost', score: 0 });
  });

  it('wins with exactly 10 points', async () => {
    const { controller, model } = setup();
    await controller.start();
    for (let stage = 1; stage <= 10; stage++) {
      vi.advanceTimersByTime(presentMs(stage));
      expect(model().state).toMatchObject({ phase: 'accepting', stage, score: stage - 1 });
      for (let i = 0; i < stage; i++) controller.press('blue');
      if (stage < 10) vi.advanceTimersByTime(STAGE_GAP);
    }
    expect(model().state).toMatchObject({ phase: 'won', stage: 10, score: 10 });
    vi.runAllTimers();
    expect(model().state.phase).toBe('won');
  });

  it('new game resets to stage 1 and old callbacks do not leak in', async () => {
    const { controller, model } = setup();
    await controller.start();
    vi.advanceTimersByTime(presentMs(1));
    controller.press('blue'); // stage 2 is scheduled
    controller.press('red'); // ignored: input is locked
    vi.advanceTimersByTime(STAGE_GAP + presentMs(2));
    controller.press('green'); // lose at stage 2
    expect(model().state).toMatchObject({ phase: 'lost', score: 1 });

    await controller.start();
    expect(model().state).toMatchObject({ phase: 'presenting', stage: 1, score: 0 });
    expect(model().state.sequence).toHaveLength(1);
    vi.advanceTimersByTime(presentMs(1));
    expect(model().state.phase).toBe('accepting');
    vi.runAllTimers();
    expect(model().state).toMatchObject({ phase: 'accepting', stage: 1, score: 0 });
  });

  it('a new game right after losing cancels the losing press feedback', async () => {
    const { controller, model } = setup();
    await controller.start();
    vi.advanceTimersByTime(presentMs(1));
    controller.press('red'); // lose; red feedback is lit for 300ms
    await controller.start();
    expect(model().lit).toBe('blue');
    vi.advanceTimersByTime(300);
    // The old feedback timer must not switch off the new sequence's light.
    expect(model().lit).toBe('blue');
  });

  it('does not start or fail the game when audio cannot be unlocked', async () => {
    const { controller, model, audio } = setup(false);
    await controller.start();
    expect(model().audioError).toBe(true);
    expect(model().state.phase).toBe('idle');
    vi.runAllTimers();
    expect(model().state.phase).toBe('idle');
    expect(audio.play).not.toHaveBeenCalled();
  });

  it('clears the audio error once a retry succeeds', async () => {
    const { controller, model, audio } = setup(false);
    await controller.start();
    audio.unlock.mockResolvedValueOnce(true);
    await controller.start();
    expect(model().audioError).toBe(false);
    expect(model().state.phase).toBe('presenting');
  });

  it('ignores a second start while the first is still unlocking audio', async () => {
    const { controller, model, audio } = setup();
    const a = controller.start();
    const b = controller.start();
    await Promise.all([a, b]);
    expect(audio.unlock).toHaveBeenCalledTimes(2);
    expect(model().state).toMatchObject({ phase: 'presenting', stage: 1 });
    vi.runAllTimers();
    expect(model().state.phase).toBe('accepting');
  });
});
