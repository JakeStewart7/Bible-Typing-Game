function sanitizeText(raw) {
  let s = String(raw || "");
  // Normalize compatibility, decompose combined characters
  s = s.normalize('NFKC');

  // Replace smart apostrophes/quotes with ASCII equivalents
  s = s.replace(/[\u2018\u2019\u201A\u201B\u2032\u2035]/g, "'");
  s = s.replace(/[\u201C\u201D\u201E\u201F\u2033\u2036]/g, '"');

  // Replace dashes and ellipses
  s = s.replace(/[\u2013\u2014\u2015]/g, '-');
  s = s.replace(/\u2026/g, '...');

  // Normalize spaces
  s = s.replace(/\u00A0/g, ' ');
  s = s.replace(/\s+/g, ' ').trim();
  // Remove diacritics (turn accented letters into base latin letters)
  try {    s = s.normalize('NFKD').replace(/\p{M}/gu, '');  } catch (e) {    // If the environment doesn't support Unicode property escapes, skip this step    // (rare in modern browsers)  }
  // Strip control characters  s = s.replace(/[\u0000-\u001F\u007F]/g, '');
  return s;
}

export function createGame(text) {
  const clean = sanitizeText(text);
  return {
    text: clean,
    chars: clean.split(""),
    typed: [],
    errors: 0,
    startTime: null,
  };
}

export { sanitizeText };
