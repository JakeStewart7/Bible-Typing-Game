let enabled = true;
let context: AudioContext | null = null;

export function toggleEffects() {
  enabled = !enabled;
  return enabled;
}

export function playKey(correct: boolean) {
  if (!enabled) return;
  context ??= new AudioContext();
  const oscillator = context.createOscillator();
  const gain = context.createGain();
  oscillator.type = correct ? 'sine' : 'square';
  oscillator.frequency.value = correct ? 520 : 130;
  gain.gain.setValueAtTime(correct ? 0.025 : 0.04, context.currentTime);
  gain.gain.exponentialRampToValueAtTime(0.001, context.currentTime + 0.055);
  oscillator.connect(gain).connect(context.destination);
  oscillator.start();
  oscillator.stop(context.currentTime + 0.06);
}

export function playComplete() {
  if (!enabled) return;
  [0, 120, 240].forEach((delay, index) => {
    window.setTimeout(() => {
      context ??= new AudioContext();
      const oscillator = context.createOscillator();
      const gain = context.createGain();
      oscillator.frequency.value = [523, 659, 784][index];
      gain.gain.setValueAtTime(0.06, context.currentTime);
      gain.gain.exponentialRampToValueAtTime(0.001, context.currentTime + 0.35);
      oscillator.connect(gain).connect(context.destination);
      oscillator.start();
      oscillator.stop(context.currentTime + 0.36);
    }, delay);
  });
}
