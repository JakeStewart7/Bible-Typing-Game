export interface Game {
  text: string;
  chars: string[];
  typed: string[];
  errors: number;
  startTime: number | null;
  lastPressedIndex?: number;
  completedAt?: number;
}

export function sanitizeText(raw: unknown): string {
  let s = String(raw || "");
  s = s.normalize('NFKC');
  s = s.replace(/[\u2018\u2019\u201A\u201B\u2032\u2035]/g, "'");
  s = s.replace(/[\u201C\u201D\u201E\u201F\u2033\u2036]/g, '"');
  s = s.replace(/[\u2013\u2014\u2015]/g, '-');
  s = s.replace(/\u2026/g, '...');
  s = s.replace(/\u00A0/g, ' ');
  s = s.replace(/\s+/g, ' ').trim();
  try {
    s = s.normalize('NFKD').replace(/\p{M}/gu, '');
  } catch (e) {
    // ignore
  }
  s = s.replace(/[\u0000-\u001F\u007F]/g, '');
  return s;
}

export function createGame(text: unknown): Game {
  const clean = sanitizeText(text);
  return {
    text: clean,
    chars: clean.split(''),
    typed: [],
    errors: 0,
    startTime: null,
    completedAt: undefined,
  };
}
