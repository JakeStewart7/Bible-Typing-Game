import { Game } from './state';
import { handleInput } from './input';
import { renderText } from '../ui/renderer';
import { renderTypedBar } from '../ui/typedBar';
import { renderStats } from '../ui/hud';
import { calculateStats } from './stats';
import { fetchChapter, fetchRange } from '../bible-api';
import { sanitizeText } from './state';

type Controls = {
  hudEl: HTMLElement;
  textEl: HTMLElement;
  inputEl: HTMLInputElement;
  typedBarEl: HTMLElement;
  translationEl: HTMLSelectElement;
  bookEl: HTMLSelectElement;
  chapterEl: HTMLInputElement;
  startVerseEl: HTMLSelectElement;
  endVerseEl: HTMLSelectElement;
  loadBtn: HTMLButtonElement;
  populateBooks: () => void;
  populateVerses: () => Promise<void>;
};

export function initGameControllers(game: Game, controls: Controls) {
  const {
    hudEl, textEl, inputEl, typedBarEl,
    translationEl, bookEl, chapterEl, startVerseEl, endVerseEl, loadBtn,
    populateBooks, populateVerses
  } = controls;

  // Restart the current game state and re-render UI
  function restartGame() {
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

  // HUD live updates
  let hudInterval: any;
  function startHUDUpdates() {
    clearInterval(hudInterval);
    hudInterval = setInterval(() => {
      renderStats(hudEl, calculateStats(game), restartGame);

      if (game.typed.join('') === game.chars.join('')) {
        clearInterval(hudInterval);
      }
    }, 100);
  }

  // Input handling wiring
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

  // Load passage handler
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

  // Initial render and wiring
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

  return { restartGame, startHUDUpdates };
}
