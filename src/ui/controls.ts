import { fetchChapter } from '../bible-api';

export function initControls() {
  const app = document.getElementById('app') as HTMLElement;
  app.innerHTML = `
    <div class="controls">
      <div class="control-row">
        <label for="translation">Version</label>
        <select id="translation" class="select">
          <option value="esv">ESV</option>
          <option value="kjv">KJV</option>
          <option value="web">WEB</option>
          <option value="asv">ASV</option>
        </select>

        <label for="book">Book</label>
        <select id="book" class="select"></select>

        <label for="chapter">Chapter</label>
        <input id="chapter" type="number" min="1" value="1" class="number" />
      </div>

      <div class="control-row">
        <label for="start-verse">From</label>
        <select id="start-verse" class="select"></select>

        <label for="end-verse">To</label>
        <select id="end-verse" class="select"></select>

        <button id="load-passage" class="btn">Load Passage</button>
      </div>
    </div>

    <div class="game">
      <div class="game-header">
        <h1>Bible Typing Game</h1>
        <div id="hud" class="hud"></div>
      </div>

      <div id="text" class="text-display"></div>

      <div class="typed-area">
        <div id="typed-bar" class="typed-bar" aria-hidden="true"></div>
        <input id="input" autocomplete="off" class="hidden-input" aria-label="Typing input" />
      </div>
    </div>
  `;

  const hudEl = document.getElementById('hud') as HTMLElement;
  const textEl = document.getElementById('text') as HTMLElement;
  const inputEl = document.getElementById('input') as HTMLInputElement;
  const typedBarEl = document.getElementById('typed-bar') as HTMLElement;

  const translationEl = document.getElementById('translation') as HTMLSelectElement;
  const bookEl = document.getElementById('book') as HTMLSelectElement;
  const chapterEl = document.getElementById('chapter') as HTMLInputElement;
  const startVerseEl = document.getElementById('start-verse') as HTMLSelectElement;
  const endVerseEl = document.getElementById('end-verse') as HTMLSelectElement;
  const loadBtn = document.getElementById('load-passage') as HTMLButtonElement;

  const BOOKS = [
    "Genesis","Exodus","Leviticus","Numbers","Deuteronomy","Joshua","Judges","Ruth",
    "1 Samuel","2 Samuel","1 Kings","2 Kings","1 Chronicles","2 Chronicles","Ezra","Nehemiah","Esther",
    "Job","Psalms","Proverbs","Ecclesiastes","Song of Solomon","Isaiah","Jeremiah","Lamentations","Ezekiel","Daniel",
    "Hosea","Joel","Amos","Obadiah","Jonah","Micah","Nahum","Habakkuk","Zephaniah","Haggai","Zechariah","Malachi",
    "Matthew","Mark","Luke","John","Acts","Romans","1 Corinthians","2 Corinthians","Galatians","Ephesians","Philippians","Colossians",
    "1 Thessalonians","2 Thessalonians","1 Timothy","2 Timothy","Titus","Philemon","Hebrews","James","1 Peter","2 Peter","1 John","2 John","3 John","Jude","Revelation"
  ];

  function populateBooks() {
    BOOKS.forEach(b => {
      const opt = document.createElement('option');
      opt.value = b;
      opt.textContent = b;
      bookEl.appendChild(opt);
    });
  }

  async function populateVerses() {
    const book = bookEl.value;
    const chapter = parseInt(chapterEl.value, 10) || 1;
    const translation = translationEl.value;

    try {
      const data = await fetchChapter(book, chapter, translation as string);
      const verses = (data as any).verses || [];
      const count = verses.length || 0;
      startVerseEl.innerHTML = '';
      endVerseEl.innerHTML = '';
      for (let i = 1; i <= count; i++) {
        const s = document.createElement('option'); s.value = String(i); s.textContent = String(i); startVerseEl.appendChild(s);
        const e = document.createElement('option'); e.value = String(i); e.textContent = String(i); endVerseEl.appendChild(e);
      }
      endVerseEl.value = String(count || 1);
    } catch (err) {
      console.error(err);
      alert('Failed to load chapter verses from Bible API.');
    }
  }

  return {
    hudEl, textEl, inputEl, typedBarEl,
    translationEl, bookEl, chapterEl, startVerseEl, endVerseEl, loadBtn,
    populateBooks, populateVerses
  };
}
