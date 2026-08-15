import type { PlayerProfile } from '../profile';

export type ProfileElements = {
  level: HTMLElement;
  xp: HTMLElement;
  xpFill: HTMLElement;
  bestWpm: HTMLElement;
  streak: HTMLElement;
};

export function renderProfile(elements: ProfileElements, profile: PlayerProfile): void {
  elements.level.textContent = `Level ${profile.level}`;
  elements.xp.textContent = `${profile.xp} XP`;
  elements.xpFill.style.width = `${(profile.xp % 500) / 5}%`;
  elements.bestWpm.textContent = `Personal best: ${profile.bestWpm} WPM`;
  elements.streak.textContent = `${profile.streak} day${profile.streak === 1 ? '' : 's'} streak`;
}
