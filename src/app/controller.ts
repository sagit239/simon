import { FEEDBACK_MS, STAGE_PAUSE_MS, type PadColor } from '../config';
import {
  initialState,
  isPlaying,
  pause,
  presentationDone,
  pressColor,
  resume as resumeState,
  startGame,
  type GameState,
} from '../game/engine';
import type { RandomSource } from '../game/sequence';
import type { Audio } from './audio';
import { createPlayback } from './playback';

export type Screen = 'home' | 'about';

export interface ViewModel {
  state: GameState;
  screen: Screen;
  lit: PadColor | null;
  audioError: boolean;
}

export interface View {
  update(model: ViewModel): void;
}

export interface Controller {
  // Used for both "start" and "new game".
  start(): Promise<void>;
  press(color: PadColor): void;
  // Called on every navigation, from in-app buttons and browser back/forward.
  showScreen(next: Screen): void;
  // The "continue" button on the home screen.
  resume(): Promise<void>;
  pageHidden(): void;
}

export function createController(deps: { view: View; audio: Audio; random?: RandomSource }): Controller {
  const { view, audio, random } = deps;
  let state = initialState();
  let screen: Screen = 'home';
  let lit: PadColor | null = null;
  let audioError = false;
  // Bumped on every reset; scheduled callbacks from an older run are ignored.
  let runId = 0;
  let feedbackTimer: ReturnType<typeof setTimeout> | undefined;
  let nextStageTimer: ReturnType<typeof setTimeout> | undefined;

  const render = () => view.update({ state, screen, lit, audioError });

  const playback = createPlayback(audio, (color) => {
    lit = color;
    render();
  });

  // Stops everything in flight: playback, timers, tones and lights.
  function reset(): void {
    runId++;
    playback.cancel();
    clearTimeout(feedbackTimer);
    clearTimeout(nextStageTimer);
    audio.stopAll();
    lit = null;
  }

  // Interruption (about screen or hidden page). Stage, score and sequence stay.
  function interrupt(): void {
    reset();
    state = pause(state);
    render();
  }

  function present(): void {
    const id = runId;
    playback.play(state.sequence, () => {
      if (id !== runId) return;
      state = presentationDone(state);
      render();
    });
  }

  // Audio must be (re)unlocked inside a user gesture. On failure nothing
  // advances; the caller's phase is kept so the user can retry.
  async function unlockAudio(): Promise<boolean> {
    const id = runId;
    const ok = await audio.unlock();
    if (id !== runId) return false;
    audioError = !ok;
    if (!ok) render();
    return ok;
  }

  async function start(): Promise<void> {
    if (screen !== 'home') return;
    if (state.phase !== 'idle' && state.phase !== 'won' && state.phase !== 'lost') return;
    reset();
    if (!(await unlockAudio())) return;
    state = startGame(random);
    render();
    present();
  }

  async function resume(): Promise<void> {
    if (screen !== 'home' || state.phase !== 'paused') return;
    reset();
    if (!(await unlockAudio())) return;
    state = resumeState(state);
    render();
    present();
  }

  function showScreen(next: Screen): void {
    if (next === screen) return;
    screen = next;
    // Leaving home always stops whatever is running; it only changes the
    // game if one is active. A pending start/resume is cancelled too.
    if (next === 'about') {
      interrupt();
      return;
    }
    render();
    if (state.phase === 'paused') void resume();
  }

  function pageHidden(): void {
    // On the about screen the game is already paused.
    if (screen !== 'home') return;
    interrupt();
  }

  function press(color: PadColor): void {
    if (screen !== 'home') return;
    const result = pressColor(state, color, random);
    if (result.outcome === 'ignored') return;
    state = result.state;
    // Each press is a user gesture, which keeps the audio context alive.
    void audio.unlock();

    const id = runId;
    lit = color;
    clearTimeout(feedbackTimer);
    feedbackTimer = setTimeout(() => {
      if (id !== runId) return;
      lit = null;
      render();
    }, FEEDBACK_MS);

    if (result.outcome === 'stageComplete') {
      nextStageTimer = setTimeout(() => {
        if (id === runId && isPlaying(state)) present();
      }, FEEDBACK_MS + STAGE_PAUSE_MS);
    }
    // Light first, then sound, so both start together.
    render();
    audio.play(color, FEEDBACK_MS);
  }

  render();
  return { start, press, showScreen, resume, pageHidden };
}
