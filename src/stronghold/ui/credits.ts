import { SEASONS } from '../domain/types.ts';
import { SEASON_LABELS } from '../domain/environment.ts';
import { SEASON_MUSIC, trackSource } from '../audio/catalog.ts';

export function creditsMarkup(): string {
  return `<dialog id="stronghold-credits" class="stronghold-credits-dialog" aria-labelledby="stronghold-credits-title">
    <header><h2 id="stronghold-credits-title">Stronghold credits</h2><button id="stronghold-close-credits" type="button">Back to game</button></header>
    <h3>Seasonal soundtrack</h3>
    <p>Selected track: <strong id="stronghold-current-track"></strong></p>
    <p>All music below by <a href="https://incompetech.com/" target="_blank" rel="noopener noreferrer">Kevin MacLeod (incompetech.com)</a>.</p>
    <p>Licensed under <a href="https://creativecommons.org/licenses/by/4.0/" target="_blank" rel="noopener noreferrer">Creative Commons: By Attribution 4.0 (CC BY 4.0)</a>.
      Recordings are unmodified and loop during playback.</p>
    <ul class="stronghold-credit-tracks">${SEASONS.map(season => (['day', 'night'] as const).map(period => {
      const track = SEASON_MUSIC[season][period];
      return `<li><a href="${trackSource(track)}" target="_blank" rel="noopener noreferrer">${track.title}</a><span>${SEASON_LABELS[season]} / ${period === 'day' ? 'Day' : 'Night'}</span></li>`;
    }).join('')).join('')}</ul>
    <p>Each title links to the composer's official source. Audio is included locally; playback does not require the music website.</p>
  </dialog>`;
}
