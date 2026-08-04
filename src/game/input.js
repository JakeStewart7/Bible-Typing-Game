
export function handleInput(game, inputValue) {
  if (!game.startTime) game.startTime = Date.now();

  const chars = inputValue.split("");
  game.typed = [];
  game.errors = 0;

  for (let i = 0; i < chars.length; i++) {
    const expectedChar = game.chars[i];
    const typedChar = chars[i];

    if (typedChar === expectedChar) {
      game.typed.push(typedChar);
    } else {
      game.typed.push(typedChar);
      game.errors++;
    }
  }

  // Clamp typed array to text length
  if (game.typed.length > game.chars.length) {
    game.typed = game.typed.slice(0, game.chars.length);
  }
}
