import type Phaser from 'phaser';
import type { SearchObjectVisual } from '@/systems/loot-search-presentation';
import type { Vector2 } from '@/types/game-types';

/** Native world fallback beneath Stage. The formal search system owns every
 * state change; this is an explicit material factory, not a legacy fragment alias. */
export function createSuspendedSeaSearchVisual(scene: Phaser.Scene, position: Readonly<Vector2>, seed: number,
  _getPlayerPos: () => Readonly<Vector2>): SearchObjectVisual {
  const graphic = scene.add.graphics().setPosition(position.x, position.y).setDepth(15);
  let visibility = 0, rummaging = false, revealed = false, age = 1000, clock = 0, destroyed = false;
  const draw = (): void => {
    if (destroyed) return;
    graphic.clear().setVisible(visibility > 0).setAlpha(visibility);
    if (visibility <= 0) return;
    const shift = rummaging ? Math.round(Math.sin(clock * .028) * .6) : 0;
    const flatten = revealed ? .55 : 1;
    graphic.fillStyle(0x242b2b).fillRect(-15, 3, 29, 6);
    graphic.fillStyle(0x62655f).fillPoints([
      { x: -14 + shift, y: 1 }, { x: -11, y: -5 * flatten }, { x: -3, y: -8 * flatten },
      { x: 5, y: -5 * flatten }, { x: 10, y: -2 * flatten }, { x: 13, y: 4 },
      { x: 2, y: 7 }, { x: -7, y: 5 },
    ], true);
    graphic.fillStyle(0x909184).fillRect(-10, -4 * flatten, 8, 2).fillRect(4, 1, 7, 2);
    graphic.fillStyle(0x3e4542).fillRect(-6, 1, 12, 2);
    graphic.fillStyle(0x766e5c).fillRect((seed % 4) - 10, 3, 5, 2);
    if (age < 220) {
      const offset = Math.round(Math.sin(age / 220 * Math.PI) * 5);
      graphic.fillStyle(0x9b9b89).fillRect(-9 - offset, -4 - offset, 2, 2).fillRect(9 + offset, -2 - offset, 2, 1);
    }
  };
  return {
    x: position.x, y: position.y,
    setVisibility(value) { visibility = Math.max(0, Math.min(1, value)); draw(); },
    setRummaging(on) { rummaging = on; },
    playReveal() { revealed = true; age = 0; draw(); },
    update(deltaMs) { clock += deltaMs; age += deltaMs; if (rummaging || age < 250) draw(); },
    destroy() { if (!destroyed) { destroyed = true; graphic.destroy(); } },
  };
}
