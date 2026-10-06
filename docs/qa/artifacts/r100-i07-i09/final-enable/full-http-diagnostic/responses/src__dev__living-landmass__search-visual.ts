import type { SearchObjectVisual } from '@/systems/loot-search-presentation';
import type Phaser from 'phaser';
import type { Vector2 } from '@/types/game-types';

/** The native Stage owns this world's visible material pile. No legacy skin
 * is silently selected underneath it, and no second simulation is created. */
export function createLivingSearchVisual(_scene: Phaser.Scene, position: Readonly<Vector2>): SearchObjectVisual {
  return { x:position.x,y:position.y,setVisibility(){},setRummaging(){},playReveal(){},update(){},destroy(){} };
}
