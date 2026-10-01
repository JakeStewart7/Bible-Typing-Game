const THEMES = [
  { color: '#ff1726', bold: '#b00020', light: '#ffb3c9' },
  { color: '#00aeef', bold: '#006783', light: '#9ed7e6' },
  { color: '#ead500', bold: '#665500', light: '#f0e3a7' },
  { color: '#18b644', bold: '#0c6427', light: '#bdeb18' }
] as const;

export function playerTheme(color: string) {
  const theme = THEMES.find(candidate => candidate.color === color);
  if (!theme) throw new Error(`Unknown Stronghold player color: ${color}`);
  return theme;
}

export function playerCursor(color: string): string {
  const svg = `<svg xmlns="http://www.w3.org/2000/svg" width="24" height="30" viewBox="0 0 24 30"><path d="M3 2V23L9 18L14 28L19 25L14 16H22Z" fill="${playerTheme(color).bold}" stroke="white" stroke-width="2" stroke-linejoin="round"/></svg>`;
  return `url("data:image/svg+xml,${encodeURIComponent(svg)}") 3 2, auto`;
}

export function applyPlayerTheme(element: HTMLElement, color: string): void {
  const theme = playerTheme(color);
  for (const [name, value] of Object.entries({ '--player-color': theme.color, '--player-bold': theme.bold, '--player-fill': theme.light })) {
    if (element.style.getPropertyValue(name) !== value) element.style.setProperty(name, value);
  }
}
