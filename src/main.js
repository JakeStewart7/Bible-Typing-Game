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
    <input id="input" autocomplete="off" placeholder="Start typing the passage here..." />
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

    let text = (data.verses || []).map(v => v.text).join(' ');
    // Remove any hard line breaks and collapse excess whitespace so typing is predictable
    text = text.replace(/\s+/g, ' ').trim();

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

// ----------------------------
// Music: play a random track from assets/music
// ----------------------------
function setupMusic() {
  const tracks = [
    '/assets/music/determination.mp3',
    '/assets/music/apple_cider.ogg'
  ];

  // Choose a random track
  const choice = tracks[Math.floor(Math.random() * tracks.length)];
  const audio = new Audio(choice);
  audio.loop = true;
  audio.volume = 0.42;

  // Try autoplay; browsers may block it. If blocked, show a play button.
  audio.play().catch(() => {
    const btn = document.createElement('button');
    btn.id = 'music-play';
    btn.className = 'btn';
    btn.textContent = 'Play Music';
    btn.style.marginLeft = '8px';
    const header = document.querySelector('.game-header');
    if (header) {
      header.appendChild(btn);
    }
    btn.addEventListener('click', async () => {
      try {
        await audio.play();
        btn.remove();
      } catch (e) {
        console.error('Audio play failed', e);
      }
    });
  });
}

setupMusic();
