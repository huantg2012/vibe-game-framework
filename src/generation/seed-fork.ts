import { SeededRandom } from '@/utils/random';

export function mix32(seed: number, label: string): number {
  let h = seed >>> 0;
  for (let i = 0; i < label.length; i++) {
    h = Math.imul(h ^ label.charCodeAt(i), 0x9e3779b9);
  }
  h ^= h >>> 16;
  h = Math.imul(h, 0x7feb352d);
  h ^= h >>> 15;
  return h >>> 0;
}

export function forkMapRngs(seed: number, recipeId: string, attempt = 0) {
  return {
    outlineSeed: seed >>> 0,
    structureRng: new SeededRandom(mix32(seed, `structure:${recipeId}:${attempt}`)),
    coverRng: new SeededRandom(mix32(seed, `cover:${recipeId}:${attempt}`)),
    scatterRng: new SeededRandom(mix32(seed, `scatter:${recipeId}`)),
    atmosphereRng: new SeededRandom(mix32(seed, `atmosphere:${recipeId}`)),
  };
}
