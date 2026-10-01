import type { Point } from '../domain/types.ts';
import { BASE } from '../domain/rules.ts';
import { setAttribute } from './dom-updates.ts';
import { DEFAULT_MAP_ZOOM, MIN_MAP_ZOOM, MAX_MAP_ZOOM } from '../infrastructure/developer-options.ts';
export { DEFAULT_MAP_ZOOM, MIN_MAP_ZOOM, MAX_MAP_ZOOM } from '../infrastructure/developer-options.ts';

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
  function draw(): void {
    const bounds = cameraBounds(zoom, center);
    center = { x: bounds.x + bounds.width / 2, y: bounds.y + bounds.height / 2 };
    setAttribute(map, 'viewBox', `${bounds.x} ${bounds.y} ${bounds.width} ${bounds.height}`);
  }
  function setZoom(value: number, point = center): void {
    if (!Number.isFinite(value)) throw new Error('Invalid map zoom.');
    zoom = Math.max(MIN_MAP_ZOOM, Math.min(MAX_MAP_ZOOM, Math.round(value * 1000) / 1000));
    center = { ...point };
    draw();
  }
  draw();
  return {
    get zoom(): number { return zoom; },
    get center(): Point { return { ...center }; },
    setZoom,
    panTo(point: Point): void { cameraBounds(zoom, point); center = { ...point }; draw(); },
    reset(value = DEFAULT_MAP_ZOOM): void { setZoom(value, BASE); }
  };
}
