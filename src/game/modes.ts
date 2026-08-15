export const GAME_MODES = ['practice', 'precision', 'sprint', 'memory', 'defense'] as const;
export type GameMode = typeof GAME_MODES[number];

export const MODE_LABELS: Record<GameMode, string> = {
  practice: '🌿 Relaxed practice',
  precision: '🎯 Precision mode: mistakes glow red while you keep moving',
  sprint: '⚡ Sprint mode: finish before the clock hits 1:00',
  memory: '🧠 Memory mode: completed words fade away',
  defense: '🛡 Scripture Defense: type to repel the advancing shadows'
};

export const MODE_BONUSES: Record<GameMode, number> = {
  practice: 1,
  precision: 1.4,
  sprint: 1.6,
  memory: 1.8,
  defense: 2
};

export function parseGameMode(value: string): GameMode {
  return GAME_MODES.find(mode => mode === value) ?? 'practice';
}
