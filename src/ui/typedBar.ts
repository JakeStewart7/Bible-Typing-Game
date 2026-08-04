import { Game } from '../game/state';

export function renderTypedBar(container: HTMLElement, game: Game) {
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
