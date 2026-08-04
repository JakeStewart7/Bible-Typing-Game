async function tryFetch(q: string, translation: string) {
  const url = `https://bible-api.com/${q}?translation=${translation}`;
  const res = await fetch(url);
  if (!res.ok) throw new Error(`Bible API error: ${res.status}`);
  return res.json();
}

export async function fetchChapter(book: string, chapter: number, translation = 'kjv') {
  const q = encodeURIComponent(`${book} ${chapter}`);
  const candidates = [translation, 'kjv', 'web'];
  let lastErr: any;
  for (const t of candidates) {
    try {
      const data = await tryFetch(q, t);
      (data as any)._translation = t;
      return data;
    } catch (err) {
      lastErr = err;
    }
  }
  throw lastErr || new Error('Failed to fetch chapter');
}

export async function fetchRange(book: string, chapter: number, start: number, end: number, translation = 'kjv') {
  const q = encodeURIComponent(`${book} ${chapter}:${start}-${end}`);
  const candidates = [translation, 'kjv', 'web'];
  let lastErr: any;
  for (const t of candidates) {
    try {
      const data = await tryFetch(q, t);
      (data as any)._translation = t;
      return data;
    } catch (err) {
      lastErr = err;
    }
  }
  throw lastErr || new Error('Failed to fetch range');
}
