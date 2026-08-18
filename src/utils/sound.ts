let ctx: AudioContext | null = null;

function getContext(): AudioContext | null {
  if (typeof window === "undefined") return null;
  const AudioCtx = window.AudioContext || (window as any).webkitAudioContext;
  if (!AudioCtx) return null;
  if (!ctx) ctx = new AudioCtx();
  // Browsers suspend new contexts until a user gesture — the toggle tap
  // that calls this is itself that gesture, so resume() is safe here.
  if (ctx.state === "suspended") ctx.resume();
  return ctx;
}

/**
 * A short, upbeat two-note "ding" played when a habit or to-do is
 * checked off. Synthesized rather than an audio file, so there's
 * nothing to bundle or download and it works fully offline.
 */
export function playCheckSound() {
  const audioCtx = getContext();
  if (!audioCtx) return;

  const now = audioCtx.currentTime;
  const notes: [number, number][] = [
    [880, now], // A5
    [1318.5, now + 0.09] // E6
  ];

  notes.forEach(([freq, start]) => {
    const osc = audioCtx.createOscillator();
    const gain = audioCtx.createGain();
    osc.type = "sine";
    osc.frequency.setValueAtTime(freq, start);
    gain.gain.setValueAtTime(0, start);
    gain.gain.linearRampToValueAtTime(0.18, start + 0.015);
    gain.gain.exponentialRampToValueAtTime(0.0001, start + 0.28);
    osc.connect(gain);
    gain.connect(audioCtx.destination);
    osc.start(start);
    osc.stop(start + 0.3);
  });
}

/** A softer, lower blip for un-checking — distinct enough not to feel like a reward. */
export function playUncheckSound() {
  const audioCtx = getContext();
  if (!audioCtx) return;

  const now = audioCtx.currentTime;
  const osc = audioCtx.createOscillator();
  const gain = audioCtx.createGain();
  osc.type = "sine";
  osc.frequency.setValueAtTime(440, now);
  osc.frequency.exponentialRampToValueAtTime(330, now + 0.12);
  gain.gain.setValueAtTime(0, now);
  gain.gain.linearRampToValueAtTime(0.1, now + 0.01);
  gain.gain.exponentialRampToValueAtTime(0.0001, now + 0.15);
  osc.connect(gain);
  gain.connect(audioCtx.destination);
  osc.start(now);
  osc.stop(now + 0.16);
}
