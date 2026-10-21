import { SEASONS } from '../domain/types.ts';
import { SEASON_LABELS } from '../domain/environment.ts';
import { SEASON_MUSIC } from '../audio/catalog.ts';

export function creditsMarkup(): string {
  return `<dialog id="stronghold-credits" class="stronghold-credits-dialog" aria-labelledby="stronghold-credits-title">
    <header><h2 id="stronghold-credits-title">Stronghold credits</h2><button id="stronghold-close-credits" type="button">Back to game</button></header>
    <h3>Seasonal soundtrack</h3>
    <p>Selected track: <strong id="stronghold-current-track"></strong></p>
    <p>All music below by Kevin MacLeod (incompetech.com).</p>
    <p>Licensed under Creative Commons: By Attribution 4.0 (CC BY 4.0).
      License: https://creativecommons.org/licenses/by/4.0/.
      Recordings are unmodified and loop during playback.</p>
    <ul class="stronghold-credit-tracks">${SEASONS.map(season => (['day', 'night'] as const).map(period => {
      const track = SEASON_MUSIC[season][period];
      return `<li><strong>${track.title}</strong><span>${SEASON_LABELS[season]} / ${period === 'day' ? 'Day' : 'Night'}</span></li>`;
    }).join('')).join('')}</ul>
  </dialog>`;
}
