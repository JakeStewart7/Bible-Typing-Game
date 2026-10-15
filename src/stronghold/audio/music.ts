import { seasonalTrack, type MusicTrack } from './catalog.ts';
import type { Season } from '../domain/types.ts';

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

export function createSeasonalMusic(audio: MusicAudio, report: (status: MusicStatus) => void) {
  audio.preload = 'none';
  audio.loop = true;
  audio.volume = .18;
  let track: MusicTrack | null = null;
  let active = false, enabled = true, starting = false, disposed = false;
  let revision = 0, message = '', lastReport = '';
  function emit(): void {
    if (disposed) return;
    const status = { enabled, playing: !audio.paused, track, message };
    const key = JSON.stringify(status);
    if (key !== lastReport) { lastReport = key; report(status); }
  }
  function failure(text: string): void {
    enabled = false; revision++; message = text;
    audio.pause(); emit();
  }
  function sync(): void {
    if (disposed) return;
    if (!active || !enabled || !track) { if (starting || !audio.paused) audio.pause(); emit(); return; }
    if (starting) return;
    if (audio.src !== track.url) {
      audio.pause();
      audio.src = track.url;
      audio.load();
    }
    if (audio.paused) void start();
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
      emit();
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
      audio.volume = value;
    },
    dispose(): void {
      disposed = true;
      audio.pause();
      audio.removeEventListener('error', mediaError);
      audio.removeAttribute('src');
      audio.load();
    }
  };
}
