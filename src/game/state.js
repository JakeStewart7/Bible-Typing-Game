function sanitizeText(raw) {
  // Remove line breaks, collapse any whitespace runs into a single space, and trim edges.
  return String(raw || "").replace(/\s+/g, " ").trim();
}

export function createGame(text) {
  const clean = sanitizeText(text);
  return {
    text: clean,
    chars: clean.split("") ,
    typed: [],
    errors: 0,
    startTime: null,
  };
}

export { sanitizeText };
