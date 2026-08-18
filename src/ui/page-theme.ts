export type PageTheme = 'journey' | 'practice' | 'memory' | 'arcade';

export function themeForWorkspace(workspace: string, selectedMode?: string): PageTheme {
  if (workspace === 'campaign' || workspace === 'campaign-play') return 'journey';
  if (selectedMode === 'memory') return 'memory';
  if (selectedMode === 'defense') return 'arcade';
  return 'practice';
}

export function applyPageTheme(root: HTMLElement, theme: PageTheme): void {
  root.dataset.theme = theme;
}
