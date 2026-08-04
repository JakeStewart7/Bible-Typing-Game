import "./styles/main.css";
import { createGame } from "./game/state.js";
import { handleInput } from "./game/input.js";
import { renderText } from "./ui/renderer.js";
import { renderStats } from "./ui/hud.js";
import { calculateStats } from "./game/stats.js";
import { fetchChapter, fetchRange } from "./bible-api.js";

// ----------------------------
// DOM setup
// ----------------------------
const app = document.getElementById("app");
app.innerHTML = `
  <div class="controls">
    <select id="translation">
      <option value="kjv">KJV</option>
      <option value="web">WEB</option>
    </select>

    <select id="book"></select>
    <input id="chapter" type="number" min="1" value="1" />
    <select id="start-verse"></select>
    <select id="end-verse"></select>
    <button id="load-passage">Load Passage</button>
  </div>

  <div class="game">
    <div id="hud" class="hud"></div>
    <div id="text" class="text-display"></div>
    <input id="input" autocomplete="off" />
  </div>
`;

const hudEl = document.getElementById("hud");
const textEl = document.getElementById("text");
const inputEl = document.getElementById("input");

const translationEl = document.getElementById("translation");
const bookEl = document.getElementById("book");
const chapterEl = document.getElementById("chapter");
const startVerseEl = document.getElementById("start-verse");
const endVerseEl = document.getElementById("end-verse");
const loadBtn = document.getElementById("load-passage");

// ----------------------------
// Books list (66 canonical books)
// ----------------------------
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
    const data = await fetchChapter(book, chapter, translation);
    const verses = data.verses || [];
    const count = verses.length || 0;
    startVerseEl.innerHTML = '';
    endVerseEl.innerHTML = '';
    for (let i = 1; i <= count; i++) {
      const s = document.createElement('option'); s.value = i; s.textContent = i; startVerseEl.appendChild(s);
      const e = document.createElement('option'); e.value = i; e.textContent = i; endVerseEl.appendChild(e);
    }
    // Ensure end >= start by default
    endVerseEl.value = count || 1;
  } catch (err) {
    console.error(err);
    alert('Failed to load chapter verses from Bible API.');
  }
}

// ----------------------------
// Game state
// ----------------------------
export const game = createGame(
  "Typing games help improve speed and accuracy through practice and focus."
);

// ----------------------------
// Restart
// ----------------------------
export function restartGame() {
  game.typed = [];
  game.errors = 0;
  game.startTime = null;

  inputEl.value = "";
  inputEl.disabled = false;

  renderText(textEl, game);
  renderStats(hudEl, calculateStats(game), restartGame);

  startHUDUpdates();
  inputEl.focus();
}

// ----------------------------
// Input handling
// ----------------------------
inputEl.addEventListener("input", () => {
  handleInput(game, inputEl.value);
  renderText(textEl, game);

  // Always reflect typed letters
  inputEl.value = game.typed.join("");

  // Disable input only if everything is correct
  const allCorrect = game.typed.join("") === game.chars.join("");
  inputEl.disabled = allCorrect;
});

// ----------------------------
// HUD live updates
// ----------------------------
let hudInterval;

export function startHUDUpdates() {
  clearInterval(hudInterval);
  hudInterval = setInterval(() => {
    renderStats(hudEl, calculateStats(game), restartGame);

    if (game.typed.join("") === game.chars.join("")) {
      clearInterval(hudInterval);
    }
  }, 100);
}

// ----------------------------
// Load passage and wire UI
// ----------------------------
loadBtn.addEventListener('click', async () => {
  const book = bookEl.value;
  const chapter = parseInt(chapterEl.value, 10) || 1;
  const start = parseInt(startVerseEl.value, 10) || 1;
  const end = parseInt(endVerseEl.value, 10) || start;
  const translation = translationEl.value;

  try {
    let data;
    try {
      data = await fetchRange(book, chapter, start, end, translation);
    } catch (e) {
      // fallback: fetch whole chapter and slice
      const chap = await fetchChapter(book, chapter, translation);
      const verses = chap.verses || [];
      const sliced = verses.slice(start - 1, end);
      data = { verses: sliced };
    }

    const text = (data.verses || []).map(v => v.text).join(' ');
    if (!text) {
      alert('No verses returned for that range.');
      return;
    }

    // Update game text and restart
    game.text = text;
    game.chars = text.split('');
    restartGame();
  } catch (err) {
    console.error(err);
    alert('Failed to load passage. See console for details.');
  }
});

// ----------------------------
// Initial render and wiring
// ----------------------------
populateBooks();
bookEl.value = 'John';
chapterEl.value = 3;
populateVerses();
translationEl.addEventListener('change', populateVerses);
bookEl.addEventListener('change', populateVerses);
chapterEl.addEventListener('change', populateVerses);

renderText(textEl, game);
renderStats(hudEl, calculateStats(game), restartGame);
startHUDUpdates();

// Auto-focus
document.addEventListener("click", () => inputEl.focus());
inputEl.focus();
