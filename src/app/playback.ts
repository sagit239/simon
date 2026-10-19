import { GAP_MS, LIGHT_MS, type PadColor } from '../config';
import type { Audio } from './audio';

export interface Playback {
  play(sequence: readonly PadColor[], onDone: () => void): void;
  cancel(): void;
}

// Shows one item at a time (light + tone for LIGHT_MS, GAP_MS between items).
// Nothing is scheduled ahead, so cancel() stops everything immediately.
export function createPlayback(
  audio: Pick<Audio, 'play' | 'stopAll'>,
  setLit: (color: PadColor | null) => void,
): Playback {
  let runId = 0;
  let timer: ReturnType<typeof setTimeout> | undefined;

  function cancel(): void {
    runId++;
    clearTimeout(timer);
    timer = undefined;
    audio.stopAll();
    setLit(null);
  }

  function play(sequence: readonly PadColor[], onDone: () => void): void {
    cancel();
    const id = runId;
    let index = 0;

    const showItem = () => {
      if (id !== runId) return;
      const color = sequence[index];
      setLit(color);
      audio.play(color, LIGHT_MS);
      timer = setTimeout(() => {
        if (id !== runId) return;
        setLit(null);
        index++;
        if (index < sequence.length) {
          timer = setTimeout(showItem, GAP_MS);
        } else {
          timer = undefined;
          onDone();
        }
      }, LIGHT_MS);
    };

    showItem();
  }

  return { play, cancel };
}
