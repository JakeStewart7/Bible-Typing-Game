import { SEASONS, type ResourceNode, type Season } from './types.ts';

export const DAY_SECONDS = 180;
export const NIGHT_SECONDS = 180;
export const TWILIGHT_SECONDS = 15;
export const SEASON_LABELS: Record<Season, string> = {
  spring: 'Spring', summer: 'Summer', fall: 'Fall', winter: 'Winter'
};

const LAYOUTS: Record<Season, readonly (readonly [number, number])[]> = {
  spring: [[350, 515], [675, 530], [195, 400], [835, 375], [410, 335], [640, 300], [155, 235], [790, 180]],
  summer: [[290, 530], [730, 520], [200, 370], [840, 345], [370, 390], [680, 325], [145, 235], [805, 170]],
  fall: [[270, 510], [705, 535], [165, 345], [860, 390], [375, 300], [650, 370], [230, 190], [810, 205]],
  winter: [[300, 535], [720, 535], [175, 395], [825, 395], [355, 305], [665, 305], [190, 205], [800, 205]]
};

function seasonSample(): number {
  const sample = new Uint32Array(1);
  globalThis.crypto.getRandomValues(sample);
  return sample[0]! / 0x100000000;
}

export function randomSeason(random: () => number = seasonSample): Season {
  const season = SEASONS[Math.floor(random() * SEASONS.length)];
  if (!season) throw new Error('Season selection requires a random value from zero up to, but not including, one.');
  return season;
}

export function seasonalNodes(season: Season): ResourceNode[] {
  return LAYOUTS[season].map(([x, y], index) => {
    const rich = index === 5 || index === 6;
    return { id: 100 + x, x, y, rich, remaining: rich ? 1200 : 800 };
  });
}

export function daylight(elapsed: number): { period: 'day' | 'night'; darkness: number; cycle: number } {
  const duration = DAY_SECONDS + NIGHT_SECONDS;
  const time = elapsed % duration;
  const night = time >= DAY_SECONDS;
  const darkness = night ? Math.min(1, (duration - time) / TWILIGHT_SECONDS)
    : Math.max(0, (time - DAY_SECONDS + TWILIGHT_SECONDS) / TWILIGHT_SECONDS);
  return { period: night ? 'night' : 'day', darkness, cycle: Math.floor(elapsed / duration) };
}
