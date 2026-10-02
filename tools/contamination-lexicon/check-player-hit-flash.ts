/** Native Combat flash: real player pixels + Phaser tint component, CPU presentation
 * contract and lifecycle regression. GPU/FOV appearance is reviewed in the actual scene. */
import assert from 'node:assert/strict';
import { createRequire } from 'node:module';
import { CombatSystem } from '../../src/systems/combat-system.ts';
import { GAME_CONSTANTS } from '../../src/config/constants.ts';
import { renderDensePlayerFrame } from '../../src/entities/player-sprite-dense.ts';

const require = createRequire(import.meta.url);
const Tint = require('phaser/src/gameobjects/components/Tint.js');
const EventEmitter = require('eventemitter3');
type Rect = { x: number; y: number; w: number; h: number };
const rectangles: Rect[] = [];
const graphics = () => ({
  setDepth() { return this; }, clear() { rectangles.length = 0; return this; },
  fillStyle() { return this; }, fillRect(x: number, y: number, w: number, h: number) {
    rectangles.push({ x, y, w, h }); return this;
  }, destroy() {},
});
const events = new EventEmitter();
let textureSerial = 0;
const scene = {
  events,
  add: { graphics, image: () => ({
    setDepth() { return this; }, setVisible() { return this; }, setTintFill() { return this; }, destroy() {},
  }) },
  textures: { createCanvas: () => ({ key: `flash-fixture-${textureSerial++}` }), remove() {} },
};
const mask = { source: 'existing-body-mask' };
const image = {
  scene, mask, x: 16, y: 16, scaleX: 1, scaleY: 1, rotation: 0,
  cropY: 22, cropHeight: 10, visible: true,
  pixels: renderDensePlayerFrame('right', 'walk', 0),
  tintTopLeft: 0xffffff, tintTopRight: 0xffffff,
  tintBottomLeft: 0xffffff, tintBottomRight: 0xffffff, tintFill: false,
  setTint: Tint.setTint, setTintFill: Tint.setTintFill,
};
const originalTint = [0x123456, 0x345678, 0x56789a, 0x789abc];
image.setTint(...originalTint);
const upper = { ...image, cropY: 0, cropHeight: 22 };
const bodyImages = [image, upper];
const tintState = (piece = image) => [piece.tintTopLeft, piece.tintTopRight, piece.tintBottomLeft, piece.tintBottomRight, piece.tintFill];
const assertRestored = (reason: string, fill = false) => {
  for (const piece of bodyImages) assert.deepEqual(tintState(piece), [...originalTint, fill], reason);
};
const player = {
  getPosition: () => ({ x: 16, y: 16 }), getFacingAngle: () => 0, getHitFlashImages: () => bodyImages,
  setSpeedModifier() {}, clearSpeedModifier() {}, setWeaponVisual() {}, setWeaponAttackPose() {},
};
const combat = new CombatSystem();
combat.create(scene as never, { cols: 20, rows: 20, tileSize: 8, version: 0, isOpaque: () => false },
  player as never, { getEnemies: () => [], getEnemyById: () => undefined }, { onNoise() {} });
const owned = combat as unknown as {
  applyEnemyHit(id: string): void; flashRemainingMs: number; health: number; invulnRemainingMs: number;
};

// A small CPU output recorder models the tint-fill alpha contract, including any
// rectangles submitted by Combat. The previous production fillRect fails on both
// transparent corners inside its 26px bounds and the gap between the player's feet.
function assertTransparentFlash(): void {
  const before = image.pixels.slice();
  let lit = 0, transparent = 0;
  for (let y = 0; y < 32; y++) for (let x = 0; x < 32; x++) {
    const i = (y * 32 + x) * 4;
    const alpha = image.pixels[i + 3]!;
    const piece = bodyImages.find(p => p.visible && y >= p.cropY && y < p.cropY + p.cropHeight);
    const rectangle = rectangles.some(r => x >= r.x && y >= r.y && x < r.x + r.w && y < r.y + r.h);
    const outputAlpha = rectangle ? 255 : piece?.pixels[i + 3] ?? 0;
    assert.equal(outputAlpha, alpha, `flash must preserve source alpha at ${x},${y}`);
    if (!alpha) transparent++;
    else {
      assert.equal(piece?.tintFill, true, `both torso and feet must flash at ${x},${y}, not only the physics crop`);
      assert.equal(piece?.tintTopLeft, GAME_CONSTANTS.COMBAT.FX_COLOR);
      lit++;
    }
  }
  assert(lit > 100 && transparent > 300, 'fixture uses an opaque body with meaningful transparent padding/gaps');
  assert.deepEqual(image.pixels, before, 'source animation pixels are not modified');
  for (const piece of bodyImages) {
    assert.equal(piece.mask, mask, 'existing geometry/FOV mask survives flash');
    assert.deepEqual([piece.x, piece.y, piece.scaleX, piece.scaleY, piece.rotation], [16, 16, 1, 1, 0]);
  }
}

const healthBefore = combat.getHealth();
owned.applyEnemyHit('fixture');
assert.equal(combat.getHealth(), healthBefore - GAME_CONSTANTS.COMBAT.ENEMY_DAMAGE_BASE);
assert.equal(owned.invulnRemainingMs, GAME_CONSTANTS.COMBAT.PLAYER_IFRAME_MS);
assert.equal(owned.flashRemainingMs, GAME_CONSTANTS.COMBAT.PLAYER_HIT_FLASH_MS);
combat.update(0);
assertTransparentFlash();
// Facing and animation change during the same flash: alpha follows the live frame.
image.pixels = renderDensePlayerFrame('up', 'walk', 2);
upper.pixels = image.pixels;
combat.update(0);
assertTransparentFlash();
// Unequipped mode restores a single full-frame body; hidden torso must stay hidden.
image.cropY = 0; image.cropHeight = 32; upper.visible = false;
combat.update(0); assertTransparentFlash();
assert.equal(upper.visible, false);
image.cropY = 22; image.cropHeight = 10; upper.visible = true;
while (owned.flashRemainingMs > 0) combat.update(16);
assertRestored('natural expiry restores all four tint corners');

owned.applyEnemyHit('fixture'); combat.update(0);
const remainingBeforePause = owned.flashRemainingMs;
events.emit('pause');
assertRestored('pause clears visual immediately');
assert.equal(owned.flashRemainingMs, remainingBeforePause, 'pause does not rewrite the combat clock');
combat.update(0); assertTransparentFlash();
events.emit('sleep');
assertRestored('sleep clears visual immediately');
combat.update(0);
combat.setEnabled(false);
assertRestored('ended/frozen run cannot retain flash');
combat.update(0);
assertRestored('disabled draw does not reapply flash');
combat.reset();
owned.applyEnemyHit('fixture'); combat.update(0); combat.reset();
assertRestored('reset restores before the next frame');

// Death may freeze the DEV scene on this very update; cleanup cannot rely on another tick.
owned.health = GAME_CONSTANTS.COMBAT.ENEMY_DAMAGE_BASE;
owned.applyEnemyHit('fixture'); combat.update(0);
assert.equal(combat.isDead(), true);
assertRestored('death freeze has no stuck white body');
combat.reset();
for (const piece of bodyImages) piece.setTintFill(...originalTint);
owned.applyEnemyHit('fixture'); combat.update(0); combat.destroy();
assertRestored('destroy preserves a pre-existing fill-tint mode', true);
assert.equal(events.listenerCount('pause'), 0);
assert.equal(events.listenerCount('sleep'), 0);
console.log('check:player-hit-flash ok (native transparent pixels, split torso/feet, live frame, original mask/tint, clocks, pause/sleep/end/reset/death/destroy)');
