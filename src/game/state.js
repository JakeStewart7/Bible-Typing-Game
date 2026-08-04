export function createGame(text) {
  return {
    text,
    chars: text.split(""),
    typed: [],
    errors: 0,
    startTime: null,
  };
}
