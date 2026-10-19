import { STAGE_COUNT, type PadColor } from '../config';
import { generateSequence, type RandomSource } from './sequence';

export type Phase = 'idle' | 'presenting' | 'accepting' | 'paused' | 'won' | 'lost';

export interface GameState {
  phase: Phase;
  stage: number;
  score: number;
  sequence: PadColor[];
  inputIndex: number;
}

export type PressOutcome = 'ignored' | 'correct' | 'stageComplete' | 'won' | 'lost';

export function initialState(): GameState {
  return { phase: 'idle', stage: 1, score: 0, sequence: [], inputIndex: 0 };
}

// Also used for "new game": a full reset to stage 1 with a fresh sequence.
export function startGame(random?: RandomSource): GameState {
  return { phase: 'presenting', stage: 1, score: 0, sequence: generateSequence(1, random), inputIndex: 0 };
}

export function presentationDone(state: GameState): GameState {
  if (state.phase !== 'presenting') return state;
  return { ...state, phase: 'accepting', inputIndex: 0 };
}

export function isPlaying(state: GameState): boolean {
  return state.phase === 'presenting' || state.phase === 'accepting';
}

// Interrupting an active game keeps stage, score and sequence, and drops any
// partial answer. Other phases are left as they are.
export function pause(state: GameState): GameState {
  if (!isPlaying(state)) return state;
  return { ...state, phase: 'paused', inputIndex: 0 };
}

// Replays the same sequence from the start: no new draw, no score change.
export function resume(state: GameState): GameState {
  if (state.phase !== 'paused') return state;
  return { ...state, phase: 'presenting', inputIndex: 0 };
}

export function pressColor(
  state: GameState,
  color: PadColor,
  random?: RandomSource,
): { state: GameState; outcome: PressOutcome } {
  if (state.phase !== 'accepting') return { state, outcome: 'ignored' };

  if (state.sequence[state.inputIndex] !== color) {
    return { state: { ...state, phase: 'lost' }, outcome: 'lost' };
  }

  const inputIndex = state.inputIndex + 1;
  if (inputIndex < state.sequence.length) {
    return { state: { ...state, inputIndex }, outcome: 'correct' };
  }

  const score = state.score + 1;
  if (state.stage >= STAGE_COUNT) {
    return { state: { ...state, phase: 'won', score, inputIndex }, outcome: 'won' };
  }

  // Classic Simon: keep the previous sequence and append one random color.
  // Input locks immediately so extra fast presses cannot score twice.
  const stage = state.stage + 1;
  const sequence = [...state.sequence, ...generateSequence(1, random)];
  return {
    state: { phase: 'presenting', stage, score, sequence, inputIndex: 0 },
    outcome: 'stageComplete',
  };
}
