import { TONE_HZ, type PadColor } from '../config';

export interface Audio {
  // Must be called from a user gesture. Resolves to false if audio cannot run.
  unlock(): Promise<boolean>;
  play(color: PadColor, ms: number): void;
  stopAll(): void;
}

const UNLOCK_TIMEOUT_MS = 1000;
const VOLUME = 0.3;
const RAMP_S = 0.01;

export function createAudio(): Audio {
  let ctx: AudioContext | undefined;
  const active = new Set<OscillatorNode>();

  async function unlock(): Promise<boolean> {
    try {
      ctx ??= new AudioContext();
      if (ctx.state !== 'running') {
        // Some mobile browsers never settle resume() while interrupted.
        const timeout = new Promise<void>((resolve) => setTimeout(resolve, UNLOCK_TIMEOUT_MS));
        await Promise.race([ctx.resume(), timeout]);
      }
      return ctx.state === 'running';
    } catch {
      return false;
    }
  }

  function stopAll(): void {
    for (const osc of active) {
      try {
        osc.stop();
      } catch {
        // Already stopped.
      }
    }
    active.clear();
  }

  // One tone at a time: a new tone cuts off the previous one.
  function play(color: PadColor, ms: number): void {
    stopAll();
    if (!ctx || ctx.state !== 'running') return;
    try {
      const now = ctx.currentTime;
      const end = now + ms / 1000;
      const osc = ctx.createOscillator();
      const gain = ctx.createGain();
      osc.type = 'triangle';
      osc.frequency.value = TONE_HZ[color];
      // Short fade in/out avoids audible clicks.
      gain.gain.setValueAtTime(0, now);
      gain.gain.linearRampToValueAtTime(VOLUME, now + RAMP_S);
      gain.gain.setValueAtTime(VOLUME, end - RAMP_S);
      gain.gain.linearRampToValueAtTime(0, end);
      osc.connect(gain).connect(ctx.destination);
      osc.onended = () => active.delete(osc);
      active.add(osc);
      osc.start(now);
      osc.stop(end);
    } catch {
      // A failed tone must never affect the game.
    }
  }

  return { unlock, play, stopAll };
}
