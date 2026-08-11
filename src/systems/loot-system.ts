/**
 * LootSystem - kindling node placement, visibility and pickup.
 *
 * Each node is an irregular teal polyhedron sprite placed at the position defined
 * in the map layout. Pickup is detected via Phaser Arcade overlap; the system never
 * imports another system, receiving everything it needs through its constructor and
 * the event bus.
 */

import Phaser from 'phaser';
import { GAME_CONSTANTS } from '@/config/constants';
import { eventBus } from '@/core/event-bus';
import { GameEvent } from '@/types/events';
import type { KindlingNodeDef, KindlingTier } from '@/types/map-types';
import type { Vector2 } from '@/types/game-types';

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

interface KindlingNode {
  readonly def: KindlingNodeDef;
  readonly sprite: Phaser.GameObjects.Image;
  collected: boolean;
}

export interface LootSystemConfig {
  /** Called each frame per node to query visibility at its position. */
  getVisibilityAt: (point: Readonly<Vector2>) => number;
  /** Multiplier on kindling pickup values from STORAGE module. Default 1.0. */
  kindlingValueModifier?: number;
}

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

// Reference color for the kindling node palette (used in texture generation above)
// const LOOT_COLOR = 0x1aad96;
const LOOT_SIZE = 12; // slightly larger to accommodate irregular shape (was 8)
const LOOT_DEPTH = 15; // between surface (0) and player (30)

/** Texture key generated once per scene lifetime. */
const LOOT_TEXTURE_KEY = '__loot_node_12x12';

function ensureLootTexture(scene: Phaser.Scene): void {
  if (scene.textures.exists(LOOT_TEXTURE_KEY)) return;
  const g = scene.make.graphics({ x: 0, y: 0 }, false);

  // Main body: dark teal irregular polyhedron
  g.fillStyle(0x1a6b5c, 1);
  g.fillPoints([
    { x: 5, y: 0 },
    { x: 10, y: 2 },
    { x: 12, y: 6 },
    { x: 9, y: 11 },
    { x: 4, y: 10 },
    { x: 1, y: 7 },
    { x: 2, y: 3 },
  ], true);

  // Highlight facet on top (1-2px brighter area)
  g.fillStyle(0x1aad96, 1);
  g.fillPoints([
    { x: 5, y: 1 },
    { x: 9, y: 2 },
    { x: 7, y: 4 },
    { x: 4, y: 3 },
  ], true);

  g.generateTexture(LOOT_TEXTURE_KEY, LOOT_SIZE, LOOT_SIZE);
  g.destroy();
}

function tierValue(tier: KindlingTier): number {
  const loot = GAME_CONSTANTS.LOOT;
  switch (tier) {
    case 'safe': return loot.VALUE_SAFE;
    case 'contested': return loot.VALUE_CONTESTED;
    case 'deep': return loot.VALUE_DEEP;
  }
}

// ---------------------------------------------------------------------------
// LootSystem
// ---------------------------------------------------------------------------

export class LootSystem {
  private scene!: Phaser.Scene;
  private nodes: KindlingNode[] = [];
  private carried = 0;
  private getVisibilityAt!: (point: Readonly<Vector2>) => number;
  private overlapCollider: Phaser.Physics.Arcade.Collider | null = null;
  /** STORAGE module bonus applied to pickup values. */
  private kindlingValueModifier = 1.0;

  create(
    scene: Phaser.Scene,
    nodeDefs: readonly KindlingNodeDef[],
    playerSprite: Phaser.GameObjects.GameObject,
    config: LootSystemConfig,
  ): void {
    this.scene = scene;
    this.getVisibilityAt = config.getVisibilityAt;
    this.kindlingValueModifier = config.kindlingValueModifier ?? 1.0;
    this.carried = 0;

    ensureLootTexture(scene);

    // Pre-allocate all nodes
    for (const def of nodeDefs) {
      const sprite = scene.add.image(
        def.position.x,
        def.position.y,
        LOOT_TEXTURE_KEY,
      );
      sprite.setDepth(LOOT_DEPTH);
      // Enable physics body for overlap detection
      scene.physics.add.existing(sprite, true); // static body
      this.nodes.push({ def, sprite, collected: false });
    }

    // Single overlap collider for all node sprites
    const nodeSprites = this.nodes.map((n) => n.sprite);
    const group = scene.physics.add.staticGroup();
    for (const s of nodeSprites) group.add(s);
    this.overlapCollider = scene.physics.add.overlap(
      playerSprite,
      group,
      (_player, nodeObj) => this.onOverlap(nodeObj as Phaser.GameObjects.Image),
    );
  }

  /** Update visibility alpha each frame. */
  update(): void {
    for (const node of this.nodes) {
      if (node.collected) continue;
      const vis = this.getVisibilityAt(node.def.position);
      node.sprite.setAlpha(vis);
    }
  }

  getCarriedKindling(): number {
    return this.carried;
  }

  /** Add bonus kindling (e.g. from ruminate tool). */
  addBonusKindling(n: number): void {
    this.carried += Math.max(0, n);
  }

  getRemainingNodes(): number {
    let count = 0;
    for (const node of this.nodes) {
      if (!node.collected) count++;
    }
    return count;
  }

  reset(): void {
    this.carried = 0;
    for (const node of this.nodes) {
      node.collected = false;
      node.sprite.setVisible(true);
      node.sprite.setActive(true);
      // Re-enable the physics body
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

    const baseValue = node.def.value ?? tierValue(node.def.tier);
    // Apply STORAGE module bonus (spec rule 29), floor to 1
    const value = Math.max(1, Math.floor(baseValue * this.kindlingValueModifier));
    this.carried += value;

    eventBus.emit(GameEvent.KINDLING_COLLECTED, {
      amount: value,
      total: this.carried,
    });
  }
}
