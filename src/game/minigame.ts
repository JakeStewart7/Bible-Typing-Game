export type UpgradeId = 'power' | 'ward' | 'slow';
export type Enemy = { id: number; position: number; health: number; maxHealth: number };
export type Projectile = { id: number; position: number; angle: number; damage: number };

export type DefenseState = {
  faith: number; fortress: number; wave: number; enemiesDefeated: number;
  powerLevel: number; wardLevel: number; slowLevel: number;
  enemies: Enemy[]; projectiles: Projectile[];
  nextEnemyId: number; nextProjectileId: number; spawnTimer: number;
  status: 'playing' | 'won' | 'lost';
};

export const UPGRADE_COSTS: Record<UpgradeId, number> = { power: 35, ward: 45, slow: 55 };
export function upgradeCost(state: DefenseState, id: UpgradeId) {
  return UPGRADE_COSTS[id] + state[`${id}Level` as 'powerLevel' | 'wardLevel' | 'slowLevel'] * 20;
}

export function createDefenseState(): DefenseState {
  return {
    faith: 0, fortress: 100, wave: 1, enemiesDefeated: 0,
    powerLevel: 0, wardLevel: 0, slowLevel: 0,
    enemies: [createEnemy(1, 1)], projectiles: [],
    nextEnemyId: 2, nextProjectileId: 1, spawnTimer: 1.4,
    status: 'playing'
  };
}

export function typeCharacter(state: DefenseState, correct: boolean) {
  if (state.status !== 'playing') return state;
  if (correct) {
    state.faith += 1 + Math.floor(state.wave / 3);
    const anglePattern = [-7, 4, -2, 8, 1, -5, 6, -1];
    const angle = anglePattern[(state.nextProjectileId - 1) % anglePattern.length];
    state.projectiles.push({ id: state.nextProjectileId++, position: 94, angle, damage: 1 + state.powerLevel });
  } else {
    state.faith = Math.max(0, state.faith - 2);
    state.enemies.forEach(enemy => { enemy.position = Math.min(100, enemy.position + 2); });
  }
  return state;
}

export function advanceEnemy(state: DefenseState, deltaSeconds: number) {
  if (state.status !== 'playing') return state;
  const enemySpeed = Math.max(2.4, 6.2 + state.wave * .35 - state.slowLevel * 1.15);
  state.spawnTimer -= deltaSeconds;
  while (state.spawnTimer <= 0 && state.enemies.length < 15) {
    state.enemies.push(createEnemy(state.nextEnemyId++, state.wave));
    state.spawnTimer += Math.max(.75, 2.15 - state.wave * .1);
  }

  state.enemies.forEach(enemy => { enemy.position = Math.min(100, enemy.position + enemySpeed * deltaSeconds); });
  state.projectiles.forEach(projectile => { projectile.position -= 55 * deltaSeconds; });

  const removedProjectiles = new Set<number>();
  const defeatedEnemies = new Set<number>();
  for (const projectile of state.projectiles) {
    const target = state.enemies
      .filter(enemy => !defeatedEnemies.has(enemy.id))
      .sort((a, b) => b.position - a.position)
      .find(enemy => projectile.position <= enemy.position);
    if (!target) continue;
    target.health -= projectile.damage;
    removedProjectiles.add(projectile.id);
    if (target.health <= 0) {
      defeatedEnemies.add(target.id);
      state.enemiesDefeated++;
      state.faith += 5;
    }
  }
  state.projectiles = state.projectiles.filter(projectile => projectile.position > 0 && !removedProjectiles.has(projectile.id));
  state.enemies = state.enemies.filter(enemy => !defeatedEnemies.has(enemy.id));
  state.wave = Math.floor(state.enemiesDefeated / 5) + 1;

  const breached = state.enemies.filter(enemy => enemy.position >= 100);
  if (breached.length) {
    const damage = Math.max(7, 18 + state.wave - state.wardLevel * 4);
    state.fortress = Math.max(0, state.fortress - breached.length * damage);
    state.enemies = state.enemies.filter(enemy => enemy.position < 100);
    if (state.fortress === 0) state.status = 'lost';
  }
  return state;
}

export function buyUpgrade(state: DefenseState, id: UpgradeId) {
  const cost = upgradeCost(state, id);
  if (state.faith < cost || state.status !== 'playing') return false;
  state.faith -= cost;
  state[`${id}Level` as 'powerLevel' | 'wardLevel' | 'slowLevel']++;
  return true;
}

export function completeDefense(state: DefenseState) {
  if (state.status === 'playing') {
    state.status = 'won';
    state.faith += 50 + state.fortress;
  }
}

function createEnemy(id: number, wave: number): Enemy {
  const health = Math.min(8, 4 + Math.floor(wave / 3));
  return { id, position: 5, health, maxHealth: health };
}
