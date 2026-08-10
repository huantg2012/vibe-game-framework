/**
 * ToolSystem — manages sortie tool usage during a rift run.
 *
 * Slice 4 expands to all 7 common-tier tools (5 active + 2 passive):
 * Active (Q/F):
 * - solidify: freeze nearest enemy for 4s
 * - delay: place a device that suppresses perception escalation in radius for 8s
 * - erode: create a zone that debuffs enemies (speed/perception) for 12s
 * - ruminate: "digest" a nearby collected node to regain 1 kindling
 * - retrograde: mark nearest enemy for 12s (ghost trail + patrol route visible)
 * - kindle: throw a sensory overload bomb (radius 2 tiles, 3s confusion)
 * - stitch: weave a perception barrier between two points for 10s
 * - expand: phase through walls for 3s, 1s stiffness after
 *
 * Passive (auto-trigger):
 * - scatter: slow enemy perception fill rate by 30% when they enter suspicious
 * - muffle: near-range detection disabled (only vision cone matters)
 *
 * Tool effects do NOT modify AI internals. Instead they produce "debuff" descriptors
 * consumed by the scene layer, which applies overrides to enemy speed/perception each
 * frame AFTER the AI update. This keeps the AI system untouched (constraint #1).
 *
 * Spec: docs/specs/system-growth-tide.md, rules CN13-CN15, F29.
 * Design: docs/design-notes/slice3-sortie-tools.md.
 */

import Phaser from 'phaser';
import { CONTAMINANT_DATA } from '@/generated/contaminant-data';
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

/** A retrograde mark on an enemy. */
interface RetrogradeMark {
  enemyId: string;
  remainingMs: number;
  ghostTimer: number;
  ghostPositions: Vector2[];
  visual: Phaser.GameObjects.Graphics;
}

/** A kindle (sensory overload) bomb zone. */
interface KindleZone {
  position: Vector2;
  radius: number;
  remainingMs: number;
  visual: Phaser.GameObjects.Graphics;
}

/** A stitch perception barrier line. */
interface StitchBarrier {
  pointA: Vector2;
  pointB: Vector2;
  remainingMs: number;
  affectedEnemyIds: Set<string>;
  visual: Phaser.GameObjects.Graphics;
}

/** An expand (phase-through) effect on the player. */
interface ExpandEffect {
  remainingMs: number;
  stiffnessMs: number;
  phase: 'active' | 'stiffness';
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
  /** Enemy IDs that are marked by retrograde (visible even outside FOV). */
  markedEnemyIds: Set<string>;
  /** Enemy IDs affected by kindle: confused (stop moving, lose target lock). */
  confusedEnemyIds: Set<string>;
  /** Enemy IDs that crossed a stitch barrier: perception state drops one level. */
  stitchDemotedEnemyIds: Set<string>;
  /** Whether the player is currently phasing (no collision). */
  playerPhasing: boolean;
  /** Whether the player is in expand stiffness (no input). */
  playerStiff: boolean;
  /** Scatter passive: perception fill rate multiplier for suspicious enemies. */
  scatterFillRateMult: number;
  /** Muffle passive: disable near-range (proximity) detection. */
  muffleActive: boolean;
}

// ---------------------------------------------------------------------------
// Constants
// ---------------------------------------------------------------------------

const SOLIDIFY_DURATION_MS = 4000;

const DELAY_DURATION_MS = 8000;
const DELAY_RADIUS = 64; // 2 tiles

const ERODE_DURATION_MS = 12000;
const ERODE_RADIUS = 128; // 4 tiles

const RETROGRADE_DURATION_MS = 12000;
const RETROGRADE_GHOST_INTERVAL_MS = 2000;

const KINDLE_DURATION_MS = 3000;
const KINDLE_RADIUS = 64; // 2 tiles

const STITCH_DURATION_MS = 10000;

const EXPAND_ACTIVE_MS = 3000;
const EXPAND_STIFFNESS_MS = 1000;

const SCATTER_COOLDOWN_MS = 15000;
const SCATTER_FILL_RATE_MULT = 0.70; // 30% slower

// ---------------------------------------------------------------------------
// ToolSystem
// ---------------------------------------------------------------------------

export class ToolSystem {
  private scene!: Phaser.Scene;
  private loadout: (Contaminant | null)[] = [];
  private getPlayerPos!: () => Vector2;
  private getEnemies!: () => readonly EnemyView[];
  private setPlayerCollision?: (enabled: boolean) => void;
  private setPlayerInput?: (enabled: boolean) => void;
  private getCollectedNodes?: () => readonly Vector2[];
  private addKindling?: (n: number) => void;

  // Active effects
  private freezeEffects: FreezeEffect[] = [];
  private delayDevices: DelayDevice[] = [];
  private erodeZones: ErodeZone[] = [];
  private retrogradeMarks: RetrogradeMark[] = [];
  private kindleZones: KindleZone[] = [];
  private stitchBarriers: StitchBarrier[] = [];
  private expandEffect: ExpandEffect | null = null;

  // Passive state
  private scatterCooldownMs = 0;
  private scatterTriggersRemaining = 0;
  private muffleTriggersRemaining = 0;
  private scatterActive = false;
  private muffleEquipped = false;

  // Stitch placement state (two-click)
  private stitchPendingPoint: Vector2 | null = null;

  // Debuffs (rebuilt each frame for the scene layer)
  private readonly debuffs: ToolDebuffs = {
    frozenEnemyIds: new Set(),
    suppressedEnemyIds: new Set(),
    erodedEnemyIds: new Set(),
    markedEnemyIds: new Set(),
    confusedEnemyIds: new Set(),
    stitchDemotedEnemyIds: new Set(),
    playerPhasing: false,
    playerStiff: false,
    scatterFillRateMult: 1.0,
    muffleActive: false,
  };

  create(
    scene: Phaser.Scene,
    loadout: (Contaminant | null)[],
    getPlayerPos: () => Vector2,
    getEnemies: () => readonly EnemyView[],
    options?: {
      setPlayerCollision?: (enabled: boolean) => void;
      setPlayerInput?: (enabled: boolean) => void;
      getCollectedNodes?: () => readonly Vector2[];
      addKindling?: (n: number) => void;
    },
  ): void {
    this.scene = scene;
    this.loadout = loadout;
    this.getPlayerPos = getPlayerPos;
    this.getEnemies = getEnemies;
    this.setPlayerCollision = options?.setPlayerCollision;
    this.setPlayerInput = options?.setPlayerInput;
    this.getCollectedNodes = options?.getCollectedNodes;
    this.addKindling = options?.addKindling;
    this.freezeEffects = [];
    this.delayDevices = [];
    this.erodeZones = [];
    this.retrogradeMarks = [];
    this.kindleZones = [];
    this.stitchBarriers = [];
    this.expandEffect = null;
    this.stitchPendingPoint = null;

    // Initialize passive tools from loadout
    this.scatterTriggersRemaining = 0;
    this.muffleTriggersRemaining = 0;
    this.scatterActive = false;
    this.muffleEquipped = false;
    this.scatterCooldownMs = 0;

    for (const contaminant of loadout) {
      if (!contaminant) continue;
      if (contaminant.stage !== 'tool') continue;

      const def = CONTAMINANT_DATA[contaminant.type];
      if (!def || def.toolType !== 'passive') continue;

      if (contaminant.type === 'scatter') {
        this.scatterTriggersRemaining = contaminant.usesRemaining;
        this.scatterActive = true;
      } else if (contaminant.type === 'muffle') {
        this.muffleTriggersRemaining = contaminant.usesRemaining;
        this.muffleEquipped = true;
      }
    }
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

    // Skip passive tools on manual activation
    const def = CONTAMINANT_DATA[contaminant.type];
    if (def && def.toolType === 'passive') return false;

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
    this.updateRetrogradeMarks(deltaMs);
    this.updateKindleZones(deltaMs);
    this.updateStitchBarriers(deltaMs);
    this.updateExpandEffect(deltaMs);
    this.updatePassives(deltaMs);
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

  /** Notify tool system that an enemy entered suspicious (for scatter passive). */
  notifyEnemySuspicious(_enemyId: string): void {
    if (!this.scatterActive || this.scatterTriggersRemaining <= 0) return;
    if (this.scatterCooldownMs > 0) return;

    this.scatterTriggersRemaining--;
    this.scatterCooldownMs = SCATTER_COOLDOWN_MS;

    // Consume a use from the scatter contaminant in loadout
    for (const contaminant of this.loadout) {
      if (contaminant && contaminant.type === 'scatter' && contaminant.stage === 'tool') {
        contaminantSystem.useTool(contaminant.id);
        if (contaminant.usesRemaining <= 0) {
          this.scatterActive = false;
          const idx = this.loadout.indexOf(contaminant);
          if (idx !== -1) this.loadout[idx] = null;
        }
        break;
      }
    }
  }

  /** Notify tool system that a proximity detection was about to trigger (for muffle passive). */
  notifyProximityAvoid(): void {
    if (!this.muffleEquipped || this.muffleTriggersRemaining <= 0) return;

    this.muffleTriggersRemaining--;

    // Consume a use from the muffle contaminant in loadout
    for (const contaminant of this.loadout) {
      if (contaminant && contaminant.type === 'muffle' && contaminant.stage === 'tool') {
        contaminantSystem.useTool(contaminant.id);
        if (contaminant.usesRemaining <= 0) {
          this.muffleEquipped = false;
          const idx = this.loadout.indexOf(contaminant);
          if (idx !== -1) this.loadout[idx] = null;
        }
        break;
      }
    }
  }

  reset(): void {
    this.cleanupVisuals();
    this.freezeEffects = [];
    this.delayDevices = [];
    this.erodeZones = [];
    this.retrogradeMarks = [];
    this.kindleZones = [];
    this.stitchBarriers = [];
    this.expandEffect = null;
    this.stitchPendingPoint = null;
    this.debuffs.frozenEnemyIds.clear();
    this.debuffs.suppressedEnemyIds.clear();
    this.debuffs.erodedEnemyIds.clear();
    this.debuffs.markedEnemyIds.clear();
    this.debuffs.confusedEnemyIds.clear();
    this.debuffs.stitchDemotedEnemyIds.clear();
    this.debuffs.playerPhasing = false;
    this.debuffs.playerStiff = false;
    this.debuffs.scatterFillRateMult = 1.0;
    this.debuffs.muffleActive = false;
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
      case 'ruminate': return this.applyRuminate();
      case 'retrograde': return this.applyRetrograde();
      case 'kindle': return this.applyKindle();
      case 'stitch': return this.applyStitch();
      case 'expand': return this.applyExpand();
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

  // --- Ruminate (digest collected node to regain 1 kindling) ---

  private applyRuminate(): boolean {
    if (!this.getCollectedNodes || !this.addKindling) return false;

    const playerPos = this.getPlayerPos();
    const collectedNodes = this.getCollectedNodes();

    // Find nearest collected node within 96px (3 tiles)
    const RANGE = 96;
    let nearest: Vector2 | null = null;
    let minDist = Infinity;

    for (const node of collectedNodes) {
      const dx = node.x - playerPos.x;
      const dy = node.y - playerPos.y;
      const dist = Math.sqrt(dx * dx + dy * dy);
      if (dist < RANGE && dist < minDist) {
        minDist = dist;
        nearest = node;
      }
    }

    if (!nearest) return false;

    // Grant 1 kindling
    this.addKindling(1);

    // Visual feedback: brief green pulse at the node position
    const g = this.scene.add.graphics().setDepth(15);
    g.fillStyle(0x22cc66, 0.5);
    g.fillCircle(nearest.x, nearest.y, 12);
    this.scene.tweens.add({
      targets: { alpha: 0.5 },
      alpha: 0,
      duration: 400,
      onUpdate: (tween) => {
        const a = tween.getValue() as number;
        g.clear();
        g.fillStyle(0x22cc66, a);
        g.fillCircle(nearest!.x, nearest!.y, 12);
      },
      onComplete: () => g.destroy(),
    });

    return true;
  }

  // --- Retrograde (mark nearest enemy 12s: ghost trail + patrol route visible) ---

  private applyRetrograde(): boolean {
    const playerPos = this.getPlayerPos();
    const enemies = this.getEnemies();

    // Find nearest enemy not already marked
    let nearest: EnemyView | null = null;
    let minDist = Infinity;

    for (const enemy of enemies) {
      if (this.debuffs.markedEnemyIds.has(enemy.getId())) continue;
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

    const g = this.scene.add.graphics().setDepth(24);

    this.retrogradeMarks.push({
      enemyId: nearest.getId(),
      remainingMs: RETROGRADE_DURATION_MS,
      ghostTimer: 0,
      ghostPositions: [],
      visual: g,
    });

    return true;
  }

  private updateRetrogradeMarks(deltaMs: number): void {
    for (let i = this.retrogradeMarks.length - 1; i >= 0; i--) {
      const mark = this.retrogradeMarks[i]!;
      mark.remainingMs -= deltaMs;
      mark.ghostTimer += deltaMs;

      const enemy = this.getEnemies().find((e) => e.getId() === mark.enemyId);

      // Record ghost positions every 2s
      if (mark.ghostTimer >= RETROGRADE_GHOST_INTERVAL_MS && enemy) {
        mark.ghostTimer = 0;
        mark.ghostPositions.push({ ...enemy.getPosition() });
        // Keep max 6 ghost positions
        if (mark.ghostPositions.length > 6) mark.ghostPositions.shift();
      }

      // Draw ghost trail + current position indicator
      mark.visual.clear();
      if (enemy) {
        const ep = enemy.getPosition();
        // Current position: yellow diamond
        mark.visual.lineStyle(1.5, 0xcccc44, 0.6);
        mark.visual.beginPath();
        mark.visual.moveTo(ep.x, ep.y - 8);
        mark.visual.lineTo(ep.x + 6, ep.y);
        mark.visual.lineTo(ep.x, ep.y + 8);
        mark.visual.lineTo(ep.x - 6, ep.y);
        mark.visual.closePath();
        mark.visual.strokePath();

        // Ghost trail: fading grey circles
        for (let j = 0; j < mark.ghostPositions.length; j++) {
          const gp = mark.ghostPositions[j]!;
          const alpha = 0.15 + (j / mark.ghostPositions.length) * 0.2;
          mark.visual.fillStyle(0x888888, alpha);
          mark.visual.fillCircle(gp.x, gp.y, 5);
        }

        // Dotted line from last ghost to current
        if (mark.ghostPositions.length > 0) {
          const lastGhost = mark.ghostPositions[mark.ghostPositions.length - 1]!;
          mark.visual.lineStyle(1, 0x888888, 0.3);
          mark.visual.beginPath();
          mark.visual.moveTo(lastGhost.x, lastGhost.y);
          mark.visual.lineTo(ep.x, ep.y);
          mark.visual.strokePath();
        }
      }

      if (mark.remainingMs <= 0) {
        mark.visual.destroy();
        this.retrogradeMarks.splice(i, 1);
      }
    }
  }

  // --- Kindle (sensory overload bomb in radius 2 tiles for 3s) ---

  private applyKindle(): boolean {
    const pos = { ...this.getPlayerPos() };

    const g = this.scene.add.graphics().setDepth(10);
    g.fillStyle(0xcc8844, 0.2);
    g.fillCircle(pos.x, pos.y, KINDLE_RADIUS);
    g.lineStyle(1.5, 0xeebb55, 0.4);
    g.strokeCircle(pos.x, pos.y, KINDLE_RADIUS);

    this.kindleZones.push({
      position: pos,
      radius: KINDLE_RADIUS,
      remainingMs: KINDLE_DURATION_MS,
      visual: g,
    });

    return true;
  }

  private updateKindleZones(deltaMs: number): void {
    for (let i = this.kindleZones.length - 1; i >= 0; i--) {
      const zone = this.kindleZones[i]!;
      zone.remainingMs -= deltaMs;

      // Flickering orange visual
      const flicker = 0.15 + Math.sin(zone.remainingMs * 0.01) * 0.08;
      zone.visual.clear();
      zone.visual.fillStyle(0xcc8844, flicker);
      zone.visual.fillCircle(zone.position.x, zone.position.y, zone.radius);
      zone.visual.lineStyle(1.5, 0xeebb55, flicker + 0.1);
      zone.visual.strokeCircle(zone.position.x, zone.position.y, zone.radius);

      if (zone.remainingMs <= 0) {
        zone.visual.destroy();
        this.kindleZones.splice(i, 1);
      }
    }
  }

  // --- Stitch (perception barrier between two points for 10s) ---

  private applyStitch(): boolean {
    const pos = { ...this.getPlayerPos() };

    if (!this.stitchPendingPoint) {
      // First click: set point A
      this.stitchPendingPoint = pos;
      // Visual indicator for point A
      const g = this.scene.add.graphics().setDepth(10);
      g.fillStyle(0x8866cc, 0.6);
      g.fillCircle(pos.x, pos.y, 4);
      // Auto-cleanup after a few seconds if no second click
      this.scene.time.delayedCall(5000, () => {
        g.destroy();
        if (this.stitchPendingPoint === pos) this.stitchPendingPoint = null;
      });
      return false; // Don't consume a use for the first click
    }

    // Second click: set point B, create barrier
    const pointA = this.stitchPendingPoint;
    const pointB = pos;
    this.stitchPendingPoint = null;

    // Clamp max distance to 96px (3 tiles)
    const dx = pointB.x - pointA.x;
    const dy = pointB.y - pointA.y;
    const dist = Math.sqrt(dx * dx + dy * dy);
    if (dist > 96) {
      // Shorten to max range
      const scale = 96 / dist;
      pointB.x = pointA.x + dx * scale;
      pointB.y = pointA.y + dy * scale;
    }

    const g = this.scene.add.graphics().setDepth(10);

    this.stitchBarriers.push({
      pointA,
      pointB,
      remainingMs: STITCH_DURATION_MS,
      affectedEnemyIds: new Set(),
      visual: g,
    });

    return true;
  }

  private updateStitchBarriers(deltaMs: number): void {
    for (let i = this.stitchBarriers.length - 1; i >= 0; i--) {
      const barrier = this.stitchBarriers[i]!;
      barrier.remainingMs -= deltaMs;

      // Draw barrier line (pulsing purple)
      const pulse = 0.3 + Math.sin(barrier.remainingMs * 0.004) * 0.15;
      barrier.visual.clear();
      barrier.visual.lineStyle(3, 0x8866cc, pulse);
      barrier.visual.beginPath();
      barrier.visual.moveTo(barrier.pointA.x, barrier.pointA.y);
      barrier.visual.lineTo(barrier.pointB.x, barrier.pointB.y);
      barrier.visual.strokePath();

      // Small circles at endpoints
      barrier.visual.fillStyle(0x8866cc, pulse);
      barrier.visual.fillCircle(barrier.pointA.x, barrier.pointA.y, 3);
      barrier.visual.fillCircle(barrier.pointB.x, barrier.pointB.y, 3);

      if (barrier.remainingMs <= 0) {
        barrier.visual.destroy();
        this.stitchBarriers.splice(i, 1);
      }
    }
  }

  // --- Expand (phase through walls for 3s, then 1s stiffness) ---

  private applyExpand(): boolean {
    if (this.expandEffect) return false; // Already active

    this.expandEffect = {
      remainingMs: EXPAND_ACTIVE_MS,
      stiffnessMs: EXPAND_STIFFNESS_MS,
      phase: 'active',
    };

    // Disable collision
    this.setPlayerCollision?.(false);

    return true;
  }

  private updateExpandEffect(deltaMs: number): void {
    if (!this.expandEffect) return;

    if (this.expandEffect.phase === 'active') {
      this.expandEffect.remainingMs -= deltaMs;
      if (this.expandEffect.remainingMs <= 0) {
        // Transition to stiffness
        this.expandEffect.phase = 'stiffness';
        this.expandEffect.remainingMs = this.expandEffect.stiffnessMs;
        // Re-enable collision, disable input
        this.setPlayerCollision?.(true);
        this.setPlayerInput?.(false);
      }
    } else {
      // Stiffness phase
      this.expandEffect.remainingMs -= deltaMs;
      if (this.expandEffect.remainingMs <= 0) {
        // End effect
        this.setPlayerInput?.(true);
        this.expandEffect = null;
      }
    }
  }

  // --- Passive tools update ---

  private updatePassives(deltaMs: number): void {
    // Scatter cooldown
    if (this.scatterCooldownMs > 0) {
      this.scatterCooldownMs -= deltaMs;
    }
  }

  // --- Debuff aggregation ---

  private rebuildDebuffs(): void {
    this.debuffs.frozenEnemyIds.clear();
    this.debuffs.suppressedEnemyIds.clear();
    this.debuffs.erodedEnemyIds.clear();
    this.debuffs.markedEnemyIds.clear();
    this.debuffs.confusedEnemyIds.clear();
    this.debuffs.stitchDemotedEnemyIds.clear();
    this.debuffs.playerPhasing = false;
    this.debuffs.playerStiff = false;
    this.debuffs.scatterFillRateMult = 1.0;
    this.debuffs.muffleActive = false;

    // Freeze
    for (const effect of this.freezeEffects) {
      this.debuffs.frozenEnemyIds.add(effect.enemyId);
    }

    const enemies = this.getEnemies();

    // Delay devices: enemies within radius
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

    // Retrograde marks
    for (const mark of this.retrogradeMarks) {
      this.debuffs.markedEnemyIds.add(mark.enemyId);
    }

    // Kindle zones: enemies within radius
    for (const zone of this.kindleZones) {
      for (const enemy of enemies) {
        const ep = enemy.getPosition();
        const dx = ep.x - zone.position.x;
        const dy = ep.y - zone.position.y;
        if (dx * dx + dy * dy <= zone.radius * zone.radius) {
          this.debuffs.confusedEnemyIds.add(enemy.getId());
        }
      }
    }

    // Stitch barriers: check enemy crossing
    for (const barrier of this.stitchBarriers) {
      for (const enemy of enemies) {
        const id = enemy.getId();
        if (barrier.affectedEnemyIds.has(id)) continue; // Only triggers once per enemy

        const ep = enemy.getPosition();
        if (this.isNearLine(ep, barrier.pointA, barrier.pointB, 12)) {
          barrier.affectedEnemyIds.add(id);
          this.debuffs.stitchDemotedEnemyIds.add(id);
        }
      }
    }

    // Expand
    if (this.expandEffect) {
      if (this.expandEffect.phase === 'active') {
        this.debuffs.playerPhasing = true;
      } else {
        this.debuffs.playerStiff = true;
      }
    }

    // Scatter passive
    if (this.scatterActive && this.scatterTriggersRemaining > 0 && this.scatterCooldownMs <= 0) {
      this.debuffs.scatterFillRateMult = SCATTER_FILL_RATE_MULT;
    }

    // Muffle passive
    if (this.muffleEquipped && this.muffleTriggersRemaining > 0) {
      this.debuffs.muffleActive = true;
    }
  }

  /** Check if a point is within `threshold` px of a line segment. */
  private isNearLine(point: Vector2, lineA: Vector2, lineB: Vector2, threshold: number): boolean {
    const dx = lineB.x - lineA.x;
    const dy = lineB.y - lineA.y;
    const lenSq = dx * dx + dy * dy;
    if (lenSq === 0) {
      // Degenerate line (both points same)
      const d = Math.hypot(point.x - lineA.x, point.y - lineA.y);
      return d <= threshold;
    }

    // Project point onto line, clamped to segment
    let t = ((point.x - lineA.x) * dx + (point.y - lineA.y) * dy) / lenSq;
    t = Math.max(0, Math.min(1, t));

    const projX = lineA.x + t * dx;
    const projY = lineA.y + t * dy;
    const dist = Math.hypot(point.x - projX, point.y - projY);
    return dist <= threshold;
  }

  private cleanupVisuals(): void {
    for (const effect of this.freezeEffects) effect.tint?.destroy();
    for (const device of this.delayDevices) device.visual.destroy();
    for (const zone of this.erodeZones) zone.visual.destroy();
    for (const mark of this.retrogradeMarks) mark.visual.destroy();
    for (const zone of this.kindleZones) zone.visual.destroy();
    for (const barrier of this.stitchBarriers) barrier.visual.destroy();
  }
}
