// A short two-tone chime, synthesized directly via the Web Audio API — no
// audio file to host or load. Used to alert staff to new website/QR orders
// and call-waiter / request-bill notifications.
//
// Browsers keep a page's audio switched off ("suspended") until someone taps
// or clicks it. One shared AudioContext is unlocked on the first tap and kept
// for every later chime — a chime fired from a timer can't unlock audio by
// itself, so without this the alerts could play silently.

let ctx: AudioContext | null = null;

function context(): AudioContext | null {
  if (typeof window === "undefined") return null;
  if (!ctx) {
    const Ctor = window.AudioContext || (window as unknown as { webkitAudioContext: typeof AudioContext }).webkitAudioContext;
    if (!Ctor) return null;
    ctx = new Ctor();
  }
  return ctx;
}

// True while the browser is still blocking sound (no tap yet).
export function audioBlocked(): boolean {
  const c = context();
  return !c || c.state !== "running";
}

// Call from a tap/click handler; also wired to the first tap anywhere below.
export function unlockAudio(): Promise<void> {
  const c = context();
  return c && c.state !== "running" ? c.resume().catch(() => {}) : Promise.resolve();
}

if (typeof window !== "undefined") {
  const unlock = () => { unlockAudio(); };
  window.addEventListener("pointerdown", unlock, { capture: true });
  window.addEventListener("keydown", unlock, { capture: true });
}

export function playBuzzer() {
  try {
    const c = context();
    if (!c) return;
    if (c.state !== "running") c.resume().catch(() => {});
    const now = c.currentTime;

    const tone = (freq: number, start: number, duration: number) => {
      const osc = c.createOscillator();
      const gain = c.createGain();
      osc.type = "sine";
      osc.frequency.value = freq;
      gain.gain.setValueAtTime(0, now + start);
      gain.gain.linearRampToValueAtTime(0.35, now + start + 0.02);
      gain.gain.exponentialRampToValueAtTime(0.001, now + start + duration);
      osc.connect(gain);
      gain.connect(c.destination);
      osc.start(now + start);
      osc.stop(now + start + duration);
    };

    tone(880, 0, 0.18);
    tone(1175, 0.16, 0.22);
    tone(880, 0.45, 0.18);
    tone(1175, 0.61, 0.22);
  } catch {
    // Audio isn't available — the visible banner is still there either way.
  }
}
