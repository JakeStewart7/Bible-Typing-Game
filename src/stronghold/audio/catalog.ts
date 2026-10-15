import { daylight } from '../domain/environment.ts';
import type { Season } from '../domain/types.ts';

export type MusicTrack = { title: string; url: string; isrc: string };
export const MUSIC_TRACKS = {
  springDay: { title: 'Flying Kerfuffle', url: new URL('../../../assets/music/stronghold/flying-kerfuffle.mp3', import.meta.url).href, isrc: 'USUAN1800020' },
  springNight: { title: 'Ethernight Club', url: new URL('../../../assets/music/stronghold/ethernight-club.mp3', import.meta.url).href, isrc: 'USUAN2100002' },
  winterDay: { title: 'Voxel Revolution', url: new URL('../../../assets/music/stronghold/voxel-revolution.mp3', import.meta.url).href, isrc: 'USUAN2000025' },
  winterNight: { title: 'Envision', url: new URL('../../../assets/music/stronghold/envision.mp3', import.meta.url).href, isrc: 'USUAN1900000' },
  fallDay: { title: 'Newer Wave', url: new URL('../../../assets/music/stronghold/newer-wave.mp3', import.meta.url).href, isrc: 'USUAN2000024' },
  fallNight: { title: 'Ether Vox', url: new URL('../../../assets/music/stronghold/ether-vox.mp3', import.meta.url).href, isrc: 'USUAN2000022' },
  summerDay: { title: 'Realizer', url: new URL('../../../assets/music/stronghold/realizer.mp3', import.meta.url).href, isrc: 'USUAN1900024' },
  summerNight: { title: 'Sincerely', url: new URL('../../../assets/music/stronghold/sincerely.mp3', import.meta.url).href, isrc: 'USUAN1900016' }
} satisfies Record<string, MusicTrack>;

export const SEASON_MUSIC: Record<Season, { day: MusicTrack; night: MusicTrack }> = {
  spring: { day: MUSIC_TRACKS.springDay, night: MUSIC_TRACKS.springNight },
  summer: { day: MUSIC_TRACKS.summerDay, night: MUSIC_TRACKS.summerNight },
  fall: { day: MUSIC_TRACKS.fallDay, night: MUSIC_TRACKS.fallNight },
  winter: { day: MUSIC_TRACKS.winterDay, night: MUSIC_TRACKS.winterNight }
};

export function seasonalTrack(season: Season, elapsed: number): MusicTrack {
  return SEASON_MUSIC[season][daylight(elapsed).period];
}

export function trackSource(track: MusicTrack): string {
  return `https://incompetech.com/music/royalty-free/index.html?isrc=${track.isrc}`;
}
