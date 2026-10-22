import { daylight } from '../domain/environment.ts';
import type { StrongholdSnapshot } from '../domain/types.ts';
import { setAttribute } from './dom-updates.ts';

export const AUTUMN_LEAF_COLORS: readonly string[] = Object.freeze(['#c84b3d', '#e78b32', '#e4bc4c', '#8b5d3d']);
export const WEATHER_PARTICLE_COUNT = 48;
export const SPRING_PARTICLE_COUNT = 18;
export const SUMMER_PARTICLE_COUNT = 32;

export function weatherMarkup(random: () => number = Math.random): string {
  const breeze = random() * Math.PI * 2;
  const colors = Array.from({ length: WEATHER_PARTICLE_COUNT }, () => AUTUMN_LEAF_COLORS[Math.floor(random() * AUTUMN_LEAF_COLORS.length)]);
  const positions: { x: number; y: number }[] = [];
  for (let index = 0; index < WEATHER_PARTICLE_COUNT; index++) {
    let point = { x: 0, y: 0 }, best = -1;
    for (let attempt = 0; attempt < 12; attempt++) {
      const candidate = { x: random() * 100, y: random() * 100 };
      const separation = Math.min(...positions.map(p => ((p.x - candidate.x) * 1.6) ** 2 + (p.y - candidate.y) ** 2));
      if (separation > best) { point = candidate; best = separation; }
    }
    positions.push(point);
  }
  return `<div class="stronghold-weather" aria-hidden="true" style="--breeze-x:${(Math.cos(breeze) * 160).toFixed(2)}px;--breeze-y:${(Math.sin(breeze) * 160).toFixed(2)}px"><div class="stronghold-weather-field">${positions.map((point, index) => {
    const duration = 9 + index % 4 * 1.5;
    const color = colors[index];
    if (!color) throw new Error('Leaf colors require a random value from zero up to, but not including, one.');
    return `<i class="stronghold-weather-particle" style="--leaf-color:${color};--weather-x:${point.x.toFixed(2)}%;--weather-y:${point.y.toFixed(2)}%;--weather-delay:-${(index / WEATHER_PARTICLE_COUNT * duration).toFixed(2)}s;--weather-duration:${duration}s;--weather-drift:${index % 2 ? 16 : -12}px"${index >= SUMMER_PARTICLE_COUNT ? ' data-summer-hidden' : ''}${index >= SPRING_PARTICLE_COUNT ? ' data-spring-hidden' : ''}></i>`;
  }).join('')}</div></div>`;
}

export function renderEnvironment(screen: HTMLElement, snapshot: Pick<StrongholdSnapshot, 'season' | 'environmentElapsed' | 'phase'>, running: boolean): void {
  const light = daylight(snapshot.environmentElapsed);
  setAttribute(screen, 'data-season', snapshot.season);
  setAttribute(screen, 'data-period', light.period);
  setAttribute(screen, 'data-weather-running', String(running && snapshot.phase === 'playing'));
  const opacity = (light.darkness * .55).toFixed(3);
  if (screen.style.getPropertyValue('--night-opacity') !== opacity) screen.style.setProperty('--night-opacity', opacity);
}
