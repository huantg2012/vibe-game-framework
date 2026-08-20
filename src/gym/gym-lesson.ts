/**
 * Gym lesson from the URL query. Contract: docs/dev/gym.md.
 */

export type GymLesson = 'enemy' | 'player' | 'map';

export function readGymLesson(): GymLesson {
  const value = new URLSearchParams(window.location.search).get('lesson');
  if (value === 'player') return 'player';
  if (value === 'map') return 'map';
  return 'enemy';
}
