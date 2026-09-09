export type PageTheme = 'journey' | 'practice' | 'arcade' | 'multiplayer';

export function themeForWorkspace(workspace: string, selectedMode?: string): PageTheme {
  if (workspace === 'campaign' || workspace === 'campaign-play') return 'journey';
  if (workspace === 'multiplayer') return 'multiplayer';
  if (selectedMode === 'defense') return 'arcade';
  return 'practice';
}

export function applyPageTheme(root: HTMLElement, theme: PageTheme): void {
  root.dataset.theme = theme;
}
