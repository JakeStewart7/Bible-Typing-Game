import { seasonalTrack, type MusicTrack } from './catalog.ts';
import type { Season } from '../domain/types.ts';
import { browserFrameClock, createFrameScheduler, type FrameClock } from '../../shared/frame-scheduler.ts';

export interface MusicAudio {
  src: string; volume: number; loop: boolean; preload: string; paused: boolean;
  play(): Promise<void>;
  pause(): void;
  load(): void;
  removeAttribute(name: string): void;
  addEventListener(type: string, listener: EventListener): void;
  removeEventListener(type: string, listener: EventListener): void;
}
export type MusicStatus = { enabled: boolean; playing: boolean; track: MusicTrack | null; message: string };

export const MUSIC_START_DELAY_MS = 3000;
export const MUSIC_FADE_MS = 750;

export function createSeasonalMusic(audio: MusicAudio, report: (status: MusicStatus) => void, clock: FrameClock = browserFrameClock) {
  audio.preload = 'none';
  audio.loop = true;
  audio.volume = 0;
  let volume = .18;
  let track: MusicTrack | null = null;
  let active = false, enabled = true, starting = false, disposed = false;
  let revision = 0, message = '', lastReport = '';
  let began = false;
  let delayUntil: number | null = null;
  let fade: { from: number; to: number; start: number } | null = null;
  const frames = createFrameScheduler(time => {
    if (fade) {
      const progress = Math.min(1, Math.max(0, (time - fade.start) / MUSIC_FADE_MS));
      audio.volume = progress === 1 ? fade.to : fade.from + (fade.to - fade.from) * progress;
      if (progress === 1) fade = null;
    }
    sync();
  }, clock);
  function fadeTo(to: number): void {
    if (fade?.to !== to) fade = audio.volume === to ? null : { from: audio.volume, to, start: clock.now() };
    if (fade) frames.schedule();
  }
  function emit(): void {
    if (disposed) return;
    const status = { enabled, playing: !audio.paused, track, message };
    const key = JSON.stringify(status);
    if (key !== lastReport) { lastReport = key; report(status); }
  }
  function failure(text: string): void {
    enabled = false; revision++; message = text;
    frames.cancel(); fade = null; delayUntil = null; audio.volume = 0;
    audio.pause(); emit();
  }
  function sync(): void {
    if (disposed) return;
    const wanted = active && enabled && track;
    if (starting) {
      if (!wanted || audio.src !== track?.url) { audio.volume = 0; audio.pause(); }
      return;
    }
    if (!wanted || audio.src !== track?.url) {
      if (!audio.paused && audio.volume > 0) { fadeTo(0); emit(); return; }
      audio.pause(); fade = null;
      if (!wanted) { delayUntil = null; frames.cancel(); emit(); return; }
    }
    if (!track) return;
    if (!began) {
      if (delayUntil === null) delayUntil = clock.now() + MUSIC_START_DELAY_MS;
      if (clock.now() < delayUntil) { frames.schedule(); return; }
      delayUntil = null; began = true;
    }
    if (audio.src !== track.url) {
      audio.pause();
      audio.src = track.url;
      audio.load();
    }
    if (audio.paused) { audio.volume = 0; void start(); }
    else fadeTo(volume);
    emit();
  }
  async function start(): Promise<void> {
    starting = true;
    const request = revision;
    try {
      await audio.play();
      starting = false;
      if (disposed) { audio.pause(); return; }
      if (request !== revision) { audio.pause(); sync(); return; }
      sync(); emit();
    } catch (error) {
      starting = false;
      if (disposed) return;
      if (request !== revision) { sync(); return; }
      const reason = error instanceof Error ? error.message : String(error);
      failure(error instanceof Error && error.name === 'NotAllowedError'
        ? 'Your browser blocked autoplay. Click Music to start the soundtrack.'
        : `Could not play ${track?.title ?? 'the soundtrack'}: ${reason}. Click Music to retry.`);
    }
  }
  const mediaError = (): void => {
    if (!disposed) failure(`Could not load ${track?.title ?? 'the soundtrack'}. Click Music to retry.`);
  };
  audio.addEventListener('error', mediaError);
  return {
    update(season: Season, elapsed: number, running: boolean): void {
      if (disposed) return;
      const next = seasonalTrack(season, elapsed);
      if (next !== track || active !== running) {
        revision++; message = '';
        track = next; active = running;
      }
      sync();
    },
    toggle(): void {
      if (disposed) return;
      const retry = Boolean(message);
      enabled = !enabled; revision++; message = '';
      if (enabled && retry && track && audio.src === track.url) audio.load();
      sync();
    },
    setVolume(value: number): void {
      if (!Number.isFinite(value) || value < 0 || value > .5) throw new Error('Music volume must be between zero and 0.5.');
      volume = value;
      sync();
    },
    dispose(): void {
      disposed = true;
      frames.cancel(); fade = null; delayUntil = null; audio.volume = 0;
      audio.pause();
      audio.removeEventListener('error', mediaError);
      audio.removeAttribute('src');
      audio.load();
    }
  };
}
