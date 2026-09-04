/**
 * Gym lesson from the URL query. Contract: docs/dev/gym.md.
 */

export type GymLesson =
  | 'enemy'
  | 'player'
  | 'map'
  | 'lexicon'
  | 'lexicon-gallery'
  | 'paint-vein-card'
  | 'rift-entrance-card';

export function readGymLesson(): GymLesson {
  const value = new URLSearchParams(window.location.search).get('lesson');
  if (value === 'player') return 'player';
  if (value === 'map') return 'map';
  if (value === 'lexicon') return 'lexicon';
  if (value === 'lexicon-gallery') return 'lexicon-gallery';
  if (value === 'paint-vein-card') return 'paint-vein-card';
  if (value === 'rift-entrance-card') return 'rift-entrance-card';
  return 'enemy';
}

export function isMapGymLesson(lesson: GymLesson): boolean {
  return lesson === 'map';
}
