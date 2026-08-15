const FADE_DURATION = 900;

export function setupMusic(container?: HTMLElement | null) {
  if (!container) return null;
  const tracks = (window as Window & { __bundledMusic?: string[] }).__bundledMusic || [];
  const audio = new Audio(tracks[Math.floor(Math.random() * tracks.length)]);
  audio.loop = true;
  audio.volume = 0.22;
  audio.preload = 'auto';

  container.innerHTML = `
    <div class="music-controls">
      <button class="music-btn" aria-label="Play background music">♫ Music</button>
      <input class="volume-slider" aria-label="Music volume" type="range" min="0" max="0.5" step="0.01" value="0.22">
    </div>`;
  const button = container.querySelector<HTMLButtonElement>('.music-btn')!;
  const volume = container.querySelector<HTMLInputElement>('.volume-slider')!;

  button.addEventListener('click', async event => {
    event.stopPropagation();
    if (audio.paused) {
      await audio.play();
      button.textContent = '❚❚ Music';
    } else {
      audio.pause();
      button.textContent = '♫ Music';
    }
  });
  volume.addEventListener('input', () => { audio.volume = Number(volume.value); });

  audio.addEventListener('play', () => {
    const target = Number(volume.value);
    audio.volume = 0;
    const start = performance.now();
    const fade = (now: number) => {
      audio.volume = Math.min(target, target * ((now - start) / FADE_DURATION));
      if (audio.volume < target) requestAnimationFrame(fade);
    };
    requestAnimationFrame(fade);
  });
  return audio;
}
