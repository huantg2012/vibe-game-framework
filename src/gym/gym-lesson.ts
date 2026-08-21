/**
 * Gym lesson from the URL query. Contract: docs/dev/gym.md.
 */

export type GymLesson = 'enemy' | 'player' | 'map' | 'lexicon';

export function readGymLesson(): GymLesson {
  const value = new URLSearchParams(window.location.search).get('lesson');
  if (value === 'player') return 'player';
  if (value === 'map') return 'map';
  if (value === 'lexicon') return 'lexicon';
  return 'enemy';
}

export function isMapGymLesson(lesson: GymLesson): boolean {
  return lesson === 'map';
}
