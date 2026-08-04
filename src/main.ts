import './styles/main.css';
import { createGame, sanitizeText, Game } from './game/state';
import { handleInput } from './game/input';
import { renderText } from './ui/renderer';
import { renderStats } from './ui/hud';
import { calculateStats } from './game/stats';
import { fetchChapter, fetchRange } from './bible-api';

import trackDetermination from '../assets/music/determination.mp3';
import trackApple from '../assets/music/apple_cider.ogg';

// ----------------------------
// DOM setup
// ----------------------------
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

// ----------------------------
// Game state
// ----------------------------
export const game: Game = createGame('Typing games help improve speed and accuracy through practice and focus.');

// ----------------------------
// Restart
// ----------------------------
export function restartGame() {
  game.typed = [];
  game.errors = 0;
  game.startTime = null;

  inputEl.value = '';
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

inputEl.addEventListener('input', () => {
  const prevLen = game.typed.length;
  handleInput(game, inputEl.value);

  if (game.typed.length > prevLen) {
    game.lastPressedIndex = game.typed.length - 1;
    setTimeout(() => { game.lastPressedIndex = undefined; }, 260);
  }

  renderText(textEl, game);
  renderTypedBar(typedBarEl, game);

  inputEl.value = game.typed.join('');

  const allCorrect = game.typed.join('') === game.chars.join('');
  inputEl.disabled = allCorrect;
});

function renderTypedBar(container: HTMLElement, game: Game) {
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

    if (wi < words.length - 1) {
      span.classList.add('completed');
      span.textContent = w + ' ';
    } else {
      if (w.length === 0) {
        span.classList.add('current');
        span.textContent = ' ';
      } else {
        span.classList.add('current');
        if (!isCorrect) span.classList.add('incorrect');
        span.textContent = w;
      }
    }

    container.appendChild(span);
    pos += w.length + 1;
  }

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
let hudInterval: any;

export function startHUDUpdates() {
  clearInterval(hudInterval);
  hudInterval = setInterval(() => {
    renderStats(hudEl, calculateStats(game), restartGame);

    if (game.typed.join('') === game.chars.join('')) {
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
    let data: any;
    try {
      data = await fetchRange(book, chapter, start, end, translation as string);
    } catch (e) {
      const chap = await fetchChapter(book, chapter, translation as string);
      const verses = (chap as any).verses || [];
      const sliced = verses.slice(start - 1, end);
      data = { verses: sliced };
    }

    let text = (data.verses || []).map((v: any) => v.text).join(' ');
    text = sanitizeText(text);

    if (!text) {
      alert('No verses returned for that range.');
      return;
    }

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
chapterEl.value = '3';
populateVerses();
translationEl.addEventListener('change', populateVerses);
bookEl.addEventListener('change', populateVerses);
chapterEl.addEventListener('change', populateVerses);

renderText(textEl, game);
renderStats(hudEl, calculateStats(game), restartGame);
startHUDUpdates();

// Auto-focus
// already listening for clicks earlier

// ----------------------------
// Music: play a random track from assets/music (imported so Vite bundles them)
// ----------------------------
function setupMusic() {
  const tracks = [trackDetermination, trackApple];
  const choice = tracks[Math.floor(Math.random() * tracks.length)];

  const audio = new Audio();
  audio.src = choice as unknown as string;
  audio.loop = true;
  const targetVolume = 0.42;
  audio.volume = 0;
  audio.preload = 'auto';
  audio.crossOrigin = 'anonymous';

  function fadeIn(a: HTMLAudioElement, target = targetVolume, duration = 2000) {
    const start = performance.now();
    function step(now: number) {
      const t = Math.min(1, (now - start) / duration);
      a.volume = t * target;
      if (t < 1) requestAnimationFrame(step);
    }
    requestAnimationFrame(step);
  }

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
  vol.min = '0'; vol.max = '1'; vol.step = '0.01'; vol.value = String(audio.volume);
  vol.className = 'volume-slider';
  controls.appendChild(vol);

  header.appendChild(controls);

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

  audio.play().then(() => {
    fadeIn(audio);
    playBtn.textContent = 'Pause Music';
  }).catch(() => {
    playBtn.textContent = 'Play Music';
  });
}

setupMusic();
