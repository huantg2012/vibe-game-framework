/**
 * ToolSystem — manages sortie tool usage during a rift run.
 *
 * Implements 3 tools for Slice 3:
 * - solidify (common): freeze nearest enemy for 4s
 * - delay (fine): place a device that suppresses perception escalation in radius for 8s
 * - erode (rare): create a zone that debuffs enemies (speed/perception) for 12s
 *
 * Tool effects do NOT modify AI internals. Instead they produce "debuff" descriptors
 * consumed by the scene layer, which applies overrides to enemy speed/perception each
 * frame AFTER the AI update. This keeps the AI system untouched (constraint #1).
 *
 * Spec: docs/specs/system-growth-tide.md, rules CN13-CN15, F29.
 * Design: docs/design-notes/slice3-sortie-tools.md.
 */

import Phaser from 'phaser';
import { contaminantSystem } from '@/systems/contaminant-system';
import type { Contaminant, ContaminantType, Vector2 } from '@/types/game-types';
import type { EnemyView } from '@/types/ai-types';

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

/** A frozen enemy effect (solidify). */
interface FreezeEffect {
  enemyId: string;
  remainingMs: number;
  tint: Phaser.GameObjects.Graphics | null;
}

/** A placed delay device. */
interface DelayDevice {
  position: Vector2;
  radius: number;
  remainingMs: number;
  visual: Phaser.GameObjects.Graphics;
}

/** An erode zone. */
interface ErodeZone {
  position: Vector2;
  radius: number;
  remainingMs: number;
  visual: Phaser.GameObjects.Graphics;
}

/**
 * Debuffs the scene layer should apply to enemies each frame.
 * The scene reads this after each AI update and applies the overrides.
 */
export interface ToolDebuffs {
  /** Enemy IDs that are currently frozen (speed = 0, no perception). */
  frozenEnemyIds: Set<string>;
  /** Enemy IDs whose perception state should not escalate (delay device). */
  suppressedEnemyIds: Set<string>;
  /** Enemy IDs inside erode zones: speed * 0.6, perception range * 0.7, chase speed = patrol. */
  erodedEnemyIds: Set<string>;
}

// ---------------------------------------------------------------------------
// Constants
// ---------------------------------------------------------------------------

const SOLIDIFY_DURATION_MS = 4000;

const DELAY_DURATION_MS = 8000;
const DELAY_RADIUS = 64; // 2 tiles

const ERODE_DURATION_MS = 12000;
const ERODE_RADIUS = 128; // 4 tiles

// ---------------------------------------------------------------------------
// ToolSystem
// ---------------------------------------------------------------------------

export class ToolSystem {
  private scene!: Phaser.Scene;
  private loadout: (Contaminant | null)[] = [];
  private getPlayerPos!: () => Vector2;
  private getEnemies!: () => readonly EnemyView[];

  // Active effects
  private freezeEffects: FreezeEffect[] = [];
  private delayDevices: DelayDevice[] = [];
  private erodeZones: ErodeZone[] = [];

  // Debuffs (rebuilt each frame for the scene layer)
  private readonly debuffs: ToolDebuffs = {
    frozenEnemyIds: new Set(),
    suppressedEnemyIds: new Set(),
    erodedEnemyIds: new Set(),
  };

  create(
    scene: Phaser.Scene,
    loadout: (Contaminant | null)[],
    getPlayerPos: () => Vector2,
    getEnemies: () => readonly EnemyView[],
  ): void {
    this.scene = scene;
    this.loadout = loadout;
    this.getPlayerPos = getPlayerPos;
    this.getEnemies = getEnemies;
    this.freezeEffects = [];
    this.delayDevices = [];
    this.erodeZones = [];
  }

  /**
   * Attempt to use the tool in the given slot (0 or 1).
   * Returns true if usage was successful.
   */
  useSlot(slotIndex: number): boolean {
    const contaminant = this.loadout[slotIndex];
    if (!contaminant) return false;
    if (contaminant.stage !== 'tool') return false;
    if (contaminant.usesRemaining <= 0) return false;

    const success = this.applyEffect(contaminant.type);
    if (!success) return false;

    // Deduct a use (may break the tool)
    contaminantSystem.useTool(contaminant.id);

    // If broken, null out in loadout
    if (contaminant.usesRemaining <= 0) {
      this.loadout[slotIndex] = null;
    }

    return true;
  }

  /** Per-frame update of active tool effects. Call BEFORE reading debuffs. */
  update(deltaMs: number): void {
    this.updateFreezes(deltaMs);
    this.updateDelayDevices(deltaMs);
    this.updateErodeZones(deltaMs);
    this.rebuildDebuffs();
  }

  /** Read the current frame's debuffs. Scene applies these after AI update. */
  getDebuffs(): Readonly<ToolDebuffs> {
    return this.debuffs;
  }

  /** Get remaining uses for a slot (for HUD). Returns 0 if slot is empty. */
  getSlotUses(slotIndex: number): number {
    return this.loadout[slotIndex]?.usesRemaining ?? 0;
  }

  /** Get the tool type for a slot (for HUD). Returns null if empty. */
  getSlotType(slotIndex: number): ContaminantType | null {
    return this.loadout[slotIndex]?.type ?? null;
  }

  reset(): void {
    this.cleanupVisuals();
    this.freezeEffects = [];
    this.delayDevices = [];
    this.erodeZones = [];
    this.debuffs.frozenEnemyIds.clear();
    this.debuffs.suppressedEnemyIds.clear();
    this.debuffs.erodedEnemyIds.clear();
  }

  destroy(): void {
    this.cleanupVisuals();
  }

  // ------------------------------------------------------------------ internal

  private applyEffect(type: ContaminantType): boolean {
    switch (type) {
      case 'solidify': return this.applySolidify();
      case 'delay': return this.applyDelay();
      case 'erode': return this.applyErode();
      default: return false;
    }
  }

  // --- Solidify (freeze nearest enemy in view for 4s) ---

  private applySolidify(): boolean {
    const playerPos = this.getPlayerPos();
    const enemies = this.getEnemies();

    // Find nearest enemy that is not already frozen
    let nearest: EnemyView | null = null;
    let minDist = Infinity;

    for (const enemy of enemies) {
      if (this.debuffs.frozenEnemyIds.has(enemy.getId())) continue;
      const ep = enemy.getPosition();
      const dx = ep.x - playerPos.x;
      const dy = ep.y - playerPos.y;
      const dist = Math.sqrt(dx * dx + dy * dy);
      if (dist < minDist) {
        minDist = dist;
        nearest = enemy;
      }
    }

    if (!nearest) return false;

    // Visual: white tint indicator on the enemy position
    const ep = nearest.getPosition();
    const g = this.scene.add.graphics().setDepth(26);
    g.fillStyle(0xffffff, 0.5);
    g.fillRect(ep.x - 10, ep.y - 10, 20, 20);

    this.freezeEffects.push({
      enemyId: nearest.getId(),
      remainingMs: SOLIDIFY_DURATION_MS,
      tint: g,
    });

    return true;
  }

  private updateFreezes(deltaMs: number): void {
    for (let i = this.freezeEffects.length - 1; i >= 0; i--) {
      const effect = this.freezeEffects[i]!;
      effect.remainingMs -= deltaMs;

      // Update visual position (enemy may still have a position)
      if (effect.tint) {
        const enemy = this.getEnemies().find((e) => e.getId() === effect.enemyId);
        if (enemy) {
          const ep = enemy.getPosition();
          effect.tint.clear();
          // Pulsing white overlay
          const alpha = 0.3 + Math.sin(effect.remainingMs * 0.008) * 0.2;
          effect.tint.fillStyle(0xffffff, alpha);
          effect.tint.fillRect(ep.x - 10, ep.y - 10, 20, 20);
        }
      }

      if (effect.remainingMs <= 0) {
        effect.tint?.destroy();
        this.freezeEffects.splice(i, 1);
      }
    }
  }

  // --- Delay (place device at player position, suppress perception in radius) ---

  private applyDelay(): boolean {
    const pos = { ...this.getPlayerPos() };

    const g = this.scene.add.graphics().setDepth(10);
    g.fillStyle(0x4488ff, 0.2);
    g.fillCircle(pos.x, pos.y, DELAY_RADIUS);
    g.lineStyle(1, 0x4488ff, 0.4);
    g.strokeCircle(pos.x, pos.y, DELAY_RADIUS);

    this.delayDevices.push({
      position: pos,
      radius: DELAY_RADIUS,
      remainingMs: DELAY_DURATION_MS,
      visual: g,
    });

    return true;
  }

  private updateDelayDevices(deltaMs: number): void {
    for (let i = this.delayDevices.length - 1; i >= 0; i--) {
      const device = this.delayDevices[i]!;
      device.remainingMs -= deltaMs;

      // Redraw with shrinking feedback
      const frac = Math.max(0, device.remainingMs / DELAY_DURATION_MS);
      device.visual.clear();
      device.visual.fillStyle(0x4488ff, 0.15 * frac);
      device.visual.fillCircle(device.position.x, device.position.y, device.radius * frac);
      device.visual.lineStyle(1, 0x4488ff, 0.3 * frac);
      device.visual.strokeCircle(device.position.x, device.position.y, device.radius);

      if (device.remainingMs <= 0) {
        device.visual.destroy();
        this.delayDevices.splice(i, 1);
      }
    }
  }

  // --- Erode (zone at player position, debuffs enemies inside) ---

  private applyErode(): boolean {
    const pos = { ...this.getPlayerPos() };

    const g = this.scene.add.graphics().setDepth(10);
    g.fillStyle(0x881111, 0.15);
    g.fillCircle(pos.x, pos.y, ERODE_RADIUS);
    g.lineStyle(1.5, 0x881111, 0.3);
    g.strokeCircle(pos.x, pos.y, ERODE_RADIUS);

    this.erodeZones.push({
      position: pos,
      radius: ERODE_RADIUS,
      remainingMs: ERODE_DURATION_MS,
      visual: g,
    });

    return true;
  }

  private updateErodeZones(deltaMs: number): void {
    for (let i = this.erodeZones.length - 1; i >= 0; i--) {
      const zone = this.erodeZones[i]!;
      zone.remainingMs -= deltaMs;

      // Pulsing visual
      const pulse = 0.12 + Math.sin(zone.remainingMs * 0.003) * 0.05;
      zone.visual.clear();
      zone.visual.fillStyle(0x881111, pulse);
      zone.visual.fillCircle(zone.position.x, zone.position.y, zone.radius);
      zone.visual.lineStyle(1.5, 0x881111, 0.3);
      zone.visual.strokeCircle(zone.position.x, zone.position.y, zone.radius);

      if (zone.remainingMs <= 0) {
        zone.visual.destroy();
        this.erodeZones.splice(i, 1);
      }
    }
  }

  // --- Debuff aggregation ---

  private rebuildDebuffs(): void {
    this.debuffs.frozenEnemyIds.clear();
    this.debuffs.suppressedEnemyIds.clear();
    this.debuffs.erodedEnemyIds.clear();

    // Freeze
    for (const effect of this.freezeEffects) {
      this.debuffs.frozenEnemyIds.add(effect.enemyId);
    }

    // Delay devices: enemies within radius
    const enemies = this.getEnemies();
    for (const device of this.delayDevices) {
      for (const enemy of enemies) {
        const ep = enemy.getPosition();
        const dx = ep.x - device.position.x;
        const dy = ep.y - device.position.y;
        if (dx * dx + dy * dy <= device.radius * device.radius) {
          this.debuffs.suppressedEnemyIds.add(enemy.getId());
        }
      }
    }

    // Erode zones: enemies within radius
    for (const zone of this.erodeZones) {
      for (const enemy of enemies) {
        const ep = enemy.getPosition();
        const dx = ep.x - zone.position.x;
        const dy = ep.y - zone.position.y;
        if (dx * dx + dy * dy <= zone.radius * zone.radius) {
          this.debuffs.erodedEnemyIds.add(enemy.getId());
        }
      }
    }
  }

  private cleanupVisuals(): void {
    for (const effect of this.freezeEffects) effect.tint?.destroy();
    for (const device of this.delayDevices) device.visual.destroy();
    for (const zone of this.erodeZones) zone.visual.destroy();
  }
}
