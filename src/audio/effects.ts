let enabled = true;
let context: AudioContext | null = null;
let keyBus: GainNode | null = null;
let correctKeyBuffer: AudioBuffer | null = null;
let errorKeyBuffer: AudioBuffer | null = null;

export function toggleEffects() {
  enabled = !enabled;
  return enabled;
}

export function playKey(correct: boolean) {
  if (!enabled) return;
  context ??= new AudioContext();
  keyBus ??= createKeyBus(context);
  correctKeyBuffer ??= createKeyBuffer(context, 520, 'sine', .025);
  errorKeyBuffer ??= createKeyBuffer(context, 130, 'square', .04);
  const source = context.createBufferSource();
  source.buffer = correct ? correctKeyBuffer : errorKeyBuffer;
  source.connect(keyBus);
  source.start();
}

function createKeyBus(audioContext: AudioContext): GainNode {
  const gain = audioContext.createGain();
  gain.connect(audioContext.destination);
  return gain;
}

function createKeyBuffer(
  audioContext: AudioContext,
  frequency: number,
  wave: 'sine' | 'square',
  volume: number
): AudioBuffer {
  const durationSeconds = .06;
  const frameCount = Math.ceil(audioContext.sampleRate * durationSeconds);
  const buffer = audioContext.createBuffer(1, frameCount, audioContext.sampleRate);
  const samples = buffer.getChannelData(0);
  for (let frame = 0; frame < frameCount; frame++) {
    const phase = 2 * Math.PI * frequency * frame / audioContext.sampleRate;
    const signal = wave === 'sine' ? Math.sin(phase) : Math.sign(Math.sin(phase));
    const envelope = Math.exp(-6 * frame / frameCount);
    samples[frame] = signal * volume * envelope;
  }
  return buffer;
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

export function playReady() {
  if (!enabled) return;
  context ??= new AudioContext();
  const oscillator = context.createOscillator();
  const gain = context.createGain();
  oscillator.type = 'sine';
  oscillator.frequency.setValueAtTime(440, context.currentTime);
  oscillator.frequency.exponentialRampToValueAtTime(660, context.currentTime + 0.18);
  gain.gain.setValueAtTime(0.035, context.currentTime);
  gain.gain.exponentialRampToValueAtTime(0.001, context.currentTime + 0.22);
  oscillator.connect(gain).connect(context.destination);
  oscillator.start();
  oscillator.stop(context.currentTime + 0.23);
}
