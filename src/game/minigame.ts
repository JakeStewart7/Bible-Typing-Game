export type UpgradeId = 'power' | 'ward' | 'slow';
export type EnemyKind = 'wisp' | 'rusher' | 'warden' | 'titan';
export type Enemy = {
  id: number;
  position: number;
  health: number;
  maxHealth: number;
  kind?: EnemyKind;
};
export type Projectile = {
  id: number;
  position: number;
  launchPosition: number;
  targetPosition: number;
  targetEnemyId?: number;
  arcHeight: number;
  height: number;
  verticalVelocity: number;
  damage: number;
  volleyId: number;
};

export type DefenseState = {
  faith: number; fortress: number; wave: number; enemiesDefeated: number;
  powerLevel: number; wardLevel: number; slowLevel: number;
  combo: number;
  enemies: Enemy[]; projectiles: Projectile[];
  nextEnemyId: number; nextProjectileId: number; spawnTimer: number;
  status: 'playing' | 'won' | 'lost';
};

export const UPGRADE_COSTS: Record<UpgradeId, number> = { power: 35, ward: 45, slow: 55 };
const UPGRADE_LEVEL_KEYS = {
  power: 'powerLevel',
  ward: 'wardLevel',
  slow: 'slowLevel'
} as const satisfies Record<UpgradeId, keyof DefenseState>;
const PROJECTILES_PER_CHARACTER = 3;
const PROJECTILE_SPREAD = 16;
const MIN_ARC_HEIGHT = 22;
const ARC_HEIGHT_RANGE = 34;
const PROJECTILE_SPEED = 55;
const GRAVITY = 30;
const ENEMY_HITBOX_RADIUS = 5;
const ENEMY_HITBOX_HEIGHT = 24;
export type RandomSource = () => number;

export function upgradeCost(state: DefenseState, id: UpgradeId): number {
  const level = state[UPGRADE_LEVEL_KEYS[id]];
  return UPGRADE_COSTS[id] + (typeof level === 'number' ? level : 0) * 20;
}

export function createDefenseState(): DefenseState {
  return {
    faith: 0, fortress: 100, wave: 1, enemiesDefeated: 0,
    powerLevel: 0, wardLevel: 0, slowLevel: 0, combo: 0,
    enemies: [createEnemy(1, 1)], projectiles: [],
    nextEnemyId: 2, nextProjectileId: 1, spawnTimer: 1.4,
    status: 'playing'
  };
}

export function typeCharacter(
  state: DefenseState,
  correct: boolean,
  random: RandomSource = Math.random
): DefenseState {
  if (state.status !== 'playing') return state;
  if (correct) {
    state.combo++;
    state.faith += 1 + Math.floor(state.wave / 3);
    const targets = [...state.enemies].sort((a, b) => a.position - b.position);
    const volleyId = state.nextProjectileId;
    for (let index = 0; index < PROJECTILES_PER_CHARACTER; index++) {
      const target = targets[index % Math.max(1, targets.length)];
      const targetPosition = clamp((target?.position ?? random() * 72 + 8) + centeredRandom(random) * PROJECTILE_SPREAD, 3, 88);
      state.projectiles.push({
        id: state.nextProjectileId++,
        position: 94,
        launchPosition: 94,
        targetPosition,
        targetEnemyId: target?.id,
        arcHeight: MIN_ARC_HEIGHT + random() * ARC_HEIGHT_RANGE,
        height: 0,
        verticalVelocity: 0,
        damage: 1 + state.powerLevel + Math.floor(state.combo / 8),
        volleyId
      });
      const projectile = state.projectiles[state.projectiles.length - 1];
      const travelTime = (projectile.launchPosition - projectile.targetPosition) / PROJECTILE_SPEED;
      projectile.verticalVelocity = (2 * projectile.arcHeight) / travelTime;
    }
  } else {
    state.combo = 0;
    state.faith = Math.max(0, state.faith - 2);
  }
  return state;
}

export function advanceEnemy(state: DefenseState, deltaSeconds: number): DefenseState {
  if (state.status !== 'playing') return state;
  const enemySpeed = Math.max(2.4, 6.2 + state.wave * .35 - state.slowLevel * 1.15);
  state.spawnTimer -= deltaSeconds;
  while (state.spawnTimer <= 0 && state.enemies.length < 15) {
    state.enemies.push(createEnemy(state.nextEnemyId++, state.wave));
    state.spawnTimer += Math.max(.75, 2.15 - state.wave * .1);
  }

  state.enemies.forEach(enemy => {
    const profile = enemyProfile(enemy.kind);
    enemy.position = Math.min(100, enemy.position + enemySpeed * profile.speed * deltaSeconds);
  });
  state.projectiles.forEach(projectile => {
    projectile.position -= PROJECTILE_SPEED * deltaSeconds;
    projectile.height = Math.max(0, projectile.height + projectile.verticalVelocity * deltaSeconds);
    projectile.verticalVelocity -= GRAVITY * deltaSeconds;
  });

  const removedProjectiles = new Set<number>();
  const defeatedEnemies = new Set<number>();
  const damagedVolleys = new Set<number>();
  for (const projectile of state.projectiles) {
    if (projectile.position > projectile.targetPosition) continue;
    const target = state.enemies
      .filter(enemy => !defeatedEnemies.has(enemy.id))
      .filter(enemy => projectile.targetEnemyId === undefined || enemy.id === projectile.targetEnemyId)
      .filter(enemy => Math.abs(enemy.position - projectile.position) <= ENEMY_HITBOX_RADIUS || projectile.position < enemy.position - ENEMY_HITBOX_RADIUS)
      .filter(enemy => projectileHeightAt(projectile, enemy.position) <= ENEMY_HITBOX_HEIGHT)
      .sort((a, b) => Math.abs(a.position - projectile.targetPosition) - Math.abs(b.position - projectile.targetPosition))[0];
    removedProjectiles.add(projectile.id);
    if (!target || damagedVolleys.has(projectile.volleyId)) continue;
    damagedVolleys.add(projectile.volleyId);
    target.health -= projectile.damage;
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

export function buyUpgrade(state: DefenseState, id: UpgradeId): boolean {
  const cost = upgradeCost(state, id);
  if (state.faith < cost || state.status !== 'playing') return false;
  state.faith -= cost;
  const levelKey = UPGRADE_LEVEL_KEYS[id];
  state[levelKey]++;
  return true;
}

export function completeDefense(state: DefenseState): void {
  if (state.status === 'playing') {
    state.status = 'won';
    state.faith += 50 + state.fortress;
  }
}

function createEnemy(id: number, wave: number): Enemy {
  const kind = enemyKindFor(id, wave);
  const profile = enemyProfile(kind);
  return { id, position: 5, health: profile.health, maxHealth: profile.health, kind };
}

function enemyKindFor(id: number, wave: number): EnemyKind {
  if (wave >= 4 && id % 9 === 0) return 'titan';
  if (wave >= 2 && id % 5 === 0) return 'warden';
  if (id % 3 === 0) return 'rusher';
  return 'wisp';
}

function enemyProfile(kind: EnemyKind | undefined): { health: number; speed: number } {
  switch (kind) {
    case 'rusher': return { health: 2, speed: 1.65 };
    case 'warden': return { health: 7, speed: .72 };
    case 'titan': return { health: 11, speed: .48 };
    default: return { health: 4, speed: 1 };
  }
}

function centeredRandom(random: RandomSource): number {
  return random() * 2 - 1;
}

function clamp(value: number, minimum: number, maximum: number): number {
  return Math.min(maximum, Math.max(minimum, value));
}

function projectileHeightAt(projectile: Projectile, position: number): number {
  const distance = projectile.launchPosition - projectile.targetPosition;
  const progress = clamp((projectile.launchPosition - position) / distance, 0, 1);
  return 4 * projectile.arcHeight * progress * (1 - progress);
}
