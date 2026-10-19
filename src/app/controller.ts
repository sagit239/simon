import { FEEDBACK_MS, STAGE_PAUSE_MS, type PadColor } from '../config';
import { initialState, presentationDone, pressColor, startGame, type GameState } from '../game/engine';
import type { RandomSource } from '../game/sequence';
import type { Audio } from './audio';
import { createPlayback } from './playback';

export interface ViewModel {
  state: GameState;
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
}

export function createController(deps: { view: View; audio: Audio; random?: RandomSource }): Controller {
  const { view, audio, random } = deps;
  let state = initialState();
  let lit: PadColor | null = null;
  let audioError = false;
  // Bumped on every reset; scheduled callbacks from an older run are ignored.
  let runId = 0;
  let feedbackTimer: ReturnType<typeof setTimeout> | undefined;
  let nextStageTimer: ReturnType<typeof setTimeout> | undefined;

  const render = () => view.update({ state, lit, audioError });

  const playback = createPlayback(audio, (color) => {
    lit = color;
    render();
  });

  function reset(): void {
    runId++;
    playback.cancel();
    clearTimeout(feedbackTimer);
    clearTimeout(nextStageTimer);
    audio.stopAll();
    lit = null;
  }

  function present(): void {
    const id = runId;
    playback.play(state.sequence, () => {
      if (id !== runId) return;
      state = presentationDone(state);
      render();
    });
  }

  async function start(): Promise<void> {
    if (state.phase === 'presenting' || state.phase === 'accepting') return;
    reset();
    const id = runId;
    const ok = await audio.unlock();
    if (id !== runId) return;
    if (!ok) {
      // Audio failure is not a game failure: stay put and let the user retry.
      audioError = true;
      render();
      return;
    }
    audioError = false;
    state = startGame(random);
    render();
    present();
  }

  function press(color: PadColor): void {
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
        if (id === runId) present();
      }, FEEDBACK_MS + STAGE_PAUSE_MS);
    }
    // Light first, then sound, so both start together.
    render();
    audio.play(color, FEEDBACK_MS);
  }

  render();
  return { start, press };
}
