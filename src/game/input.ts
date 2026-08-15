import type { Game } from './state';

export function handleInput(game: Game, inputValue: string): void {
  if (!game.startTime) game.startTime = Date.now();

  const chars = inputValue.slice(0, game.chars.length).split('');
  game.typed = [];
  game.errors = 0;

  for (let i = 0; i < chars.length; i++) {
    const expectedChar = game.chars[i] ?? '';
    const typedChar = chars[i] ?? '';

    if (typedChar === expectedChar) {
      game.typed.push(typedChar);
    } else {
      game.typed.push(typedChar);
      game.errors++;
    }
  }
}
