async function tryFetch(q, translation) {
  const url = `https://bible-api.com/${q}?translation=${translation}`;
  const res = await fetch(url);
  if (!res.ok) throw new Error(`Bible API error: ${res.status}`);
  return res.json();
}

// Try requested translation, then sensible fallbacks if the API doesn't support it.
export async function fetchChapter(book, chapter, translation = "kjv") {
  const q = encodeURIComponent(`${book} ${chapter}`);
  const candidates = [translation, 'kjv', 'web'];
  let lastErr;
  for (const t of candidates) {
    try {
      const data = await tryFetch(q, t);
      data._translation = t;
      return data;
    } catch (err) {
      lastErr = err;
    }
  }
  throw lastErr || new Error('Failed to fetch chapter');
}

export async function fetchRange(book, chapter, start, end, translation = "kjv") {
  const q = encodeURIComponent(`${book} ${chapter}:${start}-${end}`);
  const candidates = [translation, 'kjv', 'web'];
  let lastErr;
  for (const t of candidates) {
    try {
      const data = await tryFetch(q, t);
      data._translation = t;
      return data;
    } catch (err) {
      lastErr = err;
    }
  }
  throw lastErr || new Error('Failed to fetch range');
}
