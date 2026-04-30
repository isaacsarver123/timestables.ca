// Tiny Web Audio sound effects. No external assets required.

let ctx = null;
let enabled = true;

function getCtx() {
  if (typeof window === "undefined") return null;
  if (!ctx) {
    try {
      const AC = window.AudioContext || window.webkitAudioContext;
      ctx = new AC();
    } catch {
      ctx = null;
    }
  }
  return ctx;
}

export function setSoundEnabled(v) {
  enabled = !!v;
}

function tone(freq, duration = 0.12, type = "sine", gain = 0.06, when = 0) {
  if (!enabled) return;
  const ac = getCtx();
  if (!ac) return;
  const t0 = ac.currentTime + when;
  const osc = ac.createOscillator();
  const g = ac.createGain();
  osc.type = type;
  osc.frequency.setValueAtTime(freq, t0);
  g.gain.setValueAtTime(0, t0);
  g.gain.linearRampToValueAtTime(gain, t0 + 0.01);
  g.gain.exponentialRampToValueAtTime(0.0001, t0 + duration);
  osc.connect(g).connect(ac.destination);
  osc.start(t0);
  osc.stop(t0 + duration + 0.02);
}

export const sfx = {
  correct() {
    tone(660, 0.09, "triangle", 0.05);
    tone(990, 0.12, "triangle", 0.05, 0.06);
  },
  wrong() {
    tone(180, 0.18, "sawtooth", 0.06);
    tone(140, 0.22, "sawtooth", 0.05, 0.05);
  },
  coin() {
    tone(1320, 0.06, "square", 0.035);
    tone(1760, 0.08, "square", 0.03, 0.04);
  },
  levelup() {
    tone(523, 0.1, "triangle", 0.05);
    tone(659, 0.1, "triangle", 0.05, 0.1);
    tone(784, 0.18, "triangle", 0.05, 0.2);
  },
  tick() {
    tone(880, 0.04, "square", 0.02);
  },
  // Fanfare — "da-da-da-DAAAA" trumpet run played on lesson completion.
  // Uses the brassier "sawtooth" wave with a slight warble for flavour.
  fanfare() {
    // Short triplet lead-in, then a held triumphant major chord-ish stack.
    tone(523.25, 0.12, "sawtooth", 0.055, 0.00);   // C5
    tone(659.25, 0.12, "sawtooth", 0.055, 0.12);   // E5
    tone(783.99, 0.12, "sawtooth", 0.055, 0.24);   // G5
    // Sustained final blast — C, E, G together (major triad) + octave up.
    tone(523.25, 0.65, "sawtooth", 0.05,  0.40);   // C5 held
    tone(659.25, 0.65, "sawtooth", 0.045, 0.42);   // E5 held
    tone(783.99, 0.65, "sawtooth", 0.045, 0.44);   // G5 held
    tone(1046.5, 0.70, "triangle", 0.04,  0.46);   // C6 shimmer
  },
};
