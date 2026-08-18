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
  const enemyElements = new Map<number, HTMLElement>();
  const projectileElements = new Map<number, HTMLElement>();

  function render(state: DefenseState): void {
    elements.faith.textContent = String(state.faith);
    elements.fortress.textContent = String(state.fortress);
    elements.wave.textContent = String(state.wave);
    elements.defeated.textContent = String(state.enemiesDefeated);
    removeInactive(enemyElements, new Set(state.enemies.map(enemy => enemy.id)));
    removeInactive(projectileElements, new Set(state.projectiles.map(projectile => projectile.id)));

    for (const enemy of state.enemies) {
      const element = getEnemyElement(enemy.id);
      element.dataset.kind = enemy.kind ?? 'wisp';
      element.style.left = `${enemy.position}%`;
      element.style.bottom = `${18 + ((enemy.id % 3) - 1) * 2}px`;
      const health = element.querySelector<HTMLElement>('.enemy-health i');
      if (health) health.style.width = `${enemy.health / enemy.maxHealth * 100}%`;
    }
    for (const projectile of state.projectiles) {
      const element = getProjectileElement(projectile.id);
      const distance = projectile.launchPosition - projectile.targetPosition;
      const progress = Math.min(1, Math.max(0, (projectile.launchPosition - projectile.position) / distance));
      const height = Math.sin(progress * Math.PI) * projectile.arcHeight;
      element.style.left = `${projectile.position}%`;
      element.style.bottom = `${30 + height}px`;
      element.style.transform = `translateX(-50%) rotate(${165 + progress * 30}deg)`;
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
    enemyElements.forEach(element => element.remove());
    projectileElements.forEach(element => element.remove());
    enemyElements.clear();
    projectileElements.clear();
  }

  function getEnemyElement(id: number): HTMLElement {
    const existing = enemyElements.get(id);
    if (existing) return existing;
    const element = document.createElement('div');
    element.className = 'enemy';
    element.innerHTML = '<span class="enemy-core" aria-hidden="true"></span><div class="enemy-health"><i></i></div>';
    elements.path.appendChild(element);
    enemyElements.set(id, element);
    return element;
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

function removeInactive(elements: Map<number, HTMLElement>, activeIds: Set<number>): void {
  elements.forEach((element, id) => {
    if (!activeIds.has(id)) {
      element.remove();
      elements.delete(id);
    }
  });
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
