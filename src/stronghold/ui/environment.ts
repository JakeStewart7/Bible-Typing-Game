import { daylight, SEASON_LABELS } from '../domain/environment.ts';
import type { StrongholdSnapshot } from '../domain/types.ts';
import { setAttribute, setText } from './dom-updates.ts';

export const AUTUMN_LEAF_COLORS: readonly string[] = Object.freeze(['#c84b3d', '#e78b32', '#e4bc4c', '#8b5d3d']);

export function weatherMarkup(random: () => number = Math.random): string {
  return `<div class="stronghold-weather" aria-hidden="true">${Array.from({ length: 14 }, (_, index) => {
    const color = AUTUMN_LEAF_COLORS[Math.floor(random() * AUTUMN_LEAF_COLORS.length)];
    if (!color) throw new Error('Leaf colors require a random value from zero up to, but not including, one.');
    return `<i class="stronghold-weather-particle" style="--leaf-color:${color};--weather-x:${(index * 37 + 3) % 100}%;--weather-delay:-${index * .43}s;--weather-duration:${2.5 + index % 4 * .35}s;--weather-drift:${index % 2 ? 16 : -12}px"></i>`;
  }).join('')}</div>`;
}

export function renderEnvironment(screen: HTMLElement, label: HTMLElement, snapshot: Pick<StrongholdSnapshot, 'season' | 'environmentElapsed' | 'phase'>, running: boolean): void {
  const light = daylight(snapshot.environmentElapsed);
  setAttribute(screen, 'data-season', snapshot.season);
  setAttribute(screen, 'data-period', light.period);
  setAttribute(screen, 'data-weather-running', String(running && snapshot.phase === 'playing'));
  const opacity = (light.darkness * .55).toFixed(3);
  if (screen.style.getPropertyValue('--night-opacity') !== opacity) screen.style.setProperty('--night-opacity', opacity);
  setText(label, `${SEASON_LABELS[snapshot.season]} / ${light.period === 'day' ? 'Day' : 'Night'}`);
}
