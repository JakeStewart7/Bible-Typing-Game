import type { Game } from './state';

export function handleInput(game: Game, inputValue: string): void {
  if (!game.startTime) game.startTime = Date.now();

  const chars = inputValue.slice(0, game.chars.length).split('');
  if (game.blockedAccuracyIndex !== null) {
    const index = game.blockedAccuracyIndex;
    if (chars[index] === game.chars[index]) {
      game.blockedAccuracyIndex = null;
      game.accuracyCursor = index + 1;
    }
  }

  while (game.blockedAccuracyIndex === null && game.accuracyCursor < chars.length) {
    const index = game.accuracyCursor;
    const correct = chars[index] === game.chars[index];
    game.attempted[index] = true;
    game.firstAttemptCorrect[index] = correct;
    game.accuracyTotal++;
    if (correct) {
      game.accuracyCorrect++;
      game.accuracyCursor++;
    } else {
      game.blockedAccuracyIndex = index;
    }
  }

  game.typed = chars;
  game.errors = game.accuracyTotal - game.accuracyCorrect;
}
