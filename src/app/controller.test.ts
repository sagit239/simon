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

describe('controller: about screen and interruptions', () => {
  beforeEach(() => vi.useFakeTimers());
  afterEach(() => vi.useRealTimers());

  // Cycling random: sequences are blue, blue-red, blue-red-yellow, ...
  function setupVaried() {
    let model!: ViewModel;
    const lights: (string | null)[] = [];
    const audio = {
      unlock: vi.fn(async () => true),
      play: vi.fn(),
      stopAll: vi.fn(),
    };
    const values = [0, 0.3, 0.6, 0.9];
    let i = 0;
    const controller = createController({
      view: {
        update: (m) => {
          if (!model || m.lit !== model.lit) lights.push(m.lit);
          model = m;
        },
      },
      audio,
      random: () => values[i++ % values.length],
    });
    return { controller, audio, lights, model: () => model };
  }

  // Lit colors in order, ignoring "off" entries.
  const shown = (lights: (string | null)[]) => lights.filter((c) => c !== null);

  // Reaches stage 3 (score 2), waiting for input.
  async function toStage3(c: ReturnType<typeof setupVaried>) {
    await c.controller.start();
    vi.advanceTimersByTime(presentMs(1));
    c.controller.press('blue');
    vi.advanceTimersByTime(STAGE_GAP + presentMs(2));
    c.controller.press('blue');
    c.controller.press('red');
    vi.advanceTimersByTime(STAGE_GAP + presentMs(3));
    expect(c.model().state).toMatchObject({ phase: 'accepting', stage: 3, score: 2 });
    expect(c.model().state.sequence).toEqual(['blue', 'red', 'yellow']);
  }

  it('shows score 0 on the about screen before a game, and changes nothing', async () => {
    const c = setupVaried();
    c.controller.showScreen('about');
    expect(c.model()).toMatchObject({ screen: 'about', state: { phase: 'idle', score: 0 } });
    c.controller.showScreen('home');
    await vi.runAllTimersAsync();
    expect(c.model()).toMatchObject({ screen: 'home', state: { phase: 'idle', score: 0 } });
    expect(c.audio.play).not.toHaveBeenCalled();
  });

  it('pausing mid-presentation stops lights, tones and callbacks', async () => {
    const c = setupVaried();
    await toStage3(c);
    c.controller.press('blue');
    c.controller.press('red');
    c.controller.press('yellow'); // stage 4 starts after the gap
    vi.advanceTimersByTime(STAGE_GAP + 600); // in the middle of the presentation
    c.controller.showScreen('about');
    expect(c.model()).toMatchObject({ screen: 'about', lit: null, state: { phase: 'paused', stage: 4, score: 3 } });
    const plays = c.audio.play.mock.calls.length;
    const lightCount = c.lights.length;
    vi.advanceTimersByTime(60_000);
    expect(c.audio.play.mock.calls.length).toBe(plays);
    expect(c.lights.length).toBe(lightCount);
    expect(c.model().state.phase).toBe('paused');
  });

  it('pausing mid-answer then returning replays the same full sequence from the start', async () => {
    const c = setupVaried();
    await toStage3(c);
    c.controller.press('blue'); // partial answer
    c.controller.showScreen('about');
    expect(c.model().state).toMatchObject({ phase: 'paused', stage: 3, score: 2, inputIndex: 0 });

    c.lights.length = 0;
    c.controller.showScreen('home');
    await vi.advanceTimersByTimeAsync(0);
    expect(c.model().state).toMatchObject({ phase: 'presenting', stage: 3, score: 2 });
    await vi.advanceTimersByTimeAsync(presentMs(3));
    expect(shown(c.lights)).toEqual(['blue', 'red', 'yellow']);
    expect(c.model().state).toMatchObject({ phase: 'accepting', stage: 3, score: 2, inputIndex: 0 });
    expect(c.model().state.sequence).toEqual(['blue', 'red', 'yellow']);

    // The answer starts over from the first item.
    c.controller.press('blue');
    c.controller.press('red');
    c.controller.press('yellow');
    expect(c.model().state).toMatchObject({ stage: 4, score: 3 });
  });

  it('pausing during the gap before the next stage does not start it on its own', async () => {
    const c = setupVaried();
    await toStage3(c);
    c.controller.press('blue');
    c.controller.press('red');
    c.controller.press('yellow');
    c.controller.showScreen('about');
    vi.advanceTimersByTime(60_000);
    expect(c.model().state).toMatchObject({ phase: 'paused', stage: 4, score: 3 });
    c.lights.length = 0;
    c.controller.showScreen('home');
    await vi.advanceTimersByTimeAsync(presentMs(4));
    expect(shown(c.lights)).toEqual(['blue', 'red', 'yellow', 'green']);
    expect(c.model().state).toMatchObject({ phase: 'accepting', stage: 4, score: 3 });
  });

  it('rapid back-and-forth leaves a single playback and no stuck light', async () => {
    const c = setupVaried();
    await toStage3(c);
    for (let i = 0; i < 6; i++) {
      c.controller.showScreen('about');
      c.controller.showScreen('home');
    }
    c.lights.length = 0;
    c.audio.play.mockClear();
    await vi.advanceTimersByTimeAsync(presentMs(3) + 60_000);
    expect(shown(c.lights)).toEqual(['blue', 'red', 'yellow']);
    expect(c.audio.play).toHaveBeenCalledTimes(3);
    expect(c.model()).toMatchObject({ lit: null, state: { phase: 'accepting', stage: 3, score: 2 } });
  });

  it('a visit to about after the game ends keeps the result', async () => {
    const c = setupVaried();
    await toStage3(c);
    c.controller.press('green'); // wrong
    c.controller.showScreen('about');
    expect(c.model()).toMatchObject({ screen: 'about', lit: null, state: { phase: 'lost', score: 2 } });
    c.controller.showScreen('home');
    await vi.runAllTimersAsync();
    expect(c.model().state).toMatchObject({ phase: 'lost', score: 2 });
  });

  it('a pending start is cancelled by going to about', async () => {
    const c = setupVaried();
    const pending = c.controller.start();
    c.controller.showScreen('about');
    await pending;
    expect(c.model().state.phase).toBe('idle');
    c.controller.showScreen('home');
    await vi.runAllTimersAsync();
    expect(c.model().state.phase).toBe('idle');
  });

  it('presses and start are ignored on the about screen', async () => {
    const c = setupVaried();
    await toStage3(c);
    c.controller.showScreen('about');
    c.controller.press('blue');
    await c.controller.start();
    expect(c.model().state).toMatchObject({ phase: 'paused', stage: 3, score: 2 });
  });

  it('hiding the page pauses on the home screen; continue replays the same sequence', async () => {
    const c = setupVaried();
    await toStage3(c);
    c.controller.press('blue');
    c.controller.pageHidden();
    expect(c.model()).toMatchObject({ screen: 'home', lit: null, state: { phase: 'paused', stage: 3, score: 2 } });
    vi.advanceTimersByTime(60_000);
    expect(c.model().state.phase).toBe('paused');
    await c.controller.start(); // "start" is not offered while paused
    expect(c.model().state.phase).toBe('paused');

    c.lights.length = 0;
    await c.controller.resume();
    await vi.advanceTimersByTimeAsync(presentMs(3));
    expect(shown(c.lights)).toEqual(['blue', 'red', 'yellow']);
    expect(c.model().state).toMatchObject({ phase: 'accepting', stage: 3, score: 2 });
  });

  it('hiding the page on the about screen changes nothing', async () => {
    const c = setupVaried();
    await toStage3(c);
    c.controller.showScreen('about');
    const before = c.model().state;
    c.controller.pageHidden();
    expect(c.model()).toMatchObject({ screen: 'about', state: before });
  });

  it('audio failure on return keeps the game paused until a retry succeeds', async () => {
    const c = setupVaried();
    await toStage3(c);
    c.controller.showScreen('about');
    c.audio.unlock.mockResolvedValueOnce(false);
    c.controller.showScreen('home');
    await vi.advanceTimersByTimeAsync(0);
    expect(c.model()).toMatchObject({ audioError: true, state: { phase: 'paused', stage: 3, score: 2 } });
    vi.advanceTimersByTime(60_000);
    expect(c.model().state.phase).toBe('paused');

    await c.controller.resume();
    expect(c.model()).toMatchObject({ audioError: false, state: { phase: 'presenting', stage: 3, score: 2 } });
  });
});
