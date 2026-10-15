import { readFileSync } from 'node:fs';
import { MUSIC_TRACKS, seasonalTrack, trackSource } from '../src/stronghold/audio/catalog.ts';
import { createSeasonalMusic } from '../src/stronghold/audio/music.ts';
import { DAY_SECONDS, NIGHT_SECONDS } from '../src/stronghold/domain/environment.ts';
import { SEASONS } from '../src/stronghold/domain/types.ts';
import { creditsMarkup } from '../src/stronghold/ui/credits.ts';
import { equal, test } from './harness.ts';

class TestAudio extends EventTarget {
  src = ''; volume = 1; loop = false; preload = ''; paused = true;
  currentTime = 0; plays = 0; loads = 0;
  failure: Error | null = null;
  pending: Promise<void> | null = null;
  async play(): Promise<void> {
    this.plays++;
    if (this.pending) await this.pending;
    if (this.failure) throw this.failure;
    this.paused = false;
  }
  pause(): void { this.paused = true; }
  load(): void { this.loads++; this.currentTime = 0; }
  removeAttribute(name: string): void { if (name === 'src') this.src = ''; }
}
const settle = async (): Promise<void> => { for (let i = 0; i < 5; i++) await Promise.resolve(); };

test('Stronghold uses exactly the eight requested local recordings with the latest seasonal assignments', () => {
  const expected = {
    spring: ['Flying Kerfuffle', 'Ethernight Club'], summer: ['Realizer', 'Sincerely'],
    fall: ['Newer Wave', 'Ether Vox'], winter: ['Voxel Revolution', 'Envision']
  };
  for (const season of SEASONS) {
    equal(seasonalTrack(season, 0).title, expected[season][0]);
    equal(seasonalTrack(season, DAY_SECONDS).title, expected[season][1]);
    equal(seasonalTrack(season, DAY_SECONDS + NIGHT_SECONDS).title, expected[season][0]);
  }
  const tracks = Object.values(MUSIC_TRACKS);
  equal(tracks.length, 8);
  equal(new Set(tracks.map(track => track.url)).size, 8);
  for (const track of tracks) {
    const data = readFileSync(new URL(track.url));
    equal(data.length > 2_000_000, true);
    equal(data.subarray(0, 3).toString() === 'ID3' || (data[0] === 255 && (data[1]! & 224) === 224), true);
  }
  equal(tracks.reduce((sum, track) => sum + readFileSync(new URL(track.url)).length, 0), 57194887);
  equal(MUSIC_TRACKS.springDay.isrc, 'USUAN1800020');
  equal(MUSIC_TRACKS.summerNight.isrc, 'USUAN1900016');
  equal(MUSIC_TRACKS.winterNight.isrc, 'USUAN1900000');
  equal(tracks.some(track => track.title === 'Bleeping Demo'), false);
});

test('Stronghold music only loads the active track, loops it, switches at night, and resumes without resetting on pause or mute', async () => {
  const audio = new TestAudio();
  const music = createSeasonalMusic(audio, () => {});
  music.update('spring', 0, false);
  equal(audio.src, ''); equal(audio.loads, 0);
  music.update('spring', 0, true);
  await settle();
  equal(audio.src, MUSIC_TRACKS.springDay.url);
  equal(audio.plays, 1); equal(audio.loop, true); equal(audio.volume, .18);
  for (let frame = 0; frame < 120; frame++) music.update('spring', frame / 60, true);
  equal(audio.plays, 1); equal(audio.loads, 1);
  audio.currentTime = 23;
  music.update('spring', 2, false); equal(audio.paused, true);
  music.update('spring', 2, true); await settle();
  equal(audio.currentTime, 23);
  music.toggle(); equal(audio.paused, true);
  music.toggle(); await settle(); equal(audio.currentTime, 23);
  music.update('spring', DAY_SECONDS, true); await settle();
  equal(audio.src, MUSIC_TRACKS.springNight.url); equal(audio.currentTime, 0);
  music.setVolume(.08); equal(audio.volume, .08);
  for (const value of [-1, 1, Number.NaN]) {
    let rejected = false;
    try { music.setVolume(value); } catch { rejected = true; }
    equal(rejected, true);
  }
  music.dispose(); equal(audio.paused, true); equal(audio.src, '');
});

test('Stronghold music surfaces autoplay and loading failures and supports an explicit retry', async () => {
  const audio = new TestAudio();
  audio.failure = Object.assign(new Error('Gesture required'), { name: 'NotAllowedError' });
  const statuses: { enabled: boolean; message: string }[] = [];
  const music = createSeasonalMusic(audio, status => statuses.push(status));
  music.update('winter', 0, true); await settle();
  equal(statuses.at(-1)?.enabled, false);
  equal(statuses.at(-1)?.message.includes('Click Music'), true);
  for (let i = 0; i < 20; i++) music.update('winter', 0, true);
  equal(audio.plays, 1);
  audio.failure = null;
  music.toggle(); await settle();
  equal(audio.paused, false); equal(statuses.at(-1)?.message, '');
  audio.dispatchEvent(new Event('error'));
  equal(statuses.at(-1)?.enabled, false);
  equal(statuses.at(-1)?.message.includes('Could not load Voxel Revolution'), true);
  music.toggle(); await settle(); equal(audio.paused, false);
  music.dispose();
  const reports = statuses.length;
  audio.dispatchEvent(new Event('error'));
  equal(statuses.length, reports);
});

test('Stronghold music cancels stale play requests across season changes, pause, and disposal', async () => {
  const audio = new TestAudio();
  let release: () => void = () => { throw new Error('No pending audio request.'); };
  audio.pending = new Promise(resolve => { release = resolve; });
  const music = createSeasonalMusic(audio, () => {});
  music.update('fall', 0, true);
  for (let i = 0; i < 60; i++) music.update('fall', 0, true);
  equal(audio.plays, 1);
  music.update('winter', DAY_SECONDS, true);
  release(); await settle();
  equal(audio.src, MUSIC_TRACKS.winterNight.url);
  equal(audio.plays, 2); equal(audio.paused, false);
  music.update('winter', DAY_SECONDS, false); equal(audio.paused, true);
  music.dispose(); await settle(); equal(audio.paused, true);

  const pendingAudio = new TestAudio();
  pendingAudio.pending = new Promise(resolve => { release = resolve; });
  const pendingMusic = createSeasonalMusic(pendingAudio, () => {});
  pendingMusic.update('summer', 0, true);
  pendingMusic.dispose(); release(); await settle();
  equal(pendingAudio.paused, true); equal(pendingAudio.src, '');
});

test('Stronghold dedicated credits page attributes all recordings with official sources and CC BY 4.0', () => {
  const markup = creditsMarkup();
  equal(markup.includes('id="stronghold-credits"'), true);
  equal(markup.includes('id="stronghold-close-credits"'), true);
  equal(markup.includes('Kevin MacLeod (incompetech.com)'), true);
  equal(markup.includes('https://creativecommons.org/licenses/by/4.0/'), true);
  equal(markup.includes('Recordings are unmodified'), true);
  for (const track of Object.values(MUSIC_TRACKS)) {
    equal(markup.includes(track.title), true);
    equal(markup.includes(trackSource(track)), true);
  }
});
