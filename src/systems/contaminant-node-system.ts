/**
 * ContaminantNodeSystem — places and manages contaminant pickup nodes in the rift map.
 *
 * Each node is a spherical teal sprite with center highlight and breathing glow.
 * Pickup via Phaser Arcade overlap. Follows the same pattern as LootSystem but for
 * contaminant acquisition.
 *
 * Spec: docs/specs/system-growth-tide.md, rules CN8-CN9.
 */

import Phaser from 'phaser';
import { GAME_CONSTANTS } from '@/config/constants';
import { CONTAMINANT_DATA } from '@/generated/contaminant-data';
import { contaminantSystem } from '@/systems/contaminant-system';
import type { ContaminantRarity, ContaminantType, Vector2 } from '@/types/game-types';
import type { ContaminantNodeDef } from '@/types/map-types';

interface ContaminantNode {
  readonly def: ContaminantNodeDef;
  readonly sprite: Phaser.GameObjects.Image;
  collected: boolean;
}

export interface ContaminantNodeSystemConfig {
  /** Called each frame per node to query visibility at its position. */
  getVisibilityAt: (point: Readonly<Vector2>) => number;
}

// ---------------------------------------------------------------------------
// Constants
// ---------------------------------------------------------------------------

// Reference color (purple sphere, distinct from both teal enemies and gold kindling)
// const NODE_COLOR = 0x7722aa;
const NODE_SIZE = 12; // was 8
const NODE_DEPTH = 15; // same layer as loot nodes
const NODE_TEXTURE_KEY = '__contaminant_node_12x12';

function ensureContaminantTexture(scene: Phaser.Scene): void {
  if (scene.textures.exists(NODE_TEXTURE_KEY)) return;
  const g = scene.make.graphics({ x: 0, y: 0 }, false);

  // Outer circle: dark purple
  g.fillStyle(0x4a1566, 1);
  g.fillCircle(6, 6, 5);

  // Inner bright ring highlight (partial)
  g.fillStyle(0x7722aa, 1);
  g.fillCircle(6, 6, 3);

  // Core bright center
  g.fillStyle(0xaa44dd, 1);
  g.fillRect(5, 5, 2, 2);

  // Radial "radiation" dots (will appear to spin due to sprite rotation in update)
  g.fillStyle(0x9933cc, 1);
  g.fillRect(6, 1, 1, 1);  // top
  g.fillRect(10, 5, 1, 1); // right
  g.fillRect(6, 10, 1, 1); // bottom
  g.fillRect(2, 5, 1, 1);  // left

  g.generateTexture(NODE_TEXTURE_KEY, NODE_SIZE, NODE_SIZE);
  g.destroy();
}

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

/** Types grouped by rarity for weighted random selection. */
const TYPES_BY_RARITY: Record<ContaminantRarity, ContaminantType[]> = {
  common: [],
  fine: [],
  rare: [],
};

// Populate from CONTAMINANT_DATA at module load
for (const [id, def] of Object.entries(CONTAMINANT_DATA)) {
  TYPES_BY_RARITY[def.rarity].push(id as ContaminantType);
}

function rollRarity(): ContaminantRarity {
  const weights = GAME_CONSTANTS.CONTAMINANT.RARITY_WEIGHTS;
  const total = weights.common + weights.fine + weights.rare;
  const roll = Math.random() * total;
  if (roll < weights.common) return 'common';
  if (roll < weights.common + weights.fine) return 'fine';
  return 'rare';
}

/** Roll a random contaminant type from the given rarity pool. */
function rollType(rarity: ContaminantRarity): ContaminantType {
  const pool = TYPES_BY_RARITY[rarity];
  return pool[Math.floor(Math.random() * pool.length)]!;
}

// ---------------------------------------------------------------------------
// ContaminantNodeSystem
// ---------------------------------------------------------------------------

export class ContaminantNodeSystem {
  private scene!: Phaser.Scene;
  private nodes: ContaminantNode[] = [];
  private getVisibilityAt!: (point: Readonly<Vector2>) => number;
  private overlapCollider: Phaser.Physics.Arcade.Collider | null = null;
  private pulseTime = 0;

  create(
    scene: Phaser.Scene,
    nodeDefs: readonly ContaminantNodeDef[],
    playerSprite: Phaser.GameObjects.GameObject,
    config: ContaminantNodeSystemConfig,
  ): void {
    this.scene = scene;
    this.getVisibilityAt = config.getVisibilityAt;
    this.pulseTime = 0;

    ensureContaminantTexture(scene);

    for (const def of nodeDefs) {
      const sprite = scene.add.image(
        def.position.x,
        def.position.y,
        NODE_TEXTURE_KEY,
      );
      sprite.setDepth(NODE_DEPTH);
      scene.physics.add.existing(sprite, true); // static body
      this.nodes.push({ def, sprite, collected: false });
    }

    // Single overlap collider for all node sprites
    const group = scene.physics.add.staticGroup();
    for (const node of this.nodes) group.add(node.sprite);
    this.overlapCollider = scene.physics.add.overlap(
      playerSprite,
      group,
      (_player, nodeObj) => this.onOverlap(nodeObj as Phaser.GameObjects.Image),
    );
  }

  /** Update visibility alpha, pulse and rotation effect each frame. */
  update(delta: number): void {
    this.pulseTime += delta * 0.006; // faster than kindling (~1.5x)
    const pulse = 0.5 + Math.sin(this.pulseTime) * 0.3; // 0.2 .. 0.8

    for (const node of this.nodes) {
      if (node.collected) continue;
      const vis = this.getVisibilityAt(node.def.position);
      node.sprite.setAlpha(vis * pulse);
      // Slow continuous rotation gives a "radiating" spinning feel
      node.sprite.rotation += delta * 0.002;
    }
  }

  /** Positions of contaminant nodes that have not been collected (Proximity layer). */
  getRemainingPositions(): readonly Vector2[] {
    const positions: Vector2[] = [];
    for (const node of this.nodes) {
      if (!node.collected) positions.push(node.def.position);
    }
    return positions;
  }

  /** Get positions of all collected (empty) nodes — for ruminate tool. */
  getCollectedPositions(): readonly Vector2[] {
    const positions: Vector2[] = [];
    for (const node of this.nodes) {
      if (node.collected) {
        positions.push(node.def.position);
      }
    }
    return positions;
  }

  reset(): void {
    this.pulseTime = 0;
    for (const node of this.nodes) {
      node.collected = false;
      node.sprite.setVisible(true);
      node.sprite.setActive(true);
      const body = node.sprite.body as Phaser.Physics.Arcade.StaticBody | null;
      if (body) body.enable = true;
    }
  }

  destroy(): void {
    if (this.overlapCollider) {
      this.scene?.physics?.world?.removeCollider(this.overlapCollider);
      this.overlapCollider = null;
    }
    for (const node of this.nodes) {
      node.sprite.destroy();
    }
    this.nodes = [];
  }

  // ------------------------------------------------------------------ internal

  private onOverlap(nodeObj: Phaser.GameObjects.Image): void {
    const node = this.nodes.find((n) => n.sprite === nodeObj);
    if (!node || node.collected) return;

    node.collected = true;
    node.sprite.setVisible(false);
    node.sprite.setActive(false);
    const body = node.sprite.body as Phaser.Physics.Arcade.StaticBody | null;
    if (body) body.enable = false;

    const rarity = rollRarity();
    const type = rollType(rarity);
    // acquire() internally emits CONTAMINANT_ACQUIRED
    contaminantSystem.acquire(type, rarity);
  }
}
