import type { GameStats } from '../game/stats';

export function renderStats(container: HTMLElement, stats: GameStats): void {
  const items = [
    ['⚡', stats.wpm, 'WPM'],
    ['◎', `${stats.accuracy}%`, 'Accuracy'],
    ['◷', formatTime(stats.time), 'Time'],
    ['✓', `${stats.progress}%`, 'Complete']
  ];
  container.innerHTML = items.map(([icon, value, label]) => `
    <div class="stat"><span class="stat-icon">${icon}</span><div><span class="stat-value">${value}</span><span class="stat-label">${label}</span></div></div>
  `).join('');
}

function formatTime(seconds: number) {
  return `${Math.floor(seconds / 60)}:${String(seconds % 60).padStart(2, '0')}`;
}
