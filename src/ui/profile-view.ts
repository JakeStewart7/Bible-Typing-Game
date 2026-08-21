import type { PlayerProfile } from '../profile';

export type ProfileElements = {
  level: HTMLElement;
  xp: HTMLElement;
  xpFill: HTMLElement;
  bestWpm: HTMLElement;
  lifetimeWpm: HTMLElement;
  recentWpm: HTMLElement;
};

export function renderProfile(elements: ProfileElements, profile: PlayerProfile): void {
  elements.level.textContent = `Level ${profile.level}`;
  elements.xpFill.style.transform = `scaleX(${(profile.xp % 500) / 500})`;
  setSpeed(elements.bestWpm, profile.bestWpm);
  setSpeed(elements.lifetimeWpm, profile.lifetimeWpm);
  setSpeed(elements.recentWpm, profile.recentWpm);
}

function setSpeed(element: HTMLElement, value: number): void {
  const valueElement = element.querySelector('strong');
  if (valueElement) valueElement.textContent = `${value} WPM`;
}
