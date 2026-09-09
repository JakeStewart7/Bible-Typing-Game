import { advanceEnemy, buyUpgrade, completeDefense, createDefenseState, typeCharacter } from '../src/game/minigame.ts';
import { equal, test } from './harness.ts';

test('defense typing earns faith and damages enemies', () => {
  const state = createDefenseState();
  typeCharacter(state, true, () => .5);
  equal(state.faith, 1);
  equal(state.projectiles.length, 3);
  advanceEnemy(state, 2);
  equal(state.enemies[0].health, 3);
  equal(state.projectiles.length, 0);
  typeCharacter(state, false);
  equal(state.faith, 0);
  equal(Math.round(state.enemies[0].position), 18);
});

test('incorrect arcade typing does not advance shadows', () => {
  const state = createDefenseState();
  const position = state.enemies[0].position;
  typeCharacter(state, false);
  equal(state.enemies[0].position, position);
});

test('defense enemies advance and damage the fortress', () => {
  const state = createDefenseState();
  advanceEnemy(state, 20);
  equal(state.fortress < 100, true);
});

test('defense upgrades consume resources and improve levels', () => {
  const state = createDefenseState();
  state.faith = 100;
  equal(buyUpgrade(state, 'power'), true);
  equal(state.powerLevel, 1);
  equal(state.faith, 65);
  typeCharacter(state, true, () => .5);
  advanceEnemy(state, 2);
  equal(state.enemies[0].health, 2);
});

test('light is destroyed on contact and defeats low-health shadows', () => {
  const state = createDefenseState();
  state.enemies[0].health = 1;
  typeCharacter(state, true, () => .5);
  advanceEnemy(state, 2);
  equal(state.projectiles.length, 0);
  equal(state.enemiesDefeated, 1);
  equal(state.faith, 6);
});

test('multiple shadows can occupy the battlefield', () => {
  const state = createDefenseState();
  advanceEnemy(state, 3);
  equal(state.enemies.length, 2);
});

test('up to fifteen shadows can occupy the battlefield', () => {
  const state = createDefenseState();
  state.spawnTimer = -100;
  advanceEnemy(state, .01);
  equal(state.enemies.length, 15);
});

test('light targets the unified shadow line regardless of visual angle', () => {
  const state = createDefenseState();
  state.enemies.push({ id: 2, position: 10, health: 4, maxHealth: 4 });
  typeCharacter(state, true, () => .5);
  advanceEnemy(state, 2);
  equal(state.projectiles.length, 0);
  equal(state.enemies.some(enemy => enemy.health < enemy.maxHealth), true);
});

test('missed light disappears after crossing the battlefield', () => {
  const state = createDefenseState();
  state.enemies = [];
  typeCharacter(state, true, () => .5);
  advanceEnemy(state, 2);
  equal(state.projectiles.length, 0);
});

test('arcade volleys are deterministic and spread across the battlefield', () => {
  const state = createDefenseState();
  state.enemies.push({ id: 2, position: 45, health: 4, maxHealth: 4 });
  const values = [.25, .5, .75, .1, .9, .4];
  let index = 0;
  typeCharacter(state, true, () => values[index++ % values.length]!);
  equal(state.projectiles.map(projectile => ({
    target: Math.round(projectile.targetPosition),
    arc: Math.round(projectile.arcHeight)
  })), [
    { target: 11, arc: 17 },
    { target: 55, arc: 38 },
    { target: 17, arc: 63 }
  ]);
});

test('arcade projectiles collide consistently across animation-sized steps', () => {
  const state = createDefenseState();
  typeCharacter(state, true, () => .5);
  equal(state.projectiles.map(projectile => Math.round(projectile.arcHeight)), [20, 38, 60]);
  for (let step = 0; step < 40; step++) advanceEnemy(state, .05);
  equal(state.projectiles.length, 0);
  equal(state.enemies[0].health, 3);
});

test('completing defense awards a victory bonus', () => {
  const state = createDefenseState();
  completeDefense(state);
  equal(state.status, 'won');
  equal(state.faith, 150);
});
