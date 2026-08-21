import { upgradeCost } from '../game/minigame';
import type { DefenseState, UpgradeId } from '../game/minigame';

export type DefenseElements = {
  faith: HTMLElement;
  fortress: HTMLElement;
  wave: HTMLElement;
  defeated: HTMLElement;
  path: HTMLElement;
  message: HTMLElement;
};

export function createDefenseView(elements: DefenseElements) {
  const enemyElements = new Map<number, { element: HTMLElement; health: HTMLElement }>();
  const projectileElements = new Map<number, HTMLElement>();

  function render(state: DefenseState): void {
    setText(elements.faith, state.faith);
    setText(elements.fortress, state.fortress);
    setText(elements.wave, state.wave);
    setText(elements.defeated, state.enemiesDefeated);
    removeInactive(enemyElements, new Set(state.enemies.map(enemy => enemy.id)));
    removeInactive(projectileElements, new Set(state.projectiles.map(projectile => projectile.id)));

    for (const enemy of state.enemies) {
      const { element, health } = getEnemyElement(enemy.id);
      element.dataset.kind = enemy.kind ?? 'wisp';
      const bottom = 18 + ((enemy.id % 3) - 1) * 2;
      element.style.transform = `translate3d(${enemy.position}cqw, ${-bottom}px, 0) translateX(-50%)`;
      health.style.transform = `scaleX(${enemy.health / enemy.maxHealth})`;
    }
    for (const projectile of state.projectiles) {
      const element = getProjectileElement(projectile.id);
      element.style.transform = `translate3d(${projectile.position}cqw, ${-(30 + projectile.height)}px, 0) translateX(-50%)`;
    }
    renderUpgrades(state);
    if (state.status === 'lost') {
      elements.message.textContent = 'The fortress fell. Restart the passage to rally again!';
    } else if (state.status === 'won') {
      elements.message.textContent = 'Victory! The Word held the line.';
    } else if (state.combo >= 8) {
      elements.message.textContent = `Light streak ×${state.combo} · empowered volley`;
    } else {
      elements.message.textContent = 'Type correctly to send light across the field!';
    }
  }

  function reset(): void {
    enemyElements.forEach(({ element }) => element.remove());
    projectileElements.forEach(element => element.remove());
    enemyElements.clear();
    projectileElements.clear();
  }

  function getEnemyElement(id: number): { element: HTMLElement; health: HTMLElement } {
    const existing = enemyElements.get(id);
    if (existing) return existing;
    const element = document.createElement('div');
    element.className = 'enemy';
    element.innerHTML = '<span class="enemy-core" aria-hidden="true"></span><div class="enemy-health"><i></i></div>';
    elements.path.appendChild(element);
    const health = element.querySelector<HTMLElement>('.enemy-health i');
    if (!health) throw new Error('Enemy health element was not created.');
    const view = { element, health };
    enemyElements.set(id, view);
    return view;
  }

  function getProjectileElement(id: number): HTMLElement {
    const existing = projectileElements.get(id);
    if (existing) return existing;
    const element = document.createElement('i');
    element.className = 'light-projectile';
    elements.path.appendChild(element);
    projectileElements.set(id, element);
    return element;
  }

  return { render, reset };
}

function removeInactive<T extends HTMLElement | { element: HTMLElement }>(
  elements: Map<number, T>,
  activeIds: Set<number>
): void {
  elements.forEach((entry, id) => {
    if (!activeIds.has(id)) {
      ('element' in entry ? entry.element : entry).remove();
      elements.delete(id);
    }
  });
}

function setText(element: HTMLElement, value: string | number): void {
  const text = String(value);
  if (element.textContent !== text) element.textContent = text;
}

function renderUpgrades(state: DefenseState): void {
  document.querySelectorAll<HTMLButtonElement>('[data-upgrade]').forEach(button => {
    const id = button.dataset.upgrade as UpgradeId;
    const level = id === 'power' ? state.powerLevel : id === 'ward' ? state.wardLevel : state.slowLevel;
    const cost = upgradeCost(state, id);
    button.disabled = state.faith < cost || state.status !== 'playing';
    button.querySelector(`[data-cost="${id}"]`)!.textContent = String(cost);
    button.querySelector(`[data-level="${id}"]`)!.textContent = `Lv ${level}`;
  });
}
