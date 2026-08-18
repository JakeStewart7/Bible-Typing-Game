import { BOOKS } from './bible-data';
import { fetchRange } from './bible-api';
import {
  createCampaignChunks,
  getBookProgress,
  getCampaignProgress
} from './campaign';
import type { CampaignChunk, CampaignProgress } from './campaign';
import type { AppStateRepository } from './persistence/app-state';
import type { AppConfig } from './config';

export type CampaignView = {
  contentEl: HTMLElement;
  backEl: HTMLButtonElement;
  breadcrumbEl: HTMLElement;
  totalStarsEl: HTMLElement;
  totalProgressEl: HTMLElement;
  devToolsEl: HTMLElement;
  sidebarProgressEl: HTMLElement;
  celebrationEl: HTMLElement;
};

export function createCampaignController(
  view: CampaignView,
  onStartChunk: (chunk: CampaignChunk, text: string) => void,
  stateRepository: AppStateRepository,
  config: AppConfig
) {
  let selectedBook: string | null = null;
  let progress = stateRepository.readCampaignProgress();

  function renderSummary(): void {
    const summary = getCampaignProgress(progress);
    view.totalStarsEl.textContent = `${summary.stars} ★`;
    view.totalProgressEl.textContent = `${summary.completed} of ${summary.total} passages`;
    view.sidebarProgressEl.innerHTML = `${summary.completedChapters} / 1,189 chapters<br>${summary.completedBooks} / 66 books`;
  }

  function renderBooks(): void {
    selectedBook = null;
    view.backEl.classList.add('is-hidden');
    view.breadcrumbEl.textContent = '66 books · 1,189 chapters';
    view.contentEl.className = 'campaign-content book-grid';
    view.contentEl.replaceChildren(...BOOKS.map(book => {
      const summary = getBookProgress(book, progress);
      const button = document.createElement('button');
      button.className = `book-tile${summary.percent === 100 ? ' complete' : ''}`;
      button.innerHTML = `
        <span class="book-order">${String(BOOKS.indexOf(book) + 1).padStart(2, '0')}</span>
        <strong>${book}</strong>
        <span>${summary.completed}/${summary.total} passages · ${summary.stars} ★</span>
        <i><b style="width:${summary.percent}%"></b></i>`;
      button.addEventListener('click', () => renderBook(book));
      return button;
    }));
    renderSummary();
  }

  function renderBook(book: string): void {
    selectedBook = book;
    view.backEl.classList.remove('is-hidden');
    const summary = getBookProgress(book, progress);
    view.breadcrumbEl.textContent = `${book} · ${summary.percent}% complete · ${summary.stars} stars`;
    view.contentEl.className = 'campaign-content chapter-list';
    const chunks = createCampaignChunks(book);
    const chapters = [...new Set(chunks.map(chunk => chunk.chapter))];
    view.contentEl.replaceChildren(...chapters.map(chapter => {
      const chapterChunks = chunks.filter(chunk => chunk.chapter === chapter);
      const section = document.createElement('section');
      section.className = 'campaign-chapter';
      const completed = chapterChunks.filter(chunk => (progress[chunk.id] ?? 0) > 0).length;
      section.innerHTML = `<header><div><small>CHAPTER</small><strong>${chapter}</strong></div><span>${completed}/${chapterChunks.length} complete</span></header>`;
      const chunkGrid = document.createElement('div');
      chunkGrid.className = 'passage-grid';
      for (const chunk of chapterChunks) {
        const stars = progress[chunk.id] ?? 0;
        const button = document.createElement('button');
        button.className = stars ? 'passage-tile complete' : 'passage-tile';
        const passageLabel = chunk.startVerse === chunk.endVerse
          ? `Verse ${chunk.startVerse}`
          : `Verses ${chunk.startVerse}–${chunk.endVerse}`;
        button.innerHTML = `<strong>${passageLabel}</strong><span>${'★'.repeat(stars)}${'☆'.repeat(5 - stars)}</span>`;
        button.addEventListener('click', () => void startChunk(chunk, button));
        chunkGrid.appendChild(button);
      }
      section.appendChild(chunkGrid);
      return section;
    }));
    renderSummary();
  }

  async function startChunk(chunk: CampaignChunk, button: HTMLButtonElement): Promise<void> {
    button.disabled = true;
    view.breadcrumbEl.textContent = `Loading ${chunk.book} ${chunk.chapter}:${chunk.startVerse}–${chunk.endVerse}…`;
    try {
      const data = await fetchRange(chunk.book, chunk.chapter, chunk.startVerse, chunk.endVerse, 'kjv', false);
      const text = data.verses?.map(verse => verse.text).join(' ') ?? '';
      if (!text) throw new Error('Campaign passage was empty.');
      onStartChunk(chunk, text);
    } finally {
      button.disabled = false;
    }
  }

  function saveChunk(chunk: CampaignChunk, stars: number): void {
    progress[chunk.id] = Math.max(progress[chunk.id] ?? 0, stars);
    stateRepository.writeCampaignProgress(progress);
    renderSummary();
  }

  function celebrateBook(book: string): void {
    const count = createCampaignChunks(book).length;
    const pieces = Math.min(180, Math.max(30, count));
    view.celebrationEl.innerHTML = `<strong>${book} complete!</strong>${Array.from({ length: pieces }, (_, index) =>
      `<i style="--x:${(index * 47) % 100}%;--delay:${(index % 18) * 40}ms;--hue:${(index * 31) % 360}"></i>`).join('')}`;
    view.celebrationEl.classList.remove('is-hidden');
    window.setTimeout(() => view.celebrationEl.classList.add('is-hidden'), 4000);
  }

  function applyDeveloperAction(action: string): void {
    const books = selectedBook ? [selectedBook] : [...BOOKS];
    if (action === 'reset-all') progress = {};
    else for (const book of books) {
      for (const chunk of createCampaignChunks(book)) {
        if (action === 'complete-book' || action === 'complete-all') progress[chunk.id] = 5;
        if (action === 'reset-book') delete progress[chunk.id];
      }
    }
    stateRepository.writeCampaignProgress(progress);
    selectedBook ? renderBook(selectedBook) : renderBooks();
  }

  view.backEl.addEventListener('click', renderBooks);
  if (config.isDevelopment) {
    document.getElementById('dev-tools-toggle')?.addEventListener('click', () => view.devToolsEl.classList.toggle('is-hidden'));
    view.devToolsEl.querySelectorAll<HTMLButtonElement>('[data-dev-action]').forEach(button => {
      button.addEventListener('click', () => applyDeveloperAction(button.dataset.devAction ?? ''));
    });
  }
  renderBooks();
  return { renderBooks, renderBook, saveChunk, celebrateBook, getProgress: () => progress };
}
