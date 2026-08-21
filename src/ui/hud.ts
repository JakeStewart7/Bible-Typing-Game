import type { GameStats } from '../game/stats';

type StatsView = {
  values: HTMLElement[];
  renderedValues: string[];
};

const statsViews = new WeakMap<HTMLElement, StatsView>();

export function renderStats(container: HTMLElement, stats: GameStats): void {
  const items = [
    ['»', stats.wpm, 'WPM'],
    ['◎', `${stats.accuracy}%`, 'Accuracy'],
    ['◷', formatTime(stats.time), 'Time'],
    ['✓', `${stats.progress}%`, 'Complete']
  ];
  let view = statsViews.get(container);
  if (!view) {
    const elements = items.map(([icon, value, label]) => {
      const stat = document.createElement('div');
      stat.className = 'stat';
      const iconEl = document.createElement('span');
      iconEl.className = 'stat-icon';
      iconEl.textContent = String(icon);
      const copy = document.createElement('div');
      const valueEl = document.createElement('span');
      valueEl.className = 'stat-value';
      valueEl.textContent = String(value);
      const labelEl = document.createElement('span');
      labelEl.className = 'stat-label';
      labelEl.textContent = String(label);
      copy.append(valueEl, labelEl);
      stat.append(iconEl, copy);
      return stat;
    });
    container.replaceChildren(...elements);
    view = {
      values: [...container.querySelectorAll<HTMLElement>('.stat-value')],
      renderedValues: items.map(([, value]) => String(value))
    };
    statsViews.set(container, view);
    return;
  }

  items.forEach(([, value], index) => {
    const nextValue = String(value);
    if (view.renderedValues[index] === nextValue) return;
    const valueEl = view.values[index];
    if (valueEl) valueEl.textContent = nextValue;
    view.renderedValues[index] = nextValue;
  });
}

function formatTime(seconds: number) {
  return `${Math.floor(seconds / 60)}:${String(seconds % 60).padStart(2, '0')}`;
}
