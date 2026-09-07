import type Phaser from 'phaser';
import type { PlayerBodyConfig } from '@/entities/player';
import type { Vector2 } from '@/types/game-types';
import { GAME_CONSTANTS } from '@/config/constants';

/** Feet occupy the ground; the head and lamp can overlap a device above its base. */
export const PURIFICATION_PLAYER_BODY: PlayerBodyConfig = {
  width: 12, height: 8, offsetX: 10, offsetY: 22,
};

export interface DeviceFootprint {
  readonly width: number;
  readonly height: number;
  /** Center displacement from the device's semantic ground anchor. */
  readonly offsetX: number;
  readonly offsetY: number;
}

/** Physical bases, not texture bounds. Every base straddles its depth-sort line. */
export const PURIFICATION_DEVICE_FOOTPRINTS = {
  core: { width: 22, height: 10, offsetX: 0, offsetY: -1 },
  storage: { width: 24, height: 12, offsetX: 0, offsetY: -2 },
  purifier: { width: 24, height: 10, offsetX: 0, offsetY: -2 },
  offering: { width: 18, height: 8, offsetX: 0, offsetY: -1 },
  growth: { width: 26, height: 12, offsetX: 1, offsetY: -3 },
} as const satisfies Readonly<Record<string, DeviceFootprint>>;

export type PurificationDeviceId = keyof typeof PURIFICATION_DEVICE_FOOTPRINTS;
export type PurificationDeviceAnchors = Readonly<Record<PurificationDeviceId, Readonly<Vector2>>>;

const TILE = GAME_CONSTANTS.TILE_SIZE;
const CENTER_X = GAME_CONSTANTS.PURIFICATION.MAP_COLS * TILE / 2;
const CENTER_Y = GAME_CONSTANTS.PURIFICATION.MAP_ROWS * TILE / 2;

/** Shared by physical bases and their visuals; moving a station cannot detach its body. */
export const PURIFICATION_DEVICE_ANCHORS: PurificationDeviceAnchors = {
  core: { x: CENTER_X, y: CENTER_Y },
  storage: { x: CENTER_X + 3.5 * TILE, y: CENTER_Y },
  purifier: { x: CENTER_X, y: CENTER_Y + 3.5 * TILE },
  offering: { x: CENTER_X - 3 * TILE, y: CENTER_Y + 2.5 * TILE },
  growth: { x: CENTER_X - 3.5 * TILE, y: CENTER_Y },
};

export const PURIFICATION_SPAWN_POINT: Readonly<Vector2> = { x: CENTER_X, y: CENTER_Y + 2 * TILE };

/** Safe before or after Phaser's own shutdown; Group.destroy is already idempotent. */
export function destroyStaticCollision(
  collider: Phaser.Physics.Arcade.Collider | null,
  group: Phaser.Physics.Arcade.StaticGroup | null,
): void {
  // Unlike Group.destroy, Collider.destroy dereferences world on every invocation.
  if (collider?.world) collider.destroy();
  group?.destroy(true, true);
}

/** Scene-owned static bodies: default Arcade separation retains tangential sliding. */
export class PurificationCollision {
  private readonly group: Phaser.Physics.Arcade.StaticGroup;
  private readonly collider: Phaser.Physics.Arcade.Collider;

  constructor(
    scene: Phaser.Scene,
    player: Phaser.Physics.Arcade.Image,
    anchors: PurificationDeviceAnchors,
  ) {
    this.group = scene.physics.add.staticGroup();
    for (const id of Object.keys(PURIFICATION_DEVICE_FOOTPRINTS) as PurificationDeviceId[]) {
      const footprint = PURIFICATION_DEVICE_FOOTPRINTS[id];
      const anchor = anchors[id];
      const base = scene.add.rectangle(
        anchor.x + footprint.offsetX, anchor.y + footprint.offsetY,
        footprint.width, footprint.height,
      ).setVisible(false);
      base.setName(`purification-base-${id}`);
      this.group.add(base);
    }
    this.collider = scene.physics.add.collider(player, this.group);
  }

  destroy(): void {
    destroyStaticCollision(this.collider, this.group);
  }
}
