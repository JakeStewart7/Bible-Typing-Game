import { daylight, SEASON_LABELS } from '../domain/environment.ts';
import type { StrongholdSnapshot } from '../domain/types.ts';
import { setAttribute, setText } from './dom-updates.ts';

export function weatherMarkup(): string {
  return `<div class="stronghold-weather" aria-hidden="true">${Array.from({ length: 14 }, (_, index) =>
    `<i class="stronghold-weather-particle" style="--weather-x:${(index * 37 + 3) % 100}%;--weather-delay:-${index * .43}s;--weather-duration:${2.5 + index % 4 * .35}s;--weather-drift:${index % 2 ? 16 : -12}px"></i>`).join('')}</div>`;
}

export function renderEnvironment(screen: HTMLElement, label: HTMLElement, snapshot: Pick<StrongholdSnapshot, 'season' | 'environmentElapsed' | 'phase'>, running: boolean): void {
  const light = daylight(snapshot.environmentElapsed);
  setAttribute(screen, 'data-season', snapshot.season);
  setAttribute(screen, 'data-period', light.period);
  setAttribute(screen, 'data-weather-running', String(running && snapshot.phase === 'playing'));
  const opacity = (light.darkness * .42).toFixed(3);
  if (screen.style.getPropertyValue('--night-opacity') !== opacity) screen.style.setProperty('--night-opacity', opacity);
  setText(label, `${SEASON_LABELS[snapshot.season]} / ${light.period === 'day' ? 'Day' : 'Night'}`);
}
