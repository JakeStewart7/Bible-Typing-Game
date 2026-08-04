const FADE_DURATION = 2000;

export function setupMusic(headerEl?: HTMLElement | null) {
  // imported assets are handled by the bundler where used; caller should ensure imports
  // Create the audio UI and play/pause behavior; returns the Audio instance if needed
  // Caller can import specific tracks and set audio.src after calling setupMusic if desired.
  const header = headerEl ?? document.querySelector('.game-header');
  if (!header) return null;

  const tracks = (window as any).__bundledMusic || [] as string[];
  const choice = tracks.length ? tracks[Math.floor(Math.random() * tracks.length)] : undefined;
  const audio = new Audio();
  if (choice) audio.src = choice as string;
  audio.loop = true;
  const targetVolume = 0.42;
  audio.volume = 0;
  audio.preload = 'auto';
  audio.crossOrigin = 'anonymous';

  function fadeIn(a: HTMLAudioElement, target = targetVolume, duration = FADE_DURATION) {
    const start = performance.now();
    function step(now: number) {
      const t = Math.min(1, (now - start) / duration);
      a.volume = t * target;
      if (t < 1) requestAnimationFrame(step);
    }
    requestAnimationFrame(step);
  }

  const controls = document.createElement('div');
  controls.className = 'music-controls';

  const playBtn = document.createElement('button');
  playBtn.className = 'btn music-btn';
  playBtn.textContent = 'Play Music';
  controls.appendChild(playBtn);

  const vol = document.createElement('input');
  vol.type = 'range';
  vol.min = '0'; vol.max = '1'; vol.step = '0.01'; vol.value = String(audio.volume);
  vol.className = 'volume-slider';
  controls.appendChild(vol);

  header.appendChild(controls);

  async function playAudio() {
    try {
      await audio.play();
      fadeIn(audio);
      playBtn.textContent = 'Pause Music';
    } catch (e) {
      console.warn('Autoplay prevented; user interaction required.');
      playBtn.textContent = 'Play Music';
    }
  }

  function pauseAudio() {
    audio.pause();
    playBtn.textContent = 'Play Music';
  }

  playBtn.addEventListener('click', async () => {
    if (audio.paused) {
      await playAudio();
    } else {
      pauseAudio();
    }
  });

  vol.addEventListener('input', () => {
    audio.volume = Number(vol.value);
  });

  // Try autoplay; fall back to showing play button state
  audio.play().then(() => {
    fadeIn(audio);
    playBtn.textContent = 'Pause Music';
  }).catch(() => {
    playBtn.textContent = 'Play Music';
  });

  return audio;
}
