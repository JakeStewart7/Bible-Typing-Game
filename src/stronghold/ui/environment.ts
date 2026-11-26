import { daylight, SEASON_BONUSES, SEASON_LABELS } from '../domain/environment.ts';
import type { Season, StrongholdSnapshot } from '../domain/types.ts';
import { setAttribute, setText } from './dom-updates.ts';

export const AUTUMN_LEAF_COLORS: readonly string[] = Object.freeze(['#c84b3d', '#e78b32', '#e4bc4c', '#8b5d3d']);
export const WEATHER_PARTICLE_COUNT = 64;
export const SPRING_PARTICLE_COUNT = 18;
export const SUMMER_PARTICLE_COUNT = 64;
export const FALL_WINTER_PARTICLE_COUNT = 48;

export function seasonEffect(season: Season): { label: string; description: string } {
  const bonuses = SEASON_BONUSES[season];
  const effects: string[] = [], details: string[] = [];
  const change = (value: number): string => `${value > 1 ? '+' : ''}${Math.round((value - 1) * 100)}%`;
  if (bonuses.movement !== 1) {
    effects.push(`Unit speed ${change(bonuses.movement)}`);
    details.push(`All friendly and enemy units move ${Math.abs(Math.round((bonuses.movement - 1) * 100))}% ${bonuses.movement > 1 ? 'faster' : 'slower'}.`);
  }
  if (bonuses.resources !== 1) {
    effects.push(`Supplies ${change(bonuses.resources)}`);
    details.push(`Gathered and typed shared supplies are worth ${Math.abs(Math.round((bonuses.resources - 1) * 100))}% ${bonuses.resources > 1 ? 'more' : 'less'}.`);
  }
  if (bonuses.typing !== 1) {
    effects.push(`Typing work ${change(bonuses.typing)}`);
    details.push(`Completed typing tasks and shared tier contributions earn ${Math.round((bonuses.typing - 1) * 100)}% more work.`);
  }
  return { label: effects.join(' / '), description: `${SEASON_LABELS[season]}. ${details.join(' ')}` };
}

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
    return `<i class="stronghold-weather-particle" style="--leaf-color:${color};--weather-x:${Math.min(99.99, point.x).toFixed(2)}%;--weather-y:${Math.min(99.99, point.y).toFixed(2)}%;--weather-delay:-${(index / WEATHER_PARTICLE_COUNT * duration).toFixed(2)}s;--weather-duration:${duration}s;--weather-drift:${index % 2 ? 16 : -12}px"${index >= FALL_WINTER_PARTICLE_COUNT ? ' data-fall-winter-hidden' : ''}${index >= SPRING_PARTICLE_COUNT ? ' data-spring-hidden' : ''}></i>`;
  }).join('')}</div></div>`;
}

export function renderEnvironment(screen: HTMLElement, snapshot: Pick<StrongholdSnapshot, 'season' | 'environmentElapsed' | 'phase'>, running: boolean): void {
  const light = daylight(snapshot.environmentElapsed);
  const indicator = screen.querySelector('#stronghold-season');
  if (!indicator) throw new Error('Missing Stronghold seasonal effects indicator.');
  const effect = seasonEffect(snapshot.season);
  setText(indicator, `${SEASON_LABELS[snapshot.season]}: ${effect.label}`);
  setAttribute(indicator, 'data-tooltip', effect.description);
  setAttribute(indicator, 'aria-description', effect.description);
  setAttribute(screen, 'data-season', snapshot.season);
  setAttribute(screen, 'data-period', light.period);
  setAttribute(screen, 'data-weather-running', String(running && snapshot.phase === 'playing'));
  const opacity = (light.darkness * .55).toFixed(3);
  if (screen.style.getPropertyValue('--night-opacity') !== opacity) screen.style.setProperty('--night-opacity', opacity);
}
