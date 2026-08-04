export async function fetchChapter(book, chapter, translation = "kjv") {
  const q = encodeURIComponent(`${book} ${chapter}`);
  const url = `https://bible-api.com/${q}?translation=${translation}`;
  const res = await fetch(url);
  if (!res.ok) throw new Error(`Bible API error: ${res.status}`);
  return res.json();
}

export async function fetchRange(book, chapter, start, end, translation = "kjv") {
  const q = encodeURIComponent(`${book} ${chapter}:${start}-${end}`);
  const url = `https://bible-api.com/${q}?translation=${translation}`;
  const res = await fetch(url);
  if (!res.ok) throw new Error(`Bible API error: ${res.status}`);
  return res.json();
}
