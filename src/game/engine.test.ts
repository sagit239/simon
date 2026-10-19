import { describe, expect, it } from 'vitest';
import {
  initialState,
  pause,
  presentationDone,
  pressColor,
  resume,
  startGame,
  type GameState,
} from './engine';

// Cycles through the given values so each stage gets a predictable sequence.
function cycle(values: number[]) {
  let i = 0;
  return () => values[i++ % values.length];
}

// Presents the current stage and answers it correctly.
function answer(state: GameState, random?: () => number) {
  let s = presentationDone(state);
  let outcome = '';
  for (const color of [...s.sequence]) {
    const r = pressColor(s, color, random);
    s = r.state;
    outcome = r.outcome;
  }
  return { state: s, outcome };
}

describe('engine', () => {
  it('starts idle with score 0 and no sequence', () => {
    expect(initialState()).toEqual({ phase: 'idle', stage: 1, score: 0, sequence: [], inputIndex: 0 });
  });

  it('starts at stage 1 with a one-item sequence', () => {
    const s = startGame(() => 0.5);
    expect(s).toEqual({ phase: 'presenting', stage: 1, score: 0, sequence: ['yellow'], inputIndex: 0 });
  });

  it('accepts input only after the presentation is done', () => {
    const s = startGame(() => 0);
    expect(pressColor(s, 'blue')).toEqual({ state: s, outcome: 'ignored' });
    expect(presentationDone(s).phase).toBe('accepting');
  });

  it('ignores presses after the game is over', () => {
    const lost = pressColor(presentationDone(startGame(() => 0)), 'red').state;
    expect(lost.phase).toBe('lost');
    expect(pressColor(lost, 'blue')).toEqual({ state: lost, outcome: 'ignored' });
  });

  it('gives one point per completed stage and appends one color to the sequence', () => {
    const random = cycle([0, 0.3, 0.6, 0.9]);
    let { state, outcome } = answer(startGame(random), random);
    expect(outcome).toBe('stageComplete');
    expect(state.phase).toBe('presenting');
    expect(state.stage).toBe(2);
    expect(state.score).toBe(1);
    // Stage 1 was [blue]; stage 2 keeps it and appends one new color.
    expect(state.sequence).toEqual(['blue', 'red']);
    ({ state } = answer(state, random));
    expect(state.sequence).toEqual(['blue', 'red', 'yellow']);
  });

  it('keeps every earlier color as the sequence grows to 10', () => {
    const random = cycle([0.1, 0.4, 0.7, 0.95, 0.2]);
    let s = startGame(random);
    for (let stage = 2; stage <= 10; stage++) {
      const previous = [...s.sequence];
      s = answer(s, random).state;
      expect(s.sequence).toHaveLength(stage);
      expect(s.sequence.slice(0, stage - 1)).toEqual(previous);
    }
  });

  it('ends on the first mistake without partial credit', () => {
    let s = startGame(() => 0);
    for (let i = 0; i < 4; i++) s = answer(s, () => 0).state;
    expect(s.stage).toBe(5);
    s = presentationDone(s);
    s = pressColor(s, 'blue').state;
    s = pressColor(s, 'blue').state;
    const r = pressColor(s, 'green');
    expect(r.outcome).toBe('lost');
    expect(r.state.phase).toBe('lost');
    expect(r.state.score).toBe(4);
  });

  it('wins after stage 10 with exactly 10 points', () => {
    const random = cycle([0.1, 0.4, 0.7, 0.95, 0.2]);
    let s = startGame(random);
    let outcome = '';
    for (let stage = 1; stage <= 10; stage++) {
      expect(s.sequence).toHaveLength(stage);
      expect(s.score).toBe(stage - 1);
      ({ state: s, outcome } = answer(s, random));
    }
    expect(outcome).toBe('won');
    expect(s.phase).toBe('won');
    expect(s.stage).toBe(10);
    expect(s.score).toBe(10);
  });

  it('does not double score on fast repeated presses after completing a stage', () => {
    const { state } = answer(startGame(() => 0), () => 0);
    const again = pressColor(state, 'blue', () => 0);
    expect(again.outcome).toBe('ignored');
    expect(again.state.score).toBe(1);
  });

  describe('pause and resume', () => {
    const random = cycle([0, 0.3, 0.6]);
    // Stage 3, score 2, sequence blue-red-yellow, one correct press made.
    const midAnswer = () => {
      let s = startGame(random);
      s = answer(s, random).state;
      s = answer(s, random).state;
      s = presentationDone(s);
      return pressColor(s, s.sequence[0]).state;
    };

    it('pausing mid-answer keeps stage, score and sequence and drops the partial answer', () => {
      const s = midAnswer();
      expect(s.inputIndex).toBe(1);
      const paused = pause(s);
      expect(paused).toEqual({ ...s, phase: 'paused', inputIndex: 0 });
    });

    it('pausing mid-presentation keeps the game as it is', () => {
      const s = startGame(() => 0);
      expect(pause(s)).toEqual({ ...s, phase: 'paused' });
    });

    it('does not change idle, won or lost games', () => {
      const idle = initialState();
      const lost = pressColor(presentationDone(startGame(() => 0)), 'red').state;
      expect(pause(idle)).toBe(idle);
      expect(pause(lost)).toBe(lost);
      expect(resume(idle)).toBe(idle);
      expect(resume(lost)).toBe(lost);
    });

    it('resumes by presenting the same sequence again from the start', () => {
      const paused = pause(midAnswer());
      const resumed = resume(paused);
      expect(resumed).toEqual({ ...paused, phase: 'presenting', inputIndex: 0 });
      expect(resumed.sequence).toBe(paused.sequence);
    });

    it('ignores presses while paused', () => {
      const paused = pause(midAnswer());
      expect(pressColor(paused, paused.sequence[0])).toEqual({ state: paused, outcome: 'ignored' });
    });
  });
});
