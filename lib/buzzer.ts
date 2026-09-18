// A short two-tone chime, synthesized directly via the Web Audio API — no
// audio file to host or load. Used to alert staff to a new call-waiter /
// request-bill notification landing on-screen.
export function playBuzzer() {
  try {
    const AudioContextCtor = window.AudioContext || (window as unknown as { webkitAudioContext: typeof AudioContext }).webkitAudioContext;
    const ctx = new AudioContextCtor();
    const now = ctx.currentTime;

    const tone = (freq: number, start: number, duration: number) => {
      const osc = ctx.createOscillator();
      const gain = ctx.createGain();
      osc.type = "sine";
      osc.frequency.value = freq;
      gain.gain.setValueAtTime(0, now + start);
      gain.gain.linearRampToValueAtTime(0.25, now + start + 0.02);
      gain.gain.exponentialRampToValueAtTime(0.001, now + start + duration);
      osc.connect(gain);
      gain.connect(ctx.destination);
      osc.start(now + start);
      osc.stop(now + start + duration);
    };

    tone(880, 0, 0.18);
    tone(1175, 0.16, 0.22);

    setTimeout(() => ctx.close().catch(() => {}), 600);
  } catch {
    // Audio isn't available (e.g. autoplay blocked before any user
    // interaction) — the visible banner is still there either way.
  }
}
