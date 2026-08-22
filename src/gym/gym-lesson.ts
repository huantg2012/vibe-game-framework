/**
 * Gym lesson from the URL query. Contract: docs/dev/gym.md.
 */

export type GymLesson = 'enemy' | 'player' | 'map' | 'lexicon' | 'lexicon-gallery';

export function readGymLesson(): GymLesson {
  const value = new URLSearchParams(window.location.search).get('lesson');
  if (value === 'player') return 'player';
  if (value === 'map') return 'map';
  if (value === 'lexicon') return 'lexicon';
  if (value === 'lexicon-gallery') return 'lexicon-gallery';
  return 'enemy';
}

export function isMapGymLesson(lesson: GymLesson): boolean {
  return lesson === 'map';
}
