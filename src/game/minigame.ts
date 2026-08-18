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
  elapsed: number;
  flightDuration: number;
  horizontalVelocity: number;
  verticalVelocity: number;
  gravity: number;
  damage: number;
  volleyId: number;
};

export type DefenseState = {
  faith: number; fortress: number; wave: number; enemiesDefeated: number;
  powerLevel: number; wardLevel: number; slowLevel: number;
  combo: number;
  enemies: Enemy[]; projectiles: Projectile[];
  damagedVolleys: Set<number>;
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
const LOB_ARC_HEIGHTS = [20, 38, 60] as const;
const LOB_HEIGHT_JITTER = 6;
const PROJECTILE_GRAVITY = 140;
const LAUNCH_POSITION = 94;
export type RandomSource = () => number;

export function upgradeCost(state: DefenseState, id: UpgradeId): number {
  const level = state[UPGRADE_LEVEL_KEYS[id]];
  return UPGRADE_COSTS[id] + (typeof level === 'number' ? level : 0) * 20;
}

export function createDefenseState(): DefenseState {
  return {
    faith: 0, fortress: 100, wave: 1, enemiesDefeated: 0,
    powerLevel: 0, wardLevel: 0, slowLevel: 0, combo: 0,
    enemies: [createEnemy(1, 1)], projectiles: [], damagedVolleys: new Set(),
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
      const arcHeight = LOB_ARC_HEIGHTS[index] + centeredRandom(random) * LOB_HEIGHT_JITTER;
      const flightDuration = 2 * Math.sqrt(2 * arcHeight / PROJECTILE_GRAVITY);
      const targetVelocity = target ? defenseEnemySpeed(state) * enemyProfile(target.kind).speed : 0;
      const targetPosition = clamp(
        target ? target.position + targetVelocity * flightDuration : random() * 72 + 8,
        3,
        91
      );
      state.projectiles.push({
        id: state.nextProjectileId++,
        position: LAUNCH_POSITION,
        launchPosition: LAUNCH_POSITION,
        targetPosition,
        targetEnemyId: target?.id,
        arcHeight,
        height: 0,
        elapsed: 0,
        flightDuration,
        horizontalVelocity: (LAUNCH_POSITION - targetPosition) / flightDuration,
        verticalVelocity: PROJECTILE_GRAVITY * flightDuration / 2,
        gravity: PROJECTILE_GRAVITY,
        damage: 1 + state.powerLevel + Math.floor(state.combo / 8),
        volleyId
      });
    }
  } else {
    state.combo = 0;
    state.faith = Math.max(0, state.faith - 2);
  }
  return state;
}

export function advanceEnemy(state: DefenseState, deltaSeconds: number): DefenseState {
  if (state.status !== 'playing') return state;
  const enemySpeed = defenseEnemySpeed(state);
  state.spawnTimer -= deltaSeconds;
  while (state.spawnTimer <= 0 && state.enemies.length < 15) {
    state.enemies.push(createEnemy(state.nextEnemyId++, state.wave));
    state.spawnTimer += Math.max(.75, 2.15 - state.wave * .1);
  }

  state.enemies.forEach(enemy => {
    const profile = enemyProfile(enemy.kind);
    enemy.position = Math.min(100, enemy.position + enemySpeed * profile.speed * deltaSeconds);
  });
  const previousElapsed = new Map<number, number>();
  state.projectiles.forEach(projectile => {
    previousElapsed.set(projectile.id, projectile.elapsed);
    projectile.elapsed = Math.min(projectile.flightDuration, projectile.elapsed + deltaSeconds);
    projectile.position = projectile.launchPosition - projectile.horizontalVelocity * projectile.elapsed;
    projectile.height = ballisticHeight(projectile, projectile.elapsed);
  });

  const removedProjectiles = new Set<number>();
  const defeatedEnemies = new Set<number>();
  for (const projectile of state.projectiles) {
    const candidates = state.enemies
      .filter(enemy => !defeatedEnemies.has(enemy.id))
      .sort((a, b) => Number(b.id === projectile.targetEnemyId) - Number(a.id === projectile.targetEnemyId));
    const target = candidates.find(enemy =>
      projectileIntersectsEnemy(projectile, enemy, previousElapsed.get(projectile.id) ?? 0)
    );
    if (target || projectile.elapsed >= projectile.flightDuration) removedProjectiles.add(projectile.id);
    if (!target || state.damagedVolleys.has(projectile.volleyId)) continue;
    state.damagedVolleys.add(projectile.volleyId);
    target.health -= projectile.damage;
    if (target.health <= 0) {
      defeatedEnemies.add(target.id);
      state.enemiesDefeated++;
      state.faith += 5;
    }
  }
  state.projectiles = state.projectiles.filter(projectile => !removedProjectiles.has(projectile.id));
  const activeVolleys = new Set(state.projectiles.map(projectile => projectile.volleyId));
  state.damagedVolleys.forEach(volleyId => {
    if (!activeVolleys.has(volleyId)) state.damagedVolleys.delete(volleyId);
  });
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

function defenseEnemySpeed(state: DefenseState): number {
  return Math.max(2.4, 6.2 + state.wave * .35 - state.slowLevel * 1.15);
}

function centeredRandom(random: RandomSource): number {
  return random() * 2 - 1;
}

function clamp(value: number, minimum: number, maximum: number): number {
  return Math.min(maximum, Math.max(minimum, value));
}

function ballisticHeight(projectile: Projectile, elapsed: number): number {
  return Math.max(0, projectile.verticalVelocity * elapsed - projectile.gravity * elapsed ** 2 / 2);
}

function projectileIntersectsEnemy(projectile: Projectile, enemy: Enemy, previousElapsed: number): boolean {
  const hitbox = enemyHitbox(enemy.kind);
  const timeAtEnemy = (projectile.launchPosition - enemy.position) / projectile.horizontalVelocity;
  const collisionTime = clamp(timeAtEnemy, previousElapsed, projectile.elapsed);
  const position = projectile.launchPosition - projectile.horizontalVelocity * collisionTime;
  return Math.abs(position - enemy.position) <= hitbox.radius
    && ballisticHeight(projectile, collisionTime) <= hitbox.height;
}

function enemyHitbox(kind: EnemyKind | undefined): { radius: number; height: number } {
  switch (kind) {
    case 'rusher': return { radius: 3.5, height: 7 };
    case 'warden': return { radius: 6, height: 11 };
    case 'titan': return { radius: 7, height: 14 };
    default: return { radius: 5, height: 9 };
  }
}
