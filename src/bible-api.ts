export type BibleResponse = { verses?: Array<{ text: string; verse?: number }>; translation_name?: string; _translation?: string; _fallback?: boolean };

type StaticBible = {
  books: Array<{
    name: string;
    chapters: Array<{ chapter: number; verses: Array<{ verse: number; text: string }> }>;
  }>;
};

const SAMPLE_TRANSLATIONS: Record<string, Record<string, string[]>> = {
  esv: {
    'John 3': [
      'For God so loved the world, that he gave his only Son, that whoever believes in him should not perish but have eternal life.',
      'For God did not send his Son into the world to condemn the world, but in order that the world might be saved through him.'
    ]
  },
  niv: {
    'John 3': [
      'For God so loved the world that he gave his one and only Son, that whoever believes in him shall not perish but have eternal life.',
      'For God did not send his Son into the world to condemn the world, but to save the world through him.'
    ]
  }
};

export function getSampleVerseNumbers(book: string, chapter: number, translation: string) {
  const verses = SAMPLE_TRANSLATIONS[translation]?.[`${book} ${chapter}`];
  return verses ? verses.map((_, index) => index + 16) : [];
}

export function getSelectorMetadataTranslation(translation: string) {
  return translation === 'esv' || translation === 'niv' ? translation : 'web';
}

function getSample(book: string, chapter: number, start?: number, end?: number, translation?: string): BibleResponse | null {
  const verses = translation ? SAMPLE_TRANSLATIONS[translation]?.[`${book} ${chapter}`] : undefined;
  if (!verses || start !== undefined && (start < 16 || start > 17)) return null;
  const from = start ? start - 16 : 0;
  const to = end ? end - 15 : verses.length;
  return { verses: verses.slice(from, to).map((text, index) => ({ text, verse: (start || 16) + index })), _translation: translation };
}

async function tryFetch(q: string, translation: string): Promise<BibleResponse> {
  const url = `https://bible-api.com/${q}?translation=${translation}`;
  const res = await fetch(url);
  if (!res.ok) throw new Error(`Bible API error: ${res.status}`);
  return res.json();
}

const STATIC_BOOK_NAMES: Record<string, string> = {
  '1 Samuel':'I Samuel','2 Samuel':'II Samuel','1 Kings':'I Kings','2 Kings':'II Kings',
  '1 Chronicles':'I Chronicles','2 Chronicles':'II Chronicles','1 Corinthians':'I Corinthians',
  '2 Corinthians':'II Corinthians','1 Thessalonians':'I Thessalonians','2 Thessalonians':'II Thessalonians',
  '1 Timothy':'I Timothy','2 Timothy':'II Timothy','1 Peter':'I Peter','2 Peter':'II Peter',
  '1 John':'I John','2 John':'II John','3 John':'III John',Revelation:'Revelation of John'
};
const STATIC_BOOK_NAME_ALIASES: Record<string, string[]> = {
  '1 Samuel':['1 Samuel','I Samuel'],'2 Samuel':['2 Samuel','II Samuel'],
  '1 Kings':['1 Kings','I Kings'],'2 Kings':['2 Kings','II Kings'],
  '1 Chronicles':['1 Chronicles','I Chronicles'],'2 Chronicles':['2 Chronicles','II Chronicles'],
  '1 Corinthians':['1 Corinthians','I Corinthians'],'2 Corinthians':['2 Corinthians','II Corinthians'],
  '1 Thessalonians':['1 Thessalonians','I Thessalonians'],'2 Thessalonians':['2 Thessalonians','II Thessalonians'],
  '1 Timothy':['1 Timothy','I Timothy'],'2 Timothy':['2 Timothy','II Timothy'],
  '1 Peter':['1 Peter','I Peter'],'2 Peter':['2 Peter','II Peter'],
  '1 John':['1 John','I John'],'2 John':['2 John','II John'],'3 John':['3 John','III John'],
  Revelation:['Revelation','Revelation of John']
};
const staticBiblePromises = new Map<string, Promise<StaticBible>>();
const STATIC_TRANSLATIONS: Record<string, string> = {
  kjv: 'kjv.json',
  asv: 'asv.json'
};

async function loadStaticBible(translation: string) {
  const filename = STATIC_TRANSLATIONS[translation];
  if (!filename) throw new Error(`Offline translation not found: ${translation}`);
  if (!staticBiblePromises.has(translation)) {
    staticBiblePromises.set(translation, fetch(`${import.meta.env.BASE_URL}assets/${filename}`).then(async response => {
    if (!response.ok) throw new Error(`Static Bible error: ${response.status}`);
    return response.json() as Promise<StaticBible>;
    }));
  }
  return staticBiblePromises.get(translation)!;
}

async function getStaticPassage(book: string, chapter: number, translation: string, start?: number, end?: number): Promise<BibleResponse> {
  const bible = await loadStaticBible(translation);
  const aliases = STATIC_BOOK_NAME_ALIASES[book] || [STATIC_BOOK_NAMES[book] || book];
  const staticBook = bible.books.find(item => aliases.includes(item.name));
  const staticChapter = staticBook?.chapters.find(item => Number(item.chapter) === chapter);
  if (!staticChapter) throw new Error(`Static passage not found: ${book} ${chapter}`);
  const verses = start === undefined
    ? staticChapter.verses
    : staticChapter.verses.filter(verse => verse.verse >= start && verse.verse <= (end ?? start));
  return { verses, _translation: translation, _fallback: false };
}

export async function fetchChapter(book: string, chapter: number, translation = 'kjv', allowFallback = true) {
  const sample = getSample(book, chapter, undefined, undefined, translation);
  if (sample) return sample;
  if (translation in STATIC_TRANSLATIONS) return getStaticPassage(book, chapter, translation);
  const q = encodeURIComponent(`${book} ${chapter}`);
  const candidates = allowFallback ? [...new Set([translation, 'kjv', 'web'])] : [translation];
  let lastErr: any;
  for (const t of candidates) {
    try {
      const data = await tryFetch(q, t);
      data._translation = t;
      data._fallback = t !== translation;
      return data;
    } catch (err) {
      lastErr = err;
    }
  }
  throw lastErr || new Error('Failed to fetch chapter');
}

export async function fetchRange(book: string, chapter: number, start: number, end: number, translation = 'kjv', allowFallback = true) {
  const sample = getSample(book, chapter, start, end, translation);
  if (sample) return sample;
  if (translation in STATIC_TRANSLATIONS) return getStaticPassage(book, chapter, translation, start, end);
  const q = encodeURIComponent(`${book} ${chapter}:${start}-${end}`);
  const candidates = allowFallback ? [...new Set([translation, 'kjv', 'web'])] : [translation];
  let lastErr: any;
  for (const t of candidates) {
    try {
      const data = await tryFetch(q, t);
      data._translation = t;
      data._fallback = t !== translation;
      return data;
    } catch (err) {
      lastErr = err;
    }
  }
  throw lastErr || new Error('Failed to fetch range');
}
