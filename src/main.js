import "./styles/main.css";
import { createGame, sanitizeText } from "./game/state.js";
import { handleInput } from "./game/input.js";
import { renderText } from "./ui/renderer.js";
import { renderStats } from "./ui/hud.js";
import { calculateStats } from "./game/stats.js";
import { fetchChapter, fetchRange } from "./bible-api.js";
import trackDetermination from "../assets/music/determination.mp3";
import trackApple from "../assets/music/apple_cider.ogg";

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

    <div class="typed-area">
      <div id="typed-bar" class="typed-bar" aria-hidden="true"></div>
      <input id="input" autocomplete="off" class="hidden-input" aria-label="Typing input" />
    </div>
  </div>
`;

const hudEl = document.getElementById("hud");
const textEl = document.getElementById("text");
const inputEl = document.getElementById("input");
const typedBarEl = document.getElementById("typed-bar");

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
// Keep the hidden input focused so keyboard events go there. Clicking anywhere focuses it.
document.addEventListener('click', () => inputEl.focus());
inputEl.focus();

inputEl.addEventListener("input", () => {
  const prevLen = game.typed.length;
  handleInput(game, inputEl.value);

  // If the user added a character, mark it for the pressed animation
  if (game.typed.length > prevLen) {
    game.lastPressedIndex = game.typed.length - 1;
    // clear after animation so it can re-apply on next press
    setTimeout(() => { game.lastPressedIndex = undefined; }, 260);
  }

  // Update rendered passage and typed-bar
  renderText(textEl, game);
  renderTypedBar(typedBarEl, game);

  // Keep the hidden input value in sync (but not shown)
  inputEl.value = game.typed.join("");

  // Disable input only if everything is correct
  const allCorrect = game.typed.join("") === game.chars.join("");
  inputEl.disabled = allCorrect;
});

// helper to render the typed bar (mirrors game.typed but styled)
function escapeHtml(s) { return s.replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;'); }
function renderTypedBar(container, game) {
  if (!container) return;
  container.innerHTML = '';
  const typed = game.typed.join('');
  const expected = game.chars.join('');
  const words = typed.split(' ');
  let pos = 0;
  for (let wi = 0; wi < words.length; wi++) {
    const w = words[wi];
    const span = document.createElement('span');
    span.className = 'typed-word';
    const expectedSlice = expected.slice(pos, pos + w.length);
    const isCorrect = w === expectedSlice;
n    // Completed words (not the current last word)
    if (wi < words.length - 1) {
      span.classList.add('completed');
      span.textContent = w + ' ';
    } else {
      // Current word in-progress
      if (w.length === 0) {
        // If current word is empty (user just typed space), show a small space marker
        span.classList.add('current');
        span.textContent = ' ';
      } else {
        span.classList.add('current');
        if (!isCorrect) span.classList.add('incorrect');
        span.textContent = w;
      }
    }

    container.appendChild(span);
    pos += w.length + 1; // +1 for space
  }

  // If nothing typed yet, show placeholder hint
  if (typed.length === 0) {
    const hint = document.createElement('div');
    hint.className = 'typed-hint';
    hint.textContent = 'Type here...';
    container.appendChild(hint);
  }
}

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
    // Sanitize text to remove untypable or problematic characters
    text = sanitizeText(text);

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
// Music: play a random track from assets/music (imported so Vite bundles them)
// ----------------------------
function setupMusic() {
  const tracks = [trackDetermination, trackApple];
  const choice = tracks[Math.floor(Math.random() * tracks.length)];

  const audio = new Audio();
  audio.src = choice;
  audio.loop = true;
  const targetVolume = 0.42;
  audio.volume = 0; // start muted for fade-in
  audio.preload = 'auto';
  audio.crossOrigin = 'anonymous';

  function fadeIn(a, target = targetVolume, duration = 2000) {
    const start = performance.now();
    function step(now) {
      const t = Math.min(1, (now - start) / duration);
      a.volume = t * target;
      if (t < 1) requestAnimationFrame(step);
    }
    requestAnimationFrame(step);
  }

  // Create persistent controls in the header
  const header = document.querySelector('.game-header');
  if (!header) return;

  const controls = document.createElement('div');
  controls.className = 'music-controls';

  const playBtn = document.createElement('button');
  playBtn.className = 'btn music-btn';
  playBtn.textContent = 'Play Music';
  controls.appendChild(playBtn);

  const vol = document.createElement('input');
  vol.type = 'range';
  vol.min = 0; vol.max = 1; vol.step = 0.01; vol.value = String(audio.volume);
  vol.className = 'volume-slider';
  controls.appendChild(vol);

  header.appendChild(controls);

  // Toggle play/pause
  async function playAudio() {
    try {
      await audio.play();
      fadeIn(audio);
      playBtn.textContent = 'Pause Music';
    } catch (e) {
      console.warn('Autoplay prevented; user interaction required.');
      playBtn.textContent = 'Play Music';
    }
  }

  function pauseAudio() {
    audio.pause();
    playBtn.textContent = 'Play Music';
  }

  playBtn.addEventListener('click', async () => {
    if (audio.paused) {
      await playAudio();
    } else {
      pauseAudio();
    }
  });

  vol.addEventListener('input', () => {
    audio.volume = Number(vol.value);
  });

  // Try autoplay once; if allowed, update button state and fade in
  audio.play().then(() => {
    fadeIn(audio);
    playBtn.textContent = 'Pause Music';
  }).catch(() => {
    playBtn.textContent = 'Play Music';
  });
}

setupMusic();
