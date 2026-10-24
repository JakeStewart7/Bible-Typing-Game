const THEMES = [
  { color: '#ff1726', bold: '#b00020', light: '#ffb3c9', text: '#711e2b' },
  { color: '#00aeef', bold: '#006783', light: '#9ed7e6', text: '#1d4c5a' },
  { color: '#ead500', bold: '#665500', light: '#f0e3a7', text: '#514617' },
  { color: '#18b644', bold: '#0c6427', light: '#bdeb18', text: '#245032' }
] as const;

export const PLAYER_CURSOR_SHAPE = '<path d="M3 2V23L9 18L14 28L19 25L14 16H22Z" fill="none" stroke="currentColor" stroke-width="2" stroke-linejoin="round"/>';

export function playerTheme(color: string) {
  const theme = THEMES.find(candidate => candidate.color === color);
  if (!theme) throw new Error(`Unknown Stronghold player color: ${color}`);
  return theme;
}

export function playerCursorImage(color: string, placing = false): string {
  const bold = playerTheme(color).bold;
  const badge = placing ? `<rect x="17" y="17" width="13" height="13" rx="2" fill="white" stroke="${bold}" stroke-width="2"/><path d="M20 23.5h7m-3.5-3.5v7" fill="none" stroke="${bold}" stroke-width="2"/>` : '';
  const svg = `<svg xmlns="http://www.w3.org/2000/svg" width="${placing ? 32 : 24}" height="${placing ? 34 : 30}" viewBox="0 0 ${placing ? '32 34' : '24 30'}" color="${bold}">${PLAYER_CURSOR_SHAPE}${badge}</svg>`;
  return `data:image/svg+xml,${encodeURIComponent(svg)}`;
}

export function playerCursor(color: string, placing = false): string {
  return `url("${playerCursorImage(color, placing)}") 3 2, default`;
}

export function applyPlayerTheme(element: HTMLElement, color: string): void {
  const theme = playerTheme(color);
  for (const [name, value] of Object.entries({
    '--player-color': theme.color, '--player-bold': theme.bold, '--player-fill': theme.light, '--player-text': theme.text
  })) {
    if (element.style.getPropertyValue(name) !== value) element.style.setProperty(name, value);
  }
}
