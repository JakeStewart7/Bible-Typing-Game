import type { Point } from '../domain/types.ts';
import { BASE } from '../domain/rules.ts';
import { setAttribute } from './dom-updates.ts';
import { DEFAULT_MAP_ZOOM, MAP_ZOOM_LEVELS, MIN_MAP_ZOOM, MAX_MAP_ZOOM } from '../infrastructure/developer-options.ts';
export { DEFAULT_MAP_ZOOM, MIN_MAP_ZOOM, MAX_MAP_ZOOM } from '../infrastructure/developer-options.ts';

export function wheelZoom(zoom: number, deltaY: number, deltaMode: number): number {
  const pixels = deltaY * (deltaMode === 1 ? 16 : deltaMode === 2 ? 240 : 1);
  const level = nearestZoom(zoom);
  const index = MAP_ZOOM_LEVELS.indexOf(level);
  return MAP_ZOOM_LEVELS[Math.max(0, Math.min(MAP_ZOOM_LEVELS.length - 1, index - Math.sign(pixels)))]!;
}
function nearestZoom(value: number) {
  return MAP_ZOOM_LEVELS.reduce((nearest, level) => Math.abs(level - value) < Math.abs(nearest - value) ? level : nearest);
}

export function cameraBounds(zoom: number, center: Point) {
  if (!Number.isFinite(zoom) || !Number.isFinite(center.x) || !Number.isFinite(center.y)) throw new Error('Invalid map camera coordinates.');
  const level = Math.max(MIN_MAP_ZOOM, Math.min(MAX_MAP_ZOOM, zoom));
  const width = 1000 / level, height = 650 / level;
  return {
    x: Math.max(0, Math.min(1000 - width, center.x - width / 2)),
    y: Math.max(0, Math.min(650 - height, center.y - height / 2)), width, height
  };
}

export function createMapCamera(map: SVGSVGElement) {
  let zoom = DEFAULT_MAP_ZOOM;
  let center: Point = { ...BASE };
  const weather = map.closest('.stronghold-stage')?.querySelector<HTMLElement>('.stronghold-weather-field');
  function draw(): void {
    const bounds = cameraBounds(zoom, center);
    center = { x: bounds.x + bounds.width / 2, y: bounds.y + bounds.height / 2 };
    setAttribute(map, 'viewBox', `${bounds.x} ${bounds.y} ${bounds.width} ${bounds.height}`);
    if (weather) {
      const matrix = map.getScreenCTM(), viewport = weather.parentElement?.getBoundingClientRect();
      if (matrix && viewport) {
        weather.style.width = `${1000 * matrix.a}px`;
        weather.style.height = `${650 * matrix.d}px`;
        weather.style.transform = `translate(${matrix.e - viewport.left}px, ${matrix.f - viewport.top}px)`;
      }
    }
  }
  function setZoom(value: number, point = center): void {
    if (!Number.isFinite(value)) throw new Error('Invalid map zoom.');
    zoom = nearestZoom(value);
    center = { ...point };
    draw();
  }
  draw();
  return {
    get zoom(): number { return zoom; },
    get center(): Point { return { ...center }; },
    refresh: draw,
    setZoom,
    panTo(point: Point): void { cameraBounds(zoom, point); center = { ...point }; draw(); },
    reset(value = DEFAULT_MAP_ZOOM): void { setZoom(value, BASE); }
  };
}
