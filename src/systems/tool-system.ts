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
 * All 8 of the above (T7 rewire, Slice 5) reach the AI the same way the 7 Slice 5 tools
 * below already do: small setter/listener methods `AISystem` exposes, called through
 * optional callbacks the scene wires into `create()`. Slice 4 originally routed them
 * through a per-frame "debuff" descriptor (`ToolDebuffs`) the scene was supposed to read
 * and apply after each AI update; that consumer was never written, so every one of these
 * 8 tools' enemy-facing effects was presentation-only until this rewire. See the T7
 * delivery report for the before/after per tool and why the descriptor pattern was
 * dropped in favour of the setter style below.
 *
 * Slice 5 adds the remaining 7 active tools plus the 3rd passive (T1/T2):
 * - compress, mirror, echo, resonate, overwrite, abyss, combust (active)
 * - siphon (passive)
 *
 * These do not reuse the debuff-descriptor pattern above. Effects that need to change
 * enemy behaviour (movement lock, perception range, patrol reversal, forced RETURN, a
 * decoy sighting target, knockback) go through small setter methods `AISystem` now
 * exposes (`src/systems/ai/ai-system.ts`), reached via optional callbacks the scene wires
 * into `create()` - the same shape as the existing `setPlayerCollision` / `addKindling`
 * callbacks below, just aimed at enemies instead of the player. Effects that need combat
 * or the chaos meter (combust's burn, abyss's post-use spike, siphon's rate cut) go
 * through the same style of callback into `CombatSystem` / `ChaosSystem`. See
 * `docs/design-notes/slice3-sortie-tools.md` for the original design and the Slice 5 T1
 * delivery report for exactly which methods were added and why.
 *
 * Slice 5 T4 replaces every tool's placeholder presentation (Slice 4/5 `fillCircle` +
 * continuous `tweens.add` fades) with the shared VFX language `docs/art/tool-vfx-spec.md`
 * defines: grid-aligned glitch block fields, jagged polygons, bracket markers and discrete
 * (non-tweened) dissolves, all built from the primitives in `tool-vfx.ts`. Gameplay
 * (multipliers, radii, durations, AI overrides) is unchanged by T4 - only how each effect
 * is drawn.
 *
 * Spec: docs/specs/system-growth-tide.md, rules CN13-CN15, F29.
 * Design: docs/design-notes/slice3-sortie-tools.md.
 * VFX: docs/art/tool-vfx-spec.md.
 */

import Phaser from 'phaser';
import { GAME_CONSTANTS } from '@/config/constants';
import { eventBus } from '@/core/event-bus';
import { CONTAMINANT_DATA } from '@/generated/contaminant-data';
import { ENEMY_DATA } from '@/generated/enemy-data';
import { contaminantSystem } from '@/systems/contaminant-system';
import { AIState, type Contaminant, type ContaminantType, type Vector2 } from '@/types/game-types';
import { GameEvent } from '@/types/events';
import type { EnemyView } from '@/types/ai-types';
import {
  CONTAM_ANCIENT,
  CONTAM_BRIGHT,
  CONTAM_COLD,
  CONTAM_DEEP,
  CONTAM_GLOW,
  CONTAM_MID,
  CONTAM_PEAK,
  EnemyPerceptionIndicators,
  GHOST_COLOR,
  buildGlitchBlockField,
  buildJaggedPolygon,
  createDissolveState,
  createStepFade,
  drawBracketMarker,
  hashSeed,
  mulberry32,
  renderGlitchBlockField,
  renderPolygonOutline,
  renderPolylineRing,
  stepDissolve,
  stepFade,
  type DissolveState,
  type GlitchBlock,
  type StepFadeState,
} from '@/systems/tool-vfx';

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

/** A frozen enemy effect (solidify - 族群 A). */
interface FreezeEffect {
  enemyId: string;
  remainingMs: number;
  /** Crystal outline points, relative to the enemy's current position. */
  polygon: Vector2[];
  /** Last known world position - the dissolve anchor once the enemy stops existing
   * (e.g. killed while frozen), so the crack animation doesn't jump to (0,0). */
  lastPos: Vector2;
  visual: Phaser.GameObjects.Graphics;
  /** Set once `remainingMs` hits 0; visual lingers a little longer to play the
   * "crack apart" dissolve while the gameplay override has already been released. */
  dissolving: boolean;
  dissolveBlocks: GlitchBlock[];
  dissolve: DissolveState;
}

/** A placed delay device (族群 C). */
interface DelayDevice {
  position: Vector2;
  radius: number;
  remainingMs: number;
  visual: Phaser.GameObjects.Graphics;
  blocks: GlitchBlock[];
  dissolving: boolean;
  dissolve: DissolveState;
  /** Enemies currently inside, so leaving the radius releases exactly them. */
  affectedEnemyIds: Set<string>;
}

/** An erode zone (族群 C). */
interface ErodeZone {
  position: Vector2;
  radius: number;
  remainingMs: number;
  visual: Phaser.GameObjects.Graphics;
  blocks: GlitchBlock[];
  dissolving: boolean;
  dissolve: DissolveState;
  /** Enemies currently inside, so leaving the radius releases exactly them. */
  affectedEnemyIds: Set<string>;
}

/** A retrograde mark on an enemy (族群 B, common). */
interface RetrogradeMark {
  enemyId: string;
  remainingMs: number;
  ghostTimer: number;
  ghostPositions: Vector2[];
  ghostAlphas: number[];
  visual: Phaser.GameObjects.Graphics;
  collapsing: boolean;
  collapseFade: StepFadeState;
}

/** A kindle (sensory overload) bomb zone (族群 C). */
interface KindleZone {
  position: Vector2;
  radius: number;
  remainingMs: number;
  visual: Phaser.GameObjects.Graphics;
  blocks: GlitchBlock[];
  dissolving: boolean;
  dissolve: DissolveState;
  /** Enemies already hit by this zone - the confusion is a one-shot per enemy. */
  affectedEnemyIds: Set<string>;
}

/** A stitch perception barrier line (族群 D). */
interface StitchBarrier {
  pointA: Vector2;
  pointB: Vector2;
  remainingMs: number;
  affectedEnemyIds: Set<string>;
  visual: Phaser.GameObjects.Graphics;
  dissolving: boolean;
  fade: StepFadeState;
}

/** An expand (phase-through) effect on the player (族群 G). */
interface ExpandEffect {
  remainingMs: number;
  stiffnessMs: number;
  phase: 'active' | 'stiffness';
  visual: Phaser.GameObjects.Graphics;
  jitterPhase: number;
}

// --- Slice 5 (T1) active tool state ---

/** A compress gravity anchor (族群 C): speed -60% + movement direction locked inside radius. */
interface CompressAnchor {
  position: Vector2;
  radius: number;
  remainingMs: number;
  visual: Phaser.GameObjects.Graphics;
  bracketVisual: Phaser.GameObjects.Graphics;
  blocks: GlitchBlock[];
  dissolving: boolean;
  dissolve: DissolveState;
  /** Tracked so leaving the zone (or the zone expiring) releases exactly the enemies it locked. */
  affectedEnemyIds: Set<string>;
}

/** A mirror decoy (族群 F): enemies who visually sight the player within range target this instead. */
interface MirrorDecoy {
  position: Vector2;
  remainingMs: number;
  visual: Phaser.GameObjects.Graphics;
  shattering: boolean;
  shatterBlocks: GlitchBlock[];
  shatterDissolve: DissolveState;
}

/** A4 副标示 marker on whichever enemy(ies) `AISystem` currently reports as sighting the
 * decoy instead of the player (`EnemyView.isTargetingDecoy()`) - "视野内敌人优先对镜像产生
 * 怀疑" made visible, per `tool-vfx-spec.md` A4's bracket-marker list. */
interface MirrorDecoyMarker {
  visual: Phaser.GameObjects.Graphics;
}

/** A resonate tripwire between two points (族群 D): crossing it knocks back + stuns. */
interface ResonateString {
  pointA: Vector2;
  pointB: Vector2;
  remainingMs: number;
  affectedEnemyIds: Set<string>;
  visual: Phaser.GameObjects.Graphics;
  dissolving: boolean;
  fade: StepFadeState;
}

/** An overwrite mark (族群 B, rare): perception range halved until it expires. */
interface OverwriteMark {
  enemyId: string;
  remainingMs: number;
  bracketVisual: Phaser.GameObjects.Graphics;
}

/** A combust burn field (族群 C): DOT + perception range halved inside its radius. */
interface CombustField {
  position: Vector2;
  radius: number;
  remainingMs: number;
  tickAccumMs: number;
  visual: Phaser.GameObjects.Graphics;
  blocks: GlitchBlock[];
  blockPhaseMs: number[];
  dissolving: boolean;
  dissolve: DissolveState;
  affectedEnemyIds: Set<string>;
}

/** Shared by echo (AOE stall) and resonate (post-knockback stun): speed forced to 0. */
interface StunEntry {
  enemyId: string;
  remainingMs: number;
  tag: 'echo' | 'resonate' | 'kindle';
  bracketVisual: Phaser.GameObjects.Graphics | null;
}

/** A pending abyss aperture-closing burst at the player position (族群 H, rare). */
interface AbyssBurst {
  position: Vector2;
  remainingMs: number;
  visual: Phaser.GameObjects.Graphics;
  blocks: GlitchBlock[];
}

// ---------------------------------------------------------------------------
// Constants
// ---------------------------------------------------------------------------

const SOLIDIFY_DURATION_MS = 4000;

const DELAY_DURATION_MS = 8000;
const DELAY_RADIUS = 64; // 2 tiles

const ERODE_DURATION_MS = 12000;
const ERODE_RADIUS = 128; // 4 tiles
/** erode: "移速-40%" for every state except CHASE, which uses the patrol/chase speed
 * ratio below instead (CSV: "追击速度降为巡逻级别"). */
const ERODE_SPEED_MULT = 0.6;
/** erode: "感知范围-30%" */
const ERODE_PERCEPTION_MULT = 0.7;

const RETROGRADE_DURATION_MS = 12000;
const RETROGRADE_GHOST_INTERVAL_MS = 2000;
/** Above the vision mask's depth (50, `rift-scene.ts` DEPTH.visionMask) so the mark
 * actually punches through fog, per "即使目标离开视野其位置仍以残影显示" - at the old
 * depth (24, under the mask) it was invisible in the dark exactly when it mattered. */
const RETROGRADE_VISUAL_DEPTH = 60;

const KINDLE_DURATION_MS = 3000;
const KINDLE_RADIUS = 64; // 2 tiles

const STITCH_DURATION_MS = 10000;

const EXPAND_ACTIVE_MS = 3000;
const EXPAND_STIFFNESS_MS = 1000;

const SCATTER_COOLDOWN_MS = 15000;
const SCATTER_FILL_RATE_MULT = 0.70; // 30% slower

/** A6: block-cluster tuning by rarity (spec A3-4's table). Kept here rather than in
 * `constants.ts` since these are VFX-only knobs, not gameplay numbers. */
const RARITY_VFX = {
  common: { count: 5, sizeMin: 4, sizeMax: 8, alpha: 0.16 },
  fine: { count: 8, sizeMin: 6, sizeMax: 10, alpha: 0.2 },
  rare: { count: 13, sizeMin: 8, sizeMax: 12, alpha: 0.25 },
} as const;

// ---------------------------------------------------------------------------
// ToolSystem
// ---------------------------------------------------------------------------

export class ToolSystem {
  private scene!: Phaser.Scene;
  private loadout: (Contaminant | null)[] = [];
  private getPlayerPos!: () => Vector2;
  private getEnemies!: () => readonly EnemyView[];
  /** expand (族群 G, A1 exception): the one tool allowed to touch the player sprite's own
   * alpha directly, for the "数据稀释" dim during its active phase. */
  private getPlayerSprite?: () => Phaser.GameObjects.Image | undefined;
  private setPlayerCollision?: (enabled: boolean) => void;
  private setPlayerInput?: (enabled: boolean) => void;
  private getCollectedNodes?: () => readonly Vector2[];
  private addKindling?: (n: number) => void;

  // Slice 5 (T1/T2): AI-facing overrides, reached through AISystem's setters.
  private setEnemySpeedMultiplier?: (enemyId: string, mult: number) => void;
  private setEnemyMovementLocked?: (enemyId: string, locked: boolean) => void;
  private setEnemyPerceptionMultiplier?: (enemyId: string, mult: number) => void;
  private reverseEnemyPatrol?: (enemyId: string) => void;
  private forceEnemyReturn?: (enemyId: string) => void;
  private knockbackEnemy?: (enemyId: string, dx: number, dy: number) => void;
  private setDecoyPosition?: (pos: Vector2 | null) => void;
  // T7 rewire: the 8 Slice 4 tools' AI-facing overrides, same shape as the block above.
  private setEnemyEscalationSuppressed?: (enemyId: string, suppressed: boolean) => void;
  private forceEnemyAlert?: (enemyId: string) => void;
  private demoteEnemyAlertLevel?: (enemyId: string) => void;
  private setEnemyDetectionFillRateMult?: (enemyId: string, mult: number) => void;
  private setHearingSuppressed?: (active: boolean) => void;
  // Slice 5: combat/chaos-facing overrides.
  private damageEnemy?: (enemyId: string, amount: number) => void;
  private showAbyssReveal?: (
    enemyPositions: readonly Vector2[],
    nodePositions: readonly Vector2[],
    durationMs: number,
  ) => void;
  private getKindlingPositions?: () => readonly Vector2[];
  private boostChaosRate?: (mult: number, durationMs: number) => void;
  private reduceChaosRate?: (mult: number, durationMs: number) => void;

  // Active effects
  private freezeEffects: FreezeEffect[] = [];
  private delayDevices: DelayDevice[] = [];
  private erodeZones: ErodeZone[] = [];
  private retrogradeMarks: RetrogradeMark[] = [];
  private kindleZones: KindleZone[] = [];
  private stitchBarriers: StitchBarrier[] = [];
  private expandEffect: ExpandEffect | null = null;

  // Slice 5 (T1) active effects
  private compressAnchors: CompressAnchor[] = [];
  private mirrorDecoys: MirrorDecoy[] = [];
  private readonly mirrorDecoyMarkers = new Map<string, MirrorDecoyMarker>();
  private resonateStrings: ResonateString[] = [];
  private overwriteMarks: OverwriteMark[] = [];
  private combustFields: CombustField[] = [];
  private stunnedEnemies: StunEntry[] = [];
  private abyssBursts: AbyssBurst[] = [];

  /** A4 主标示: shared "bad pixel dims with the enemy's real perception multiplier"
   * indicator, fed by every perception-affecting effect below. */
  private indicators!: EnemyPerceptionIndicators;

  // Passive state
  private scatterCooldownMs = 0;
  private scatterTriggersRemaining = 0;
  private muffleTriggersRemaining = 0;
  private siphonTriggersRemaining = 0;
  private scatterActive = false;
  private muffleEquipped = false;
  private siphonEquipped = false;
  /** abyss 10s map reveal — not the 150ms burst VFX. */
  private abyssRevealRemainingMs = 0;
  /** siphon's 5s chaos-rate cut. */
  private siphonEffectRemainingMs = 0;

  // Stitch placement state (two-click)
  private stitchPendingPoint: Vector2 | null = null;
  private stitchPendingVisual: Phaser.GameObjects.Graphics | null = null;
  // Resonate placement state (two-click, same convention as stitch)
  private resonatePendingPoint: Vector2 | null = null;
  private resonatePendingVisual: Phaser.GameObjects.Graphics | null = null;

  /** Bound once so create()/destroy() across scene restarts add/remove the same reference. */
  private readonly onEnemyKilled = (payload: { enemyId: string; position: { x: number; y: number } }): void => {
    this.handleEnemyKilledForSiphon(payload.enemyId);
  };

  // scatter (T7 rewire): enemies currently carrying its fill-rate multiplier, so the
  // matching ENEMY_LOST_PLAYER can release exactly them.
  private readonly scatterSuppressedEnemyIds = new Set<string>();
  private readonly onEnemyAlert = (payload: { enemyId: string; alertLevel: 'suspicious' | 'alert' | 'chase' }): void => {
    if (payload.alertLevel === 'suspicious') this.notifyEnemySuspicious(payload.enemyId);
  };
  private readonly onEnemyLostPlayer = (payload: { enemyId: string }): void => {
    if (this.scatterSuppressedEnemyIds.delete(payload.enemyId)) {
      this.setEnemyDetectionFillRateMult?.(payload.enemyId, 1);
    }
  };

  create(
    scene: Phaser.Scene,
    loadout: (Contaminant | null)[],
    getPlayerPos: () => Vector2,
    getEnemies: () => readonly EnemyView[],
    options?: {
      getPlayerSprite?: () => Phaser.GameObjects.Image | undefined;
      setPlayerCollision?: (enabled: boolean) => void;
      setPlayerInput?: (enabled: boolean) => void;
      getCollectedNodes?: () => readonly Vector2[];
      addKindling?: (n: number) => void;
      // Slice 5 (T1/T2)
      setEnemySpeedMultiplier?: (enemyId: string, mult: number) => void;
      setEnemyMovementLocked?: (enemyId: string, locked: boolean) => void;
      setEnemyPerceptionMultiplier?: (enemyId: string, mult: number) => void;
      reverseEnemyPatrol?: (enemyId: string) => void;
      forceEnemyReturn?: (enemyId: string) => void;
      knockbackEnemy?: (enemyId: string, dx: number, dy: number) => void;
      setDecoyPosition?: (pos: Vector2 | null) => void;
      damageEnemy?: (enemyId: string, amount: number) => void;
      showAbyssReveal?: (
        enemyPositions: readonly Vector2[],
        nodePositions: readonly Vector2[],
        durationMs: number,
      ) => void;
      getKindlingPositions?: () => readonly Vector2[];
      boostChaosRate?: (mult: number, durationMs: number) => void;
      reduceChaosRate?: (mult: number, durationMs: number) => void;
      // T7 rewire (Slice 4 tools)
      setEnemyEscalationSuppressed?: (enemyId: string, suppressed: boolean) => void;
      forceEnemyAlert?: (enemyId: string) => void;
      demoteEnemyAlertLevel?: (enemyId: string) => void;
      setEnemyDetectionFillRateMult?: (enemyId: string, mult: number) => void;
      setHearingSuppressed?: (active: boolean) => void;
    },
  ): void {
    this.scene = scene;
    this.loadout = loadout;
    this.getPlayerPos = getPlayerPos;
    this.getEnemies = getEnemies;
    this.getPlayerSprite = options?.getPlayerSprite;
    this.setPlayerCollision = options?.setPlayerCollision;
    this.setPlayerInput = options?.setPlayerInput;
    this.getCollectedNodes = options?.getCollectedNodes;
    this.addKindling = options?.addKindling;
    this.setEnemySpeedMultiplier = options?.setEnemySpeedMultiplier;
    this.setEnemyMovementLocked = options?.setEnemyMovementLocked;
    this.setEnemyPerceptionMultiplier = options?.setEnemyPerceptionMultiplier;
    this.reverseEnemyPatrol = options?.reverseEnemyPatrol;
    this.forceEnemyReturn = options?.forceEnemyReturn;
    this.knockbackEnemy = options?.knockbackEnemy;
    this.setDecoyPosition = options?.setDecoyPosition;
    this.damageEnemy = options?.damageEnemy;
    this.showAbyssReveal = options?.showAbyssReveal;
    this.getKindlingPositions = options?.getKindlingPositions;
    this.boostChaosRate = options?.boostChaosRate;
    this.reduceChaosRate = options?.reduceChaosRate;
    this.setEnemyEscalationSuppressed = options?.setEnemyEscalationSuppressed;
    this.forceEnemyAlert = options?.forceEnemyAlert;
    this.demoteEnemyAlertLevel = options?.demoteEnemyAlertLevel;
    this.setEnemyDetectionFillRateMult = options?.setEnemyDetectionFillRateMult;
    this.setHearingSuppressed = options?.setHearingSuppressed;

    this.cleanupVisuals();
    this.indicators?.destroy();
    this.indicators = new EnemyPerceptionIndicators(scene);

    this.freezeEffects = [];
    this.delayDevices = [];
    this.erodeZones = [];
    this.retrogradeMarks = [];
    this.kindleZones = [];
    this.stitchBarriers = [];
    this.expandEffect = null;
    this.stitchPendingPoint = null;
    this.stitchPendingVisual = null;
    this.compressAnchors = [];
    this.mirrorDecoys = [];
    this.mirrorDecoyMarkers.clear();
    this.resonateStrings = [];
    this.overwriteMarks = [];
    this.combustFields = [];
    this.stunnedEnemies = [];
    this.abyssBursts = [];
    this.resonatePendingPoint = null;
    this.resonatePendingVisual = null;
    this.scatterSuppressedEnemyIds.clear();

    // Initialize passive tools from loadout
    this.scatterTriggersRemaining = 0;
    this.muffleTriggersRemaining = 0;
    this.siphonTriggersRemaining = 0;
    this.scatterActive = false;
    this.muffleEquipped = false;
    this.siphonEquipped = false;
    this.scatterCooldownMs = 0;
    this.abyssRevealRemainingMs = 0;
    this.siphonEffectRemainingMs = 0;

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
      } else if (contaminant.type === 'siphon') {
        this.siphonTriggersRemaining = contaminant.usesRemaining;
        this.siphonEquipped = true;
      }
    }

    eventBus.off(GameEvent.ENEMY_KILLED, this.onEnemyKilled);
    eventBus.on(GameEvent.ENEMY_KILLED, this.onEnemyKilled);
    // scatter (T7 rewire): ENEMY_ALERT is how the AI announces "just went SUSPICIOUS";
    // ENEMY_LOST_PLAYER is the matching close of that episode (contract E1/E2).
    eventBus.off(GameEvent.ENEMY_ALERT, this.onEnemyAlert);
    eventBus.on(GameEvent.ENEMY_ALERT, this.onEnemyAlert);
    eventBus.off(GameEvent.ENEMY_LOST_PLAYER, this.onEnemyLostPlayer);
    eventBus.on(GameEvent.ENEMY_LOST_PLAYER, this.onEnemyLostPlayer);
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

    // Each effect validates its target/placement first, then calls this gate exactly
    // once before changing gameplay or creating its visible effect.
    return this.applyEffect(contaminant.type, () => this.commitToolUse(slotIndex));
  }

  private commitToolUse(slotIndex: number): boolean {
    const contaminant = this.loadout[slotIndex];
    if (!contaminant || contaminant.stage !== 'tool' || contaminant.usesRemaining <= 0) return false;
    const result = contaminantSystem.tryConsumeTool(contaminant.id);
    if (!result.ok) return false;
    if (result.value.broken) this.loadout[slotIndex] = null;
    return true;
  }

  private commitPassiveUse(type: ContaminantType): boolean {
    const slot = this.loadout.findIndex(item => item?.type === type && item.stage === 'tool' && item.usesRemaining > 0);
    return slot >= 0 && this.commitToolUse(slot);
  }

  /** Per-frame update of active tool effects. */
  update(deltaMs: number): void {
    this.updateFreezes(deltaMs);
    this.updateDelayDevices(deltaMs);
    this.updateErodeZones(deltaMs);
    this.updateRetrogradeMarks(deltaMs);
    this.updateKindleZones(deltaMs);
    this.updateStitchBarriers(deltaMs);
    this.updateExpandEffect(deltaMs);
    this.updatePassives(deltaMs);

    // Slice 5 (T1)
    this.updateCompressAnchors(deltaMs);
    this.updateMirrorDecoys(deltaMs);
    this.updateResonateStrings(deltaMs);
    this.updateOverwriteMarks(deltaMs);
    this.updateCombustFields(deltaMs);
    this.updateStunnedEnemies(deltaMs);
    this.updateAbyssBursts(deltaMs);
    this.updateAbyssReveal(deltaMs);
    this.updateSiphonEffect(deltaMs);

    // A4 主标示: redraw every registered "perception dimmed" indicator last, once all of
    // the above have had a chance to set/clear this frame's sources.
    const enemies = this.getEnemies();
    this.indicators.update(deltaMs, (id) => enemies.find((e) => e.getId() === id)?.getPosition());
  }

  /** Get remaining uses for a slot (for HUD). Returns 0 if slot is empty. */
  getSlotUses(slotIndex: number): number {
    return this.loadout[slotIndex]?.usesRemaining ?? 0;
  }

  /** Get the tool type for a slot (for HUD). Returns null if empty. */
  getSlotType(slotIndex: number): ContaminantType | null {
    return this.loadout[slotIndex]?.type ?? null;
  }

  /**
   * Read-only: in-progress timed tool effects (not dissolving / not cooldown).
   * Same type merges; remainingMs is the max across instances.
   * Types with `toolDurationMs === 0` are omitted. Scatter's 15s CD is omitted.
   */
  getActiveTimedEffects(): { type: ContaminantType; remainingMs: number }[] {
    const maxByType = new Map<ContaminantType, number>();
    const consider = (type: ContaminantType, remainingMs: number, ended: boolean): void => {
      if (ended || remainingMs <= 0) return;
      if ((CONTAMINANT_DATA[type]?.toolDurationMs ?? 0) === 0) return;
      const prev = maxByType.get(type) ?? 0;
      if (remainingMs > prev) maxByType.set(type, remainingMs);
    };

    for (const e of this.freezeEffects) consider('solidify', e.remainingMs, e.dissolving);
    for (const d of this.delayDevices) consider('delay', d.remainingMs, d.dissolving);
    for (const z of this.erodeZones) consider('erode', z.remainingMs, z.dissolving);
    for (const m of this.retrogradeMarks) consider('retrograde', m.remainingMs, m.collapsing);
    for (const z of this.kindleZones) consider('kindle', z.remainingMs, z.dissolving);
    for (const b of this.stitchBarriers) consider('stitch', b.remainingMs, b.dissolving);
    if (this.expandEffect?.phase === 'active') {
      consider('expand', this.expandEffect.remainingMs, false);
    }
    for (const a of this.compressAnchors) consider('compress', a.remainingMs, a.dissolving);
    for (const d of this.mirrorDecoys) consider('mirror', d.remainingMs, d.shattering);
    for (const s of this.resonateStrings) consider('resonate', s.remainingMs, s.dissolving);
    for (const m of this.overwriteMarks) consider('overwrite', m.remainingMs, false);
    for (const f of this.combustFields) consider('combust', f.remainingMs, f.dissolving);
    for (const s of this.stunnedEnemies) {
      if (s.tag === 'echo') consider('echo', s.remainingMs, false);
      else if (s.tag === 'kindle') consider('kindle', s.remainingMs, false);
      else if (s.tag === 'resonate') consider('resonate', s.remainingMs, false);
    }
    consider('abyss', this.abyssRevealRemainingMs, false);
    consider('siphon', this.siphonEffectRemainingMs, false);

    return [...maxByType.entries()].map(([type, remainingMs]) => ({ type, remainingMs }));
  }

  /** Notify tool system that an enemy entered suspicious (for scatter passive). */
  notifyEnemySuspicious(enemyId: string): void {
    if (!this.scatterActive || this.scatterTriggersRemaining <= 0 || this.scatterCooldownMs > 0) return;
    if (!this.commitPassiveUse('scatter')) return;
    this.scatterTriggersRemaining--;
    this.scatterActive = this.scatterTriggersRemaining > 0;
    this.scatterCooldownMs = SCATTER_COOLDOWN_MS;
    this.scatterSuppressedEnemyIds.add(enemyId);
    this.setEnemyDetectionFillRateMult?.(enemyId, SCATTER_FILL_RATE_MULT);
  }

  /** AI must suppress this discovery only if consumption succeeds. */
  notifyProximityAvoid(): boolean {
    if (!this.muffleEquipped || this.muffleTriggersRemaining <= 0) return false;
    if (!this.commitPassiveUse('muffle')) {
      this.setHearingSuppressed?.(false);
      return false;
    }
    this.muffleTriggersRemaining--;
    this.muffleEquipped = this.muffleTriggersRemaining > 0;
    // Clear immediately: another enemy can test discovery during this same AI update.
    this.setHearingSuppressed?.(this.muffleEquipped);
    return true;
  }

  reset(): void {
    this.cleanupVisuals();
    this.releaseAllOverrides();
    this.indicators?.destroy();
    this.indicators = new EnemyPerceptionIndicators(this.scene);
    this.freezeEffects = [];
    this.delayDevices = [];
    this.erodeZones = [];
    this.retrogradeMarks = [];
    this.kindleZones = [];
    this.stitchBarriers = [];
    this.expandEffect = null;
    this.stitchPendingPoint = null;
    this.stitchPendingVisual = null;
    this.compressAnchors = [];
    this.mirrorDecoys = [];
    this.mirrorDecoyMarkers.clear();
    this.resonateStrings = [];
    this.overwriteMarks = [];
    this.combustFields = [];
    this.stunnedEnemies = [];
    this.abyssBursts = [];
    this.abyssRevealRemainingMs = 0;
    this.siphonEffectRemainingMs = 0;
    this.resonatePendingPoint = null;
    this.resonatePendingVisual = null;
  }

  destroy(): void {
    this.cleanupVisuals();
    this.releaseAllOverrides();
    this.indicators?.destroy();
    eventBus.off(GameEvent.ENEMY_KILLED, this.onEnemyKilled);
    eventBus.off(GameEvent.ENEMY_ALERT, this.onEnemyAlert);
    eventBus.off(GameEvent.ENEMY_LOST_PLAYER, this.onEnemyLostPlayer);
  }

  /**
   * Best-effort release of every AI override this system may have applied - both the
   * Slice 5 setters and the Slice 4 (T7 rewire) ones - for `reset()` (mid-run restart)
   * and `destroy()` (scene shutdown). Enemies that no longer exist by the time this runs
   * are silently skipped by `AISystem`'s setters - safe to call unconditionally.
   */
  private releaseAllOverrides(): void {
    for (const anchor of this.compressAnchors) {
      for (const id of anchor.affectedEnemyIds) {
        this.setEnemyMovementLocked?.(id, false);
        this.setEnemySpeedMultiplier?.(id, 1);
      }
    }
    for (const field of this.combustFields) {
      for (const id of field.affectedEnemyIds) this.setEnemyPerceptionMultiplier?.(id, 1);
    }
    for (const mark of this.overwriteMarks) this.setEnemyPerceptionMultiplier?.(mark.enemyId, 1);
    for (const stunned of this.stunnedEnemies) this.setEnemySpeedMultiplier?.(stunned.enemyId, 1);
    if (this.mirrorDecoys.length > 0) this.setDecoyPosition?.(null);

    // T7 rewire (Slice 4 tools)
    for (const effect of this.freezeEffects) {
      this.setEnemySpeedMultiplier?.(effect.enemyId, 1);
      this.setEnemyPerceptionMultiplier?.(effect.enemyId, 1);
    }
    for (const device of this.delayDevices) {
      for (const id of device.affectedEnemyIds) this.setEnemyEscalationSuppressed?.(id, false);
    }
    for (const zone of this.erodeZones) {
      for (const id of zone.affectedEnemyIds) {
        this.setEnemySpeedMultiplier?.(id, 1);
        this.setEnemyPerceptionMultiplier?.(id, 1);
      }
    }
    for (const id of this.scatterSuppressedEnemyIds) this.setEnemyDetectionFillRateMult?.(id, 1);
    this.scatterSuppressedEnemyIds.clear();
    this.setHearingSuppressed?.(false);
  }

  // ------------------------------------------------------------------ internal

  private applyEffect(type: ContaminantType, commit: () => boolean): boolean {
    switch (type) {
      case 'solidify': return this.applySolidify(commit);
      case 'delay': return this.applyDelay(commit);
      case 'erode': return this.applyErode(commit);
      case 'ruminate': return this.applyRuminate(commit);
      case 'retrograde': return this.applyRetrograde(commit);
      case 'kindle': return this.applyKindle(commit);
      case 'stitch': return this.applyStitch(commit);
      case 'expand': return this.applyExpand(commit);
      // Slice 5 (T1)
      case 'compress': return this.applyCompress(commit);
      case 'mirror': return this.applyMirror(commit);
      case 'echo': return this.applyEcho(commit);
      case 'resonate': return this.applyResonate(commit);
      case 'overwrite': return this.applyOverwrite(commit);
      case 'abyss': return this.applyAbyss(commit);
      case 'combust': return this.applyCombust(commit);
      default: return false;
    }
  }

  // =========================================================================
  // 族群 A — 定点凝滞 (solidify)
  // =========================================================================

  private applySolidify(commit: () => boolean): boolean {
    const playerPos = this.getPlayerPos();
    const enemies = this.getEnemies();

    // Find nearest enemy that is not already frozen
    let nearest: EnemyView | null = null;
    let minDist = Infinity;

    for (const enemy of enemies) {
      if (this.freezeEffects.some((effect) => effect.enemyId === enemy.getId())) continue;
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
    if (!commit()) return false;

    const id = nearest.getId();
    // "无法移动或感知": speed 0 stops it, perception range 0 makes every raycast fail
    // (perceive() gates both sight and hearing range on this same multiplier).
    this.setEnemySpeedMultiplier?.(id, 0);
    this.setEnemyPerceptionMultiplier?.(id, 0);
    this.indicators.set(id, 'solidify', 0, false);

    // 施放瞬间 + 持续期: a jagged crystal outline (棱角分明, never a smooth circle) that
    // stays put for the freeze's duration, only breathing in alpha.
    const rng = mulberry32(hashSeed(id));
    const polygon = buildJaggedPolygon(14, rng);
    const g = this.scene.add.graphics().setDepth(26);
    renderPolygonOutline(g, nearest.getPosition(), polygon, CONTAM_COLD, 0.6, 2);

    this.freezeEffects.push({
      enemyId: id,
      remainingMs: SOLIDIFY_DURATION_MS,
      polygon,
      lastPos: { ...nearest.getPosition() },
      visual: g,
      dissolving: false,
      dissolveBlocks: [],
      dissolve: createDissolveState(2, 90),
    });

    return true;
  }

  private updateFreezes(deltaMs: number): void {
    for (let i = this.freezeEffects.length - 1; i >= 0; i--) {
      const effect = this.freezeEffects[i]!;
      const enemy = this.getEnemies().find((e) => e.getId() === effect.enemyId);

      if (!effect.dissolving) {
        effect.remainingMs -= deltaMs;

        if (enemy) {
          effect.lastPos = { ...enemy.getPosition() };
          // 结冰=零运动: outline itself never moves, only alpha breathes (1.5-2s period).
          const breath = 0.5 + Math.sin(effect.remainingMs * 0.0035) * 0.1 + 0.1;
          renderPolygonOutline(effect.visual, effect.lastPos, effect.polygon, CONTAM_COLD, breath, 2);
        }

        if (effect.remainingMs <= 0) {
          // "解冻后立即进入警戒状态": thaw, then wake up already searching.
          this.setEnemySpeedMultiplier?.(effect.enemyId, 1);
          this.setEnemyPerceptionMultiplier?.(effect.enemyId, 1);
          this.forceEnemyAlert?.(effect.enemyId);
          this.indicators.clear(effect.enemyId, 'solidify');

          // 结束消散: crack into blocks and shed them in 2 discrete steps, not a fade.
          effect.dissolving = true;
          const rng = mulberry32(hashSeed(effect.enemyId) ^ 0x9e3779b9);
          effect.dissolveBlocks = buildGlitchBlockField(16, 6, 4, 8, rng);
        }
        continue;
      }

      // Dissolving: crystal has already released its gameplay override; only the crack
      // animation remains, anchored to the enemy's last known position.
      const anchor = enemy ? enemy.getPosition() : effect.lastPos;
      const { jitter, done } = stepDissolve(effect.dissolve, effect.dissolveBlocks, deltaMs);
      const drawAnchor = { x: anchor.x + jitter.x, y: anchor.y + jitter.y };
      renderGlitchBlockField(effect.visual, drawAnchor, effect.dissolveBlocks, CONTAM_COLD, 0.5);

      if (done) {
        effect.visual.destroy();
        this.freezeEffects.splice(i, 1);
      }
    }
  }

  // =========================================================================
  // 族群 C — 领域覆写 (delay / erode / kindle / combust) + compress
  // =========================================================================

  private applyDelay(commit: () => boolean): boolean {
    if (!commit()) return false;
    const pos = { ...this.getPlayerPos() };
    const rng = mulberry32(hashSeed(`delay-${this.scene.time.now}`));
    const tier = RARITY_VFX.fine;
    const blocks = buildGlitchBlockField(DELAY_RADIUS, tier.count, tier.sizeMin, tier.sizeMax, rng);

    const g = this.scene.add.graphics().setDepth(10);
    renderGlitchBlockField(g, pos, blocks, CONTAM_COLD, tier.alpha);

    this.delayDevices.push({
      position: pos,
      radius: DELAY_RADIUS,
      remainingMs: DELAY_DURATION_MS,
      visual: g,
      blocks,
      dissolving: false,
      dissolve: createDissolveState(2, 80),
      affectedEnemyIds: new Set(),
    });

    return true;
  }

  private updateDelayDevices(deltaMs: number): void {
    const enemies = this.getEnemies();

    for (let i = this.delayDevices.length - 1; i >= 0; i--) {
      const device = this.delayDevices[i]!;

      if (!device.dissolving) {
        device.remainingMs -= deltaMs;

        // "范围内(2格)所有敌人的感知状态被冻结": continuous while inside, released on
        // leaving the radius or on expiry - never a one-shot trigger.
        const stillIn = new Set<string>();
        if (device.remainingMs > 0) {
          for (const enemy of enemies) {
            const ep = enemy.getPosition();
            const dx = ep.x - device.position.x;
            const dy = ep.y - device.position.y;
            if (dx * dx + dy * dy > device.radius * device.radius) continue;
            const id = enemy.getId();
            stillIn.add(id);
            if (!device.affectedEnemyIds.has(id)) {
              this.setEnemyEscalationSuppressed?.(id, true);
              this.indicators.set(id, 'delay', 1, true);
            }
          }
        }
        for (const id of device.affectedEnemyIds) {
          if (!stillIn.has(id)) {
            this.setEnemyEscalationSuppressed?.(id, false);
            this.indicators.clear(id, 'delay');
          }
        }
        device.affectedEnemyIds = stillIn;

        // 持续期: "时间被拉长" reads as the slowest breathing cycle of the whole tool set.
        const breath = 0.7 + Math.sin(device.remainingMs * 0.0022) * 0.3;
        for (const b of device.blocks) b.alphaMult = breath;
        renderGlitchBlockField(device.visual, device.position, device.blocks, CONTAM_COLD, RARITY_VFX.fine.alpha);

        if (device.remainingMs <= 0) {
          for (const id of device.affectedEnemyIds) {
            this.setEnemyEscalationSuppressed?.(id, false);
            this.indicators.clear(id, 'delay');
          }
          device.affectedEnemyIds.clear();
          device.dissolving = true;
        }
        continue;
      }

      const { jitter, done } = stepDissolve(device.dissolve, device.blocks, deltaMs);
      const anchor = { x: device.position.x + jitter.x, y: device.position.y + jitter.y };
      renderGlitchBlockField(device.visual, anchor, device.blocks, CONTAM_COLD, RARITY_VFX.fine.alpha);

      if (done) {
        device.visual.destroy();
        this.delayDevices.splice(i, 1);
      }
    }
  }

  private applyErode(commit: () => boolean): boolean {
    if (!commit()) return false;
    const pos = { ...this.getPlayerPos() };
    const rng = mulberry32(hashSeed(`erode-${this.scene.time.now}`));
    const tier = RARITY_VFX.rare;
    // "边界在向外蚕食": blocks live in the outer 20% ring, not spread across the whole area.
    const blocks = buildGlitchBlockField(ERODE_RADIUS, tier.count, tier.sizeMin, tier.sizeMax, rng).map((b) => {
      const dist = Math.hypot(b.dx, b.dy) || 1;
      const targetDist = ERODE_RADIUS * (0.8 + (dist / ERODE_RADIUS) * 0.2);
      const scale = targetDist / dist;
      return { ...b, dx: b.dx * scale, dy: b.dy * scale };
    });

    const g = this.scene.add.graphics().setDepth(10);
    renderGlitchBlockField(g, pos, blocks, CONTAM_MID, tier.alpha);

    this.erodeZones.push({
      position: pos,
      radius: ERODE_RADIUS,
      remainingMs: ERODE_DURATION_MS,
      visual: g,
      blocks,
      dissolving: false,
      dissolve: createDissolveState(3, 80),
      affectedEnemyIds: new Set(),
    });

    return true;
  }

  private updateErodeZones(deltaMs: number): void {
    const enemies = this.getEnemies();
    // "追击速度降为巡逻级别": a ratio, not a flat -40%, so a chaser inside the zone
    // moves at exactly patrol speed regardless of how much faster it chases normally.
    for (let i = this.erodeZones.length - 1; i >= 0; i--) {
      const zone = this.erodeZones[i]!;

      if (!zone.dissolving) {
        zone.remainingMs -= deltaMs;

        // Continuous zone effect, recomputed every frame (not just on enter) because which
        // multiplier applies depends on the enemy's *current* state, which can change
        // while it is still standing inside the same zone.
        const stillIn = new Set<string>();
        if (zone.remainingMs > 0) {
          for (const enemy of enemies) {
            const ep = enemy.getPosition();
            const dx = ep.x - zone.position.x;
            const dy = ep.y - zone.position.y;
            if (dx * dx + dy * dy > zone.radius * zone.radius) continue;
            const id = enemy.getId();
            stillIn.add(id);
            const profile = ENEMY_DATA[enemy.getRole()];
            const chaseToPatrol =
              profile.chaseSpeed > 0 ? profile.patrolSpeed / profile.chaseSpeed : ERODE_SPEED_MULT;
            const speedMult = enemy.getState() === AIState.CHASE ? chaseToPatrol : ERODE_SPEED_MULT;
            this.setEnemySpeedMultiplier?.(id, speedMult);
            this.setEnemyPerceptionMultiplier?.(id, ERODE_PERCEPTION_MULT);
            this.indicators.set(id, 'erode', ERODE_PERCEPTION_MULT, false);
          }
        }
        for (const id of zone.affectedEnemyIds) {
          if (!stillIn.has(id)) {
            this.setEnemySpeedMultiplier?.(id, 1);
            this.setEnemyPerceptionMultiplier?.(id, 1);
            this.indicators.clear(id, 'erode');
          }
        }
        zone.affectedEnemyIds = stillIn;

        // 边缘环闪烁: each block flickers on its own phase, independent of the others.
        for (const b of zone.blocks) {
          const phase = (zone.remainingMs + b.dx * 3 + b.dy * 3) * 0.006;
          b.alphaMult = 0.5 + Math.sin(phase) * 0.5;
        }
        renderGlitchBlockField(zone.visual, zone.position, zone.blocks, CONTAM_MID, RARITY_VFX.rare.alpha);

        if (zone.remainingMs <= 0) {
          for (const id of zone.affectedEnemyIds) {
            this.setEnemySpeedMultiplier?.(id, 1);
            this.setEnemyPerceptionMultiplier?.(id, 1);
            this.indicators.clear(id, 'erode');
          }
          zone.affectedEnemyIds.clear();
          zone.dissolving = true;
        }
        continue;
      }

      const { jitter, done } = stepDissolve(zone.dissolve, zone.blocks, deltaMs);
      const anchor = { x: zone.position.x + jitter.x, y: zone.position.y + jitter.y };
      renderGlitchBlockField(zone.visual, anchor, zone.blocks, CONTAM_MID, RARITY_VFX.rare.alpha);

      if (done) {
        zone.visual.destroy();
        this.erodeZones.splice(i, 1);
      }
    }
  }

  private applyKindle(commit: () => boolean): boolean {
    if (!commit()) return false;
    const pos = { ...this.getPlayerPos() };
    const rng = mulberry32(hashSeed(`kindle-${this.scene.time.now}`));
    const tier = RARITY_VFX.common;
    const blocks = buildGlitchBlockField(KINDLE_RADIUS, tier.count, tier.sizeMin, tier.sizeMax, rng);

    const g = this.scene.add.graphics().setDepth(10);
    renderGlitchBlockField(g, pos, blocks, CONTAM_ANCIENT, tier.alpha);

    this.kindleZones.push({
      position: pos,
      radius: KINDLE_RADIUS,
      remainingMs: KINDLE_DURATION_MS,
      visual: g,
      blocks,
      dissolving: false,
      dissolve: createDissolveState(2, 70),
      affectedEnemyIds: new Set(),
    });

    return true;
  }

  private updateKindleZones(deltaMs: number): void {
    const enemies = this.getEnemies();

    for (let i = this.kindleZones.length - 1; i >= 0; i--) {
      const zone = this.kindleZones[i]!;

      if (!zone.dissolving) {
        zone.remainingMs -= deltaMs;

        // "巡逻者原地困惑且追击者失去目标锁定": one-shot per enemy on first entry, not a
        // continuous zone debuff - a chaser that loses its lock does not need to keep
        // losing it every frame it happens to still be standing in the blast radius.
        if (zone.remainingMs > 0) {
          for (const enemy of enemies) {
            const id = enemy.getId();
            if (zone.affectedEnemyIds.has(id)) continue;
            const ep = enemy.getPosition();
            const dx = ep.x - zone.position.x;
            const dy = ep.y - zone.position.y;
            if (dx * dx + dy * dy > zone.radius * zone.radius) continue;

            zone.affectedEnemyIds.add(id);
            if (enemy.getState() === AIState.CHASE) this.forceEnemyAlert?.(id);
            else this.stunEnemy(id, KINDLE_DURATION_MS, 'kindle');
          }
        }

        // "高频不规则闪烁" - kindle's own random flicker, not a fixed period.
        for (const b of zone.blocks) b.alphaMult = 0.4 + Math.random() * 0.8;
        renderGlitchBlockField(zone.visual, zone.position, zone.blocks, CONTAM_ANCIENT, RARITY_VFX.common.alpha);

        if (zone.remainingMs <= 0) zone.dissolving = true;
        continue;
      }

      const { jitter, done } = stepDissolve(zone.dissolve, zone.blocks, deltaMs);
      const anchor = { x: zone.position.x + jitter.x, y: zone.position.y + jitter.y };
      renderGlitchBlockField(zone.visual, anchor, zone.blocks, CONTAM_ANCIENT, RARITY_VFX.common.alpha);

      if (done) {
        zone.visual.destroy();
        this.kindleZones.splice(i, 1);
      }
    }
  }

  // --- Compress (gravity anchor: speed -60% + movement direction locked in radius) ---

  private applyCompress(commit: () => boolean): boolean {
    if (!commit()) return false;
    // CSV: "在指定位置放置重力锚" - no aim cursor exists yet, so (like kindle/erode/delay)
    // the anchor lands at the player's current position.
    const pos = { ...this.getPlayerPos() };
    const def = CONTAMINANT_DATA.compress;
    const radius = def.toolRangePx;
    const rng = mulberry32(hashSeed(`compress-${this.scene.time.now}`));
    const tier = RARITY_VFX.fine;
    const blocks = buildGlitchBlockField(radius, tier.count, tier.sizeMin, tier.sizeMax, rng);

    const g = this.scene.add.graphics().setDepth(10);
    renderGlitchBlockField(g, pos, blocks, CONTAM_DEEP, tier.alpha);

    this.compressAnchors.push({
      position: pos,
      radius,
      remainingMs: def.toolDurationMs,
      visual: g,
      bracketVisual: this.scene.add.graphics().setDepth(26),
      blocks,
      dissolving: false,
      dissolve: createDissolveState(2, 80),
      affectedEnemyIds: new Set(),
    });
    return true;
  }

  private updateCompressAnchors(deltaMs: number): void {
    const enemies = this.getEnemies();
    const mult = GAME_CONSTANTS.TOOLS.COMPRESS_SPEED_MULT;

    for (let i = this.compressAnchors.length - 1; i >= 0; i--) {
      const anchor = this.compressAnchors[i]!;

      if (!anchor.dissolving) {
        anchor.remainingMs -= deltaMs;

        const stillIn = new Set<string>();
        if (anchor.remainingMs > 0) {
          for (const enemy of enemies) {
            const ep = enemy.getPosition();
            const dx = ep.x - anchor.position.x;
            const dy = ep.y - anchor.position.y;
            if (dx * dx + dy * dy > anchor.radius * anchor.radius) continue;
            const id = enemy.getId();
            stillIn.add(id);
            if (!anchor.affectedEnemyIds.has(id)) {
              this.setEnemyMovementLocked?.(id, true);
              this.setEnemySpeedMultiplier?.(id, mult);
            }
          }
        }
        // "对已脱离范围的敌人无效" - release exactly the ones that left (or the anchor expired).
        for (const id of anchor.affectedEnemyIds) {
          if (!stillIn.has(id)) {
            this.setEnemyMovementLocked?.(id, false);
            this.setEnemySpeedMultiplier?.(id, 1);
          }
        }
        anchor.affectedEnemyIds = stillIn;

        // "密度趋向无穷大": blocks drift toward the anchor centre then respawn at the rim.
        for (const b of anchor.blocks) {
          b.dx *= 0.985;
          b.dy *= 0.985;
          if (Math.hypot(b.dx, b.dy) < 6) {
            const angle = Math.random() * Math.PI * 2;
            b.dx = Math.cos(angle) * anchor.radius * 0.9;
            b.dy = Math.sin(angle) * anchor.radius * 0.9;
          }
        }
        renderGlitchBlockField(anchor.visual, anchor.position, anchor.blocks, CONTAM_DEEP, RARITY_VFX.fine.alpha);

        // A4 副标示: 6x6 bracket under every enemy this anchor currently has locked.
        anchor.bracketVisual.clear();
        for (const id of anchor.affectedEnemyIds) {
          const enemy = enemies.find((e) => e.getId() === id);
          if (!enemy) continue;
          const ep = enemy.getPosition();
          drawBracketMarker(anchor.bracketVisual, { x: ep.x, y: ep.y + 16 }, CONTAM_DEEP, 0.85);
        }

        if (anchor.remainingMs <= 0) {
          for (const id of anchor.affectedEnemyIds) {
            this.setEnemyMovementLocked?.(id, false);
            this.setEnemySpeedMultiplier?.(id, 1);
          }
          anchor.affectedEnemyIds.clear();
          anchor.bracketVisual.clear();
          anchor.dissolving = true;
        }
        continue;
      }

      const { jitter, done } = stepDissolve(anchor.dissolve, anchor.blocks, deltaMs);
      const dAnchor = { x: anchor.position.x + jitter.x, y: anchor.position.y + jitter.y };
      renderGlitchBlockField(anchor.visual, dAnchor, anchor.blocks, CONTAM_DEEP, RARITY_VFX.fine.alpha);

      if (done) {
        anchor.visual.destroy();
        anchor.bracketVisual.destroy();
        this.compressAnchors.splice(i, 1);
      }
    }
  }

  // =========================================================================
  // 族群 B — 单体标记 (retrograde / overwrite)
  // =========================================================================

  private applyRetrograde(commit: () => boolean): boolean {
    const playerPos = this.getPlayerPos();
    const enemies = this.getEnemies();

    // Find nearest enemy not already marked
    let nearest: EnemyView | null = null;
    let minDist = Infinity;

    for (const enemy of enemies) {
      if (this.retrogradeMarks.some((mark) => mark.enemyId === enemy.getId())) continue;
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
    if (!commit()) return false;

    const g = this.scene.add.graphics().setDepth(RETROGRADE_VISUAL_DEPTH);

    this.retrogradeMarks.push({
      enemyId: nearest.getId(),
      remainingMs: RETROGRADE_DURATION_MS,
      ghostTimer: 0,
      ghostPositions: [],
      ghostAlphas: [],
      visual: g,
      collapsing: false,
      collapseFade: createStepFade(2, 90),
    });

    return true;
  }

  private updateRetrogradeMarks(deltaMs: number): void {
    for (let i = this.retrogradeMarks.length - 1; i >= 0; i--) {
      const mark = this.retrogradeMarks[i]!;
      const enemy = this.getEnemies().find((e) => e.getId() === mark.enemyId);

      if (!mark.collapsing) {
        mark.remainingMs -= deltaMs;
        mark.ghostTimer += deltaMs;

        // Record ghost positions every 2s
        if (mark.ghostTimer >= RETROGRADE_GHOST_INTERVAL_MS && enemy) {
          mark.ghostTimer = 0;
          mark.ghostPositions.push({ ...enemy.getPosition() });
          mark.ghostAlphas.push(0.3);
          // Keep max 6 ghost positions
          if (mark.ghostPositions.length > 6) {
            mark.ghostPositions.shift();
            mark.ghostAlphas.shift();
          }
        }

        mark.visual.clear();
        if (enemy) {
          const ep = enemy.getPosition();
          // Current position: contam-mid diamond outline (棱角分明, not a filled circle)
          mark.visual.lineStyle(1.5, CONTAM_MID, 0.7);
          mark.visual.beginPath();
          mark.visual.moveTo(ep.x, ep.y - 8);
          mark.visual.lineTo(ep.x + 6, ep.y);
          mark.visual.lineTo(ep.x, ep.y + 8);
          mark.visual.lineTo(ep.x - 6, ep.y);
          mark.visual.closePath();
          mark.visual.strokePath();

          // Ghost trail: fading metal-light *squares* (was a non-compliant grey circle)
          for (let j = 0; j < mark.ghostPositions.length; j++) {
            const gp = mark.ghostPositions[j]!;
            const alpha = 0.15 + (j / mark.ghostPositions.length) * 0.2;
            mark.visual.fillStyle(GHOST_COLOR, alpha);
            mark.visual.fillRect(gp.x - 4, gp.y - 4, 8, 8);
          }

          // Dotted line from last ghost to current
          if (mark.ghostPositions.length > 0) {
            const lastGhost = mark.ghostPositions[mark.ghostPositions.length - 1]!;
            mark.visual.lineStyle(1, GHOST_COLOR, 0.3);
            mark.visual.beginPath();
            mark.visual.moveTo(lastGhost.x, lastGhost.y);
            mark.visual.lineTo(ep.x, ep.y);
            mark.visual.strokePath();
          }
        }

        if (mark.remainingMs <= 0) mark.collapsing = true;
        continue;
      }

      // 结束消散: diamond collapses in 2 discrete alpha steps, ghost trail left as-is
      // (each ghost already fades on its own independent lifetime, per spec).
      const { alpha, done } = stepFade(mark.collapseFade, deltaMs);
      if (enemy) {
        mark.visual.clear();
        const ep = enemy.getPosition();
        mark.visual.lineStyle(1.5, CONTAM_MID, 0.7 * alpha);
        mark.visual.beginPath();
        mark.visual.moveTo(ep.x, ep.y - 8);
        mark.visual.lineTo(ep.x + 6, ep.y);
        mark.visual.lineTo(ep.x, ep.y + 8);
        mark.visual.lineTo(ep.x - 6, ep.y);
        mark.visual.closePath();
        mark.visual.strokePath();
      }

      if (done) {
        mark.visual.destroy();
        this.retrogradeMarks.splice(i, 1);
      }
    }
  }

  private applyOverwrite(commit: () => boolean): boolean {
    const playerPos = this.getPlayerPos();
    const enemies = this.getEnemies();

    let nearest: EnemyView | null = null;
    let minDist = Infinity;
    for (const enemy of enemies) {
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
    if (!commit()) return false;

    const id = nearest.getId();
    const def = CONTAMINANT_DATA.overwrite;

    this.reverseEnemyPatrol?.(id);
    this.forceEnemyReturn?.(id);
    this.setEnemyPerceptionMultiplier?.(id, GAME_CONSTANTS.TOOLS.OVERWRITE_PERCEPTION_MULT);
    // A4 主标示 (perception -50% dims the shared indicator, same rule every other
    // perception-affecting tool uses) + A4 副标示 (patrol reversal has no perception
    // component of its own, so it gets the bracket per the spec's explicit list).
    this.indicators.set(id, 'overwrite', GAME_CONSTANTS.TOOLS.OVERWRITE_PERCEPTION_MULT, false);

    const existing = this.overwriteMarks.find((m) => m.enemyId === id);
    if (existing) {
      existing.remainingMs = def.toolDurationMs;
    } else {
      this.overwriteMarks.push({
        enemyId: id,
        remainingMs: def.toolDurationMs,
        bracketVisual: this.scene.add.graphics().setDepth(26),
      });
    }

    // 施放瞬间: "双重闪击" - 2 frames, 80ms, contam-peak, harder/brighter than every other tool's flash.
    const ep = { ...nearest.getPosition() };
    const flash = this.scene.add.graphics().setDepth(27);
    const drawFlash = (alpha: number): void => {
      flash.clear();
      flash.fillStyle(CONTAM_PEAK, alpha);
      flash.fillRect(ep.x - 6, ep.y - 6, 12, 12);
      flash.fillRect(ep.x - 10, ep.y - 2, 20, 4);
    };
    drawFlash(0.9);
    this.scene.time.delayedCall(40, () => drawFlash(0));
    this.scene.time.delayedCall(80, () => drawFlash(0.7));
    this.scene.time.delayedCall(120, () => flash.destroy());

    return true;
  }

  private updateOverwriteMarks(deltaMs: number): void {
    for (let i = this.overwriteMarks.length - 1; i >= 0; i--) {
      const m = this.overwriteMarks[i]!;
      m.remainingMs -= deltaMs;

      const enemy = this.getEnemies().find((e) => e.getId() === m.enemyId);
      m.bracketVisual.clear();
      if (enemy && m.remainingMs > 0) {
        const ep = enemy.getPosition();
        drawBracketMarker(m.bracketVisual, { x: ep.x, y: ep.y + 16 }, CONTAM_PEAK, 0.85);
      }

      if (m.remainingMs <= 0) {
        this.setEnemyPerceptionMultiplier?.(m.enemyId, 1);
        this.indicators.clear(m.enemyId, 'overwrite');
        m.bracketVisual.destroy();
        this.overwriteMarks.splice(i, 1);
      }
    }
  }

  // =========================================================================
  // 族群 D — 连线贯穿 (stitch / resonate)
  // =========================================================================

  private applyStitch(commit: () => boolean): boolean {
    const pos = { ...this.getPlayerPos() };

    if (!this.stitchPendingPoint) {
      // First click: set point A
      this.stitchPendingPoint = pos;
      const g = this.scene.add.graphics().setDepth(10);
      g.fillStyle(CONTAM_MID, 0.7);
      g.fillRect(pos.x - 3, pos.y - 3, 6, 6);
      this.stitchPendingVisual = g;
      // Auto-cleanup after a few seconds if no second click
      this.scene.time.delayedCall(5000, () => {
        g.destroy();
        if (this.stitchPendingPoint === pos) {
          this.stitchPendingPoint = null;
          this.stitchPendingVisual = null;
        }
      });
      return false; // Don't consume a use for the first click
    }

    if (!commit()) return false;

    // Second click: set point B, create barrier
    const pointA = this.stitchPendingPoint;
    const pointB = pos;
    this.stitchPendingPoint = null;
    this.stitchPendingVisual?.destroy();
    this.stitchPendingVisual = null;

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
      dissolving: false,
      fade: createStepFade(2, 90),
    });

    return true;
  }

  private updateStitchBarriers(deltaMs: number): void {
    const enemies = this.getEnemies();

    for (let i = this.stitchBarriers.length - 1; i >= 0; i--) {
      const barrier = this.stitchBarriers[i]!;

      if (!barrier.dissolving) {
        barrier.remainingMs -= deltaMs;

        // "对同一敌人仅触发一次": crossing detection, one shot per enemy per barrier.
        for (const enemy of enemies) {
          const id = enemy.getId();
          if (barrier.affectedEnemyIds.has(id)) continue;
          const ep = enemy.getPosition();
          if (!this.isNearLine(ep, barrier.pointA, barrier.pointB, 12)) continue;
          barrier.affectedEnemyIds.add(id);
          this.demoteEnemyAlertLevel?.(id);
        }

        this.drawStitchLine(barrier.visual, barrier.pointA, barrier.pointB, 1);

        if (barrier.remainingMs <= 0) barrier.dissolving = true;
        continue;
      }

      const { alpha, done } = stepFade(barrier.fade, deltaMs);
      this.drawStitchLine(barrier.visual, barrier.pointA, barrier.pointB, alpha);

      if (done) {
        barrier.visual.destroy();
        this.stitchBarriers.splice(i, 1);
      }
    }
  }

  /** "缝隙光" 语法: a static line with perpendicular tick marks every 12-16px (针脚),
   * not a glowing laser - stitch is a physical seam, not an energy beam. */
  private drawStitchLine(g: Phaser.GameObjects.Graphics, a: Vector2, b: Vector2, alphaMult: number): void {
    g.clear();
    g.lineStyle(2, CONTAM_MID, 0.55 * alphaMult);
    g.beginPath();
    g.moveTo(a.x, a.y);
    g.lineTo(b.x, b.y);
    g.strokePath();

    const dx = b.x - a.x;
    const dy = b.y - a.y;
    const len = Math.hypot(dx, dy) || 1;
    const ux = dx / len;
    const uy = dy / len;
    const nx = -uy;
    const ny = ux;
    const spacing = 14;
    const stitchCount = Math.max(0, Math.floor(len / spacing));
    g.lineStyle(1, CONTAM_MID, 0.6 * alphaMult);
    for (let i = 1; i <= stitchCount; i++) {
      const t = (i * spacing) / len;
      if (t >= 1) break;
      const px = a.x + dx * t;
      const py = a.y + dy * t;
      g.beginPath();
      g.moveTo(px - nx * 2, py - ny * 2);
      g.lineTo(px + nx * 2, py + ny * 2);
      g.strokePath();
    }

    g.fillStyle(CONTAM_MID, 0.7 * alphaMult);
    g.fillRect(a.x - 2, a.y - 2, 4, 4);
    g.fillRect(b.x - 2, b.y - 2, 4, 4);
  }

  private applyResonate(commit: () => boolean): boolean {
    const pos = { ...this.getPlayerPos() };
    const def = CONTAMINANT_DATA.resonate;

    if (!this.resonatePendingPoint) {
      // First press: point A. Mirrors stitch's two-click convention exactly.
      this.resonatePendingPoint = pos;
      const g = this.scene.add.graphics().setDepth(10);
      g.fillStyle(CONTAM_GLOW, 0.7);
      g.fillRect(pos.x - 3, pos.y - 3, 6, 6);
      this.resonatePendingVisual = g;
      this.scene.time.delayedCall(5000, () => {
        g.destroy();
        if (this.resonatePendingPoint === pos) {
          this.resonatePendingPoint = null;
          this.resonatePendingVisual = null;
        }
      });
      return false; // Does not consume a use, same as stitch's first click.
    }

    if (!commit()) return false;

    const pointA = this.resonatePendingPoint;
    const pointB = pos;
    this.resonatePendingPoint = null;
    this.resonatePendingVisual?.destroy();
    this.resonatePendingVisual = null;

    const g = this.scene.add.graphics().setDepth(10);
    this.resonateStrings.push({
      pointA,
      pointB,
      remainingMs: def.toolDurationMs,
      affectedEnemyIds: new Set(),
      visual: g,
      dissolving: false,
      fade: createStepFade(2, 90),
    });
    return true;
  }

  private updateResonateStrings(deltaMs: number): void {
    const enemies = this.getEnemies();

    for (let i = this.resonateStrings.length - 1; i >= 0; i--) {
      const s = this.resonateStrings[i]!;

      if (!s.dissolving) {
        s.remainingMs -= deltaMs;

        for (const enemy of enemies) {
          const id = enemy.getId();
          if (s.affectedEnemyIds.has(id)) continue;
          const ep = enemy.getPosition();
          if (!this.isNearLine(ep, s.pointA, s.pointB, 12)) continue;

          s.affectedEnemyIds.add(id);
          this.applyResonateKnockback(enemy, s.pointA, s.pointB);
        }

        this.drawResonateLine(s.visual, s.pointA, s.pointB, s.remainingMs, 1);

        if (s.remainingMs <= 0) s.dissolving = true;
        continue;
      }

      const { alpha, done } = stepFade(s.fade, deltaMs);
      this.drawResonateLine(s.visual, s.pointA, s.pointB, s.remainingMs, alpha);

      if (done) {
        s.visual.destroy();
        this.resonateStrings.splice(i, 1);
      }
    }
  }

  /** "共振读作物理振动": a sine-perturbed polyline rather than a straight beam. Frequency
   * rises as `remainingMs` falls, so the tripwire visibly "tightens" toward expiry. */
  private drawResonateLine(g: Phaser.GameObjects.Graphics, a: Vector2, b: Vector2, remainingMs: number, alphaMult: number): void {
    g.clear();
    const dx = b.x - a.x;
    const dy = b.y - a.y;
    const len = Math.hypot(dx, dy) || 1;
    const ux = dx / len;
    const uy = dy / len;
    const nx = -uy;
    const ny = ux;
    const segments = Math.max(4, Math.round(len / 8));
    const freqHz = 1.5 + (1 - Phaser.Math.Clamp(remainingMs / 10000, 0, 1)) * 2.5;
    const t = this.scene.time.now * 0.001;

    g.lineStyle(2, CONTAM_GLOW, 0.6 * alphaMult);
    g.beginPath();
    for (let i = 0; i <= segments; i++) {
      const frac = i / segments;
      const wobble = Math.sin(frac * Math.PI * 4 + t * freqHz * Math.PI * 2) * 2.5;
      const px = a.x + dx * frac + nx * wobble;
      const py = a.y + dy * frac + ny * wobble;
      if (i === 0) g.moveTo(px, py);
      else g.lineTo(px, py);
    }
    g.strokePath();

    g.fillStyle(CONTAM_BRIGHT, 0.85 * alphaMult);
    g.fillRect(a.x - 2, a.y - 2, 4, 4);
    g.fillRect(b.x - 2, b.y - 2, 4, 4);
  }

  /** Pushes `enemy` away from the tripwire, to whichever side it was already on, and stuns it. */
  private applyResonateKnockback(enemy: EnemyView, pointA: Vector2, pointB: Vector2): void {
    const ep = enemy.getPosition();
    const lineDx = pointB.x - pointA.x;
    const lineDy = pointB.y - pointA.y;
    let normalX = -lineDy;
    let normalY = lineDx;
    const len = Math.hypot(normalX, normalY) || 1;
    normalX /= len;
    normalY /= len;

    const side = (ep.x - pointA.x) * normalX + (ep.y - pointA.y) * normalY;
    if (side < 0) {
      normalX = -normalX;
      normalY = -normalY;
    }

    const dist = GAME_CONSTANTS.TOOLS.RESONATE_KNOCKBACK_PX;
    this.knockbackEnemy?.(enemy.getId(), normalX * dist, normalY * dist);
    this.stunEnemy(enemy.getId(), GAME_CONSTANTS.TOOLS.RESONATE_STUN_MS, 'resonate');
  }

  // =========================================================================
  // 族群 E — 即时脉冲 (echo)
  // =========================================================================

  private applyEcho(commit: () => boolean): boolean {
    if (!commit()) return false;
    const pos = { ...this.getPlayerPos() };
    const def = CONTAMINANT_DATA.echo;
    const radius = def.toolRangePx;
    const enemies = this.getEnemies();

    for (const enemy of enemies) {
      const ep = enemy.getPosition();
      const dx = ep.x - pos.x;
      const dy = ep.y - pos.y;
      if (dx * dx + dy * dy > radius * radius) continue;

      const id = enemy.getId();
      this.reverseEnemyPatrol?.(id);
      this.stunEnemy(id, def.toolDurationMs, 'echo');
    }

    // "回响震荡" - the whole effect is the expansion itself, built from a polygon of
    // short segments (the one circle-shape exception A3-1 grants), never `strokeCircle`.
    const g = this.scene.add.graphics().setDepth(10);
    const startedAt = this.scene.time.now;
    const durationMs = 350;
    const step = (): void => {
      const elapsed = this.scene.time.now - startedAt;
      const frac = Phaser.Math.Clamp(elapsed / durationMs, 0, 1);
      const r = radius * (0.15 + frac * 0.85);
      renderPolylineRing(g, pos, r, 14, CONTAM_GLOW, 1 - frac * 0.3);
      if (frac >= 1) {
        g.destroy();
        return;
      }
      this.scene.time.delayedCall(16, step);
    };
    step();

    return true;
  }

  // =========================================================================
  // 族群 F — 分身诱饵 (mirror)
  // =========================================================================

  private applyMirror(commit: () => boolean): boolean {
    if (!commit()) return false;
    const pos = { ...this.getPlayerPos() };
    const def = CONTAMINANT_DATA.mirror;

    const g = this.scene.add.graphics().setDepth(24);
    // 施放瞬间: 2-3 frame "mirror-flicker" - alternating hard-edge flashes before settling
    // into the decoy, reading as "this is not the real body".
    this.drawMirrorDecoy(g, pos, 0.9);
    this.scene.time.delayedCall(40, () => this.drawMirrorDecoy(g, pos, 0.3));
    this.scene.time.delayedCall(80, () => this.drawMirrorDecoy(g, pos, 0.85));

    this.mirrorDecoys.push({
      position: pos,
      remainingMs: def.toolDurationMs,
      visual: g,
      shattering: false,
      shatterBlocks: [],
      shatterDissolve: createDissolveState(1, 1),
    });
    this.setDecoyPosition?.(pos);
    return true;
  }

  private updateMirrorDecoys(deltaMs: number): void {
    const enemies = this.getEnemies();
    const contactRadiusSq = GAME_CONSTANTS.TOOLS.MIRROR_CONTACT_RADIUS ** 2;

    for (let i = this.mirrorDecoys.length - 1; i >= 0; i--) {
      const decoy = this.mirrorDecoys[i]!;

      if (decoy.shattering) {
        const { jitter, done } = stepDissolve(decoy.shatterDissolve, decoy.shatterBlocks, deltaMs);
        const anchor = { x: decoy.position.x + jitter.x, y: decoy.position.y + jitter.y };
        renderGlitchBlockField(decoy.visual, anchor, decoy.shatterBlocks, CONTAM_BRIGHT, 0.5);
        if (done) {
          decoy.visual.destroy();
          this.mirrorDecoys.splice(i, 1);
        }
        continue;
      }

      decoy.remainingMs -= deltaMs;

      let shattered = false;
      for (const enemy of enemies) {
        const ep = enemy.getPosition();
        const dx = ep.x - decoy.position.x;
        const dy = ep.y - decoy.position.y;
        if (dx * dx + dy * dy <= contactRadiusSq) {
          shattered = true;
          break;
        }
      }

      if (shattered) {
        // "被敌人接触碎裂" - explodes into 4-6 blocks and clears fast (150ms), distinct
        // from the slower 2-step fade a natural expiry gets below.
        const rng = mulberry32(hashSeed(`mirror-shatter-${this.scene.time.now}`));
        decoy.shatterBlocks = buildGlitchBlockField(14, 5, 4, 8, rng);
        decoy.shatterDissolve = createDissolveState(2, 75);
        decoy.shattering = true;
        continue;
      }

      if (decoy.remainingMs <= 0) {
        // Normal expiry: 2-step discrete fade of the rect outline (not a shatter).
        decoy.visual.destroy();
        this.mirrorDecoys.splice(i, 1);
        continue;
      }

      const pulse = 0.55 + Math.sin(decoy.remainingMs * 0.006) * 0.3;
      this.drawMirrorDecoy(decoy.visual, decoy.position, pulse);
    }

    // Point AISystem at whichever decoy is newest/still alive; clear once none remain.
    const active = this.mirrorDecoys[this.mirrorDecoys.length - 1];
    this.setDecoyPosition?.(active && !active.shattering ? active.position : null);

    this.updateMirrorDecoyMarkers();
  }

  /**
   * A4 副标示: draws the 6x6px bracket marker on every enemy `AISystem` currently reports
   * as sighting the decoy (`EnemyView.isTargetingDecoy()`) instead of the real player -
   * "视野内敌人优先对镜像产生怀疑,忽略真身方向" made visible. Gated on a live (non-
   * shattering) decoy existing so a marker never outlives the decoy it points at, even if
   * an enemy's own targeting flag is momentarily stale (it only updates on a fresh
   * sighting tick - see `state-machine.ts`'s `sightTargetPos()`).
   */
  private updateMirrorDecoyMarkers(): void {
    const decoyActive = this.mirrorDecoys.some((d) => !d.shattering);
    const enemies = this.getEnemies();
    const targetingIds = new Set(
      decoyActive ? enemies.filter((e) => e.isTargetingDecoy()).map((e) => e.getId()) : [],
    );

    for (const [id, marker] of this.mirrorDecoyMarkers) {
      if (!targetingIds.has(id)) {
        marker.visual.destroy();
        this.mirrorDecoyMarkers.delete(id);
      }
    }

    for (const enemy of enemies) {
      const id = enemy.getId();
      if (!targetingIds.has(id)) continue;
      let marker = this.mirrorDecoyMarkers.get(id);
      if (!marker) {
        marker = { visual: this.scene.add.graphics().setDepth(26) };
        this.mirrorDecoyMarkers.set(id, marker);
      }
      const ep = enemy.getPosition();
      marker.visual.clear();
      drawBracketMarker(marker.visual, { x: ep.x, y: ep.y + 16 }, CONTAM_BRIGHT, 0.85);
    }
  }

  private drawMirrorDecoy(g: Phaser.GameObjects.Graphics, pos: Vector2, alpha: number): void {
    g.clear();
    g.lineStyle(1.5, CONTAM_BRIGHT, alpha);
    g.strokeRect(pos.x - 9, pos.y - 9, 18, 18);
    g.fillStyle(CONTAM_BRIGHT, alpha * 0.22);
    g.fillRect(pos.x - 9, pos.y - 9, 18, 18);
  }

  // =========================================================================
  // 族群 G — 自身相变 (expand) - the one tool whose effect is on the player's own body.
  // =========================================================================

  private applyExpand(commit: () => boolean): boolean {
    if (this.expandEffect) return false; // Already active
    if (!commit()) return false;

    const g = this.scene.add.graphics().setDepth(30);
    this.expandEffect = {
      remainingMs: EXPAND_ACTIVE_MS,
      stiffnessMs: EXPAND_STIFFNESS_MS,
      phase: 'active',
      visual: g,
      jitterPhase: 0,
    };

    // Disable collision
    this.setPlayerCollision?.(false);

    // A1's one sanctioned exception: dim the player sprite's own alpha for the
    // "数据稀释" active phase (spec A5 族群G). 0.55 sits mid-band of the spec's 0.5-0.6.
    this.getPlayerSprite?.()?.setAlpha(0.55);

    // 施放瞬间: a 1-2 frame "bulge" overlay at the player's position (an approximation of
    // "sprite 边缘像素向外膨胀溢出" - Graphics has no per-pixel access to the sprite's own
    // texture), then settle into the active-phase dither below.
    const pos = this.getPlayerPos();
    g.fillStyle(CONTAM_COLD, 0.5);
    g.fillRect(pos.x - 11, pos.y - 11, 22, 22);
    this.scene.time.delayedCall(70, () => {
      if (this.expandEffect) this.expandEffect.visual.clear();
    });

    return true;
  }

  private updateExpandEffect(deltaMs: number): void {
    if (!this.expandEffect) return;
    const effect = this.expandEffect;
    const pos = this.getPlayerPos();

    if (effect.phase === 'active') {
      effect.remainingMs -= deltaMs;
      effect.jitterPhase += deltaMs;

      // "抖动" - a handful of dim pixels around the player flicker at 4-6Hz, echoing the
      //污染体坏像素 look for as long as (and only as long as) expand is active.
      effect.visual.clear();
      const dotCount = 3;
      const rng = mulberry32(Math.floor(this.scene.time.now / 160));
      for (let d = 0; d < dotCount; d++) {
        const ox = (rng() - 0.5) * 18;
        const oy = (rng() - 0.5) * 18;
        effect.visual.fillStyle(CONTAM_COLD, 0.5);
        effect.visual.fillRect(pos.x + ox - 1, pos.y + oy - 1, 2, 2);
      }

      if (effect.remainingMs <= 0) {
        // Transition to stiffness
        effect.phase = 'stiffness';
        effect.remainingMs = effect.stiffnessMs;
        // Re-enable collision, disable input
        this.setPlayerCollision?.(true);
        this.setPlayerInput?.(false);
        // "实体化" - alpha back to 1.0 the instant the dilution window ends, so the
        // stiffness phase's outline flash (below) plays against the player's normal
        // colour rather than the dimmed one (spec: "必须在效果结束后完全消失,不能有残留").
        this.getPlayerSprite?.()?.setAlpha(1);
      }
    } else {
      // Stiffness phase: one brief "re-materialising" flash, then nothing (no residue).
      effect.remainingMs -= deltaMs;
      if (effect.remainingMs > effect.stiffnessMs - 90) {
        effect.visual.clear();
        effect.visual.lineStyle(1.5, CONTAM_COLD, 0.8);
        effect.visual.strokeRect(pos.x - 10, pos.y - 10, 20, 20);
      } else if (effect.visual.alpha !== 0) {
        effect.visual.clear();
      }

      if (effect.remainingMs <= 0) {
        this.setPlayerInput?.(true);
        effect.visual.destroy();
        this.expandEffect = null;
      }
    }
  }

  // =========================================================================
  // 族群 H — 资源/情报 (ruminate / abyss)
  // =========================================================================

  private applyRuminate(commit: () => boolean): boolean {
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
    if (!commit()) return false;

    // Grant 1 kindling
    this.addKindling(1);

    // "消化=被吸入变小": a rapidly-shrinking square, not an expanding glowing pulse.
    const g = this.scene.add.graphics().setDepth(15);
    const target = { ...nearest };
    const startSize = 16;
    const startedAt = this.scene.time.now;
    const durationMs = 260;
    const step = (): void => {
      const elapsed = this.scene.time.now - startedAt;
      const frac = Phaser.Math.Clamp(elapsed / durationMs, 0, 1);
      const size = startSize * (1 - frac);
      g.clear();
      if (size > 0.5) {
        g.fillStyle(CONTAM_MID, 0.6 * (1 - frac * 0.5));
        g.fillRect(target.x - size / 2, target.y - size / 2, size, size);
      }
      if (frac >= 1) {
        g.destroy();
        return;
      }
      this.scene.time.delayedCall(16, step);
    };
    step();

    return true;
  }

  private applyAbyss(commit: () => boolean): boolean {
    if (!commit()) return false;
    const def = CONTAMINANT_DATA.abyss;
    const enemyPositions = this.getEnemies().map((e) => ({ ...e.getPosition() }));
    const nodePositions = (this.getKindlingPositions?.() ?? []).map((n) => ({ ...n }));

    this.showAbyssReveal?.(enemyPositions, nodePositions, def.toolDurationMs);
    this.abyssRevealRemainingMs = def.toolDurationMs;
    this.boostChaosRate?.(
      GAME_CONSTANTS.TOOLS.ABYSS_CHAOS_BOOST_MULT,
      GAME_CONSTANTS.TOOLS.ABYSS_CHAOS_BOOST_MS,
    );

    // 施放瞬间: "孔径闭合" - blocks collapse inward and vanish, the one effect in the
    // whole spec that starts wide and *contracts* rather than bursting outward.
    const pos = { ...this.getPlayerPos() };
    const rng = mulberry32(hashSeed(`abyss-${this.scene.time.now}`));
    const blocks = buildGlitchBlockField(28, 5, 6, 10, rng);
    const g = this.scene.add.graphics().setDepth(15);
    this.abyssBursts.push({ position: pos, remainingMs: 150, visual: g, blocks });

    return true;
  }

  private updateAbyssBursts(deltaMs: number): void {
    for (let i = this.abyssBursts.length - 1; i >= 0; i--) {
      const burst = this.abyssBursts[i]!;
      burst.remainingMs -= deltaMs;
      const frac = Phaser.Math.Clamp(1 - burst.remainingMs / 150, 0, 1);
      for (const b of burst.blocks) {
        b.alphaMult = 1 - frac;
      }
      // Contract toward the anchor as the burst plays out.
      const shrink = 1 - frac;
      const shrunk = burst.blocks.map((b) => ({ ...b, dx: b.dx * shrink, dy: b.dy * shrink }));
      renderGlitchBlockField(burst.visual, burst.position, shrunk, CONTAM_PEAK, 0.3);

      if (burst.remainingMs <= 0) {
        burst.visual.destroy();
        this.abyssBursts.splice(i, 1);
      }
    }
  }

  private updateAbyssReveal(deltaMs: number): void {
    if (this.abyssRevealRemainingMs <= 0) return;
    this.abyssRevealRemainingMs = Math.max(0, this.abyssRevealRemainingMs - deltaMs);
  }

  private updateSiphonEffect(deltaMs: number): void {
    if (this.siphonEffectRemainingMs <= 0) return;
    this.siphonEffectRemainingMs = Math.max(0, this.siphonEffectRemainingMs - deltaMs);
  }

  // =========================================================================
  // Combust (族群 C, rare): burn field: DOT + perception -50% for 8s, player immune.
  // =========================================================================

  private applyCombust(commit: () => boolean): boolean {
    if (!commit()) return false;
    const pos = { ...this.getPlayerPos() };
    const def = CONTAMINANT_DATA.combust;
    const rng = mulberry32(hashSeed(`combust-${this.scene.time.now}`));
    const tier = RARITY_VFX.rare;
    const blocks = buildGlitchBlockField(def.toolRangePx, tier.count, tier.sizeMin, tier.sizeMax, rng);
    const blockPhaseMs = blocks.map(() => Math.random() * 1500);

    const g = this.scene.add.graphics().setDepth(9);
    renderGlitchBlockField(g, pos, blocks, CONTAM_ANCIENT, tier.alpha);

    this.combustFields.push({
      position: pos,
      radius: def.toolRangePx,
      remainingMs: def.toolDurationMs,
      tickAccumMs: 0,
      visual: g,
      blocks,
      blockPhaseMs,
      dissolving: false,
      dissolve: createDissolveState(3, 90),
      affectedEnemyIds: new Set(),
    });
    return true;
  }

  private updateCombustFields(deltaMs: number): void {
    const enemies = this.getEnemies();
    const tickMs = GAME_CONSTANTS.TOOLS.COMBUST_TICK_MS;
    const perceptionMult = GAME_CONSTANTS.TOOLS.COMBUST_PERCEPTION_MULT;

    for (let i = this.combustFields.length - 1; i >= 0; i--) {
      const field = this.combustFields[i]!;

      if (!field.dissolving) {
        field.remainingMs -= deltaMs;
        field.tickAccumMs += deltaMs;

        const stillIn = new Set<string>();
        if (field.remainingMs > 0) {
          for (const enemy of enemies) {
            const ep = enemy.getPosition();
            const dx = ep.x - field.position.x;
            const dy = ep.y - field.position.y;
            if (dx * dx + dy * dy > field.radius * field.radius) continue;
            const id = enemy.getId();
            stillIn.add(id);
            if (!field.affectedEnemyIds.has(id)) {
              this.setEnemyPerceptionMultiplier?.(id, perceptionMult);
              this.indicators.set(id, 'combust', perceptionMult, false);
            }
          }
        }
        for (const id of field.affectedEnemyIds) {
          if (!stillIn.has(id)) {
            this.setEnemyPerceptionMultiplier?.(id, 1);
            this.indicators.clear(id, 'combust');
          }
        }
        field.affectedEnemyIds = stillIn;

        if (field.tickAccumMs >= tickMs) {
          field.tickAccumMs -= tickMs;
          for (const id of stillIn) this.damageEnemy?.(id, GAME_CONSTANTS.TOOLS.COMBUST_DAMAGE_PER_TICK);
        }

        // "慢速衰减-复燃循环": each block fades over 1.5s then snaps back to full, phases
        // staggered per block so the field never reads as one synchronized pulse.
        const now = this.scene.time.now;
        for (let bi = 0; bi < field.blocks.length; bi++) {
          const b = field.blocks[bi]!;
          const phase = ((now + field.blockPhaseMs[bi]!) % 1500) / 1500;
          b.alphaMult = 1 - phase;
        }
        renderGlitchBlockField(field.visual, field.position, field.blocks, CONTAM_ANCIENT, RARITY_VFX.rare.alpha);

        if (field.remainingMs <= 0) {
          for (const id of field.affectedEnemyIds) {
            this.setEnemyPerceptionMultiplier?.(id, 1);
            this.indicators.clear(id, 'combust');
          }
          field.affectedEnemyIds.clear();
          field.dissolving = true;
        }
        continue;
      }

      const { jitter, done } = stepDissolve(field.dissolve, field.blocks, deltaMs);
      const anchor = { x: field.position.x + jitter.x, y: field.position.y + jitter.y };
      renderGlitchBlockField(field.visual, anchor, field.blocks, CONTAM_ANCIENT, RARITY_VFX.rare.alpha);

      if (done) {
        field.visual.destroy();
        this.combustFields.splice(i, 1);
      }
    }
  }

  // --- Passive tools update ---

  private updatePassives(deltaMs: number): void {
    // Scatter cooldown
    if (this.scatterCooldownMs > 0) {
      this.scatterCooldownMs -= deltaMs;
    }

    // Muffle: "被动生效。装备期间不触发敌人近距感知" - global for as long as it is
    // equipped and still has charges; the per-avoidance charge spend happens in
    // `notifyProximityAvoid()`, called back through `AISystem`'s hearing-avoided listener.
    this.setHearingSuppressed?.(this.muffleEquipped && this.muffleTriggersRemaining > 0);
  }

  // --- Shared stun tracking (echo's stall + resonate's post-knockback stun + kindle's
  // confusion). One mechanism, three visual readings depending on `tag` - see A4/A5-D/E. ---

  private stunEnemy(enemyId: string, durationMs: number, tag: 'echo' | 'resonate' | 'kindle'): void {
    const existing = this.stunnedEnemies.find((s) => s.enemyId === enemyId);
    if (existing) {
      existing.remainingMs = Math.max(existing.remainingMs, durationMs);
      existing.tag = tag;
      return;
    }
    this.stunnedEnemies.push({ enemyId, remainingMs: durationMs, tag, bracketVisual: null });
    this.setEnemySpeedMultiplier?.(enemyId, 0);
    // A4: kindle/echo's confusion reads as "perception suppressed" (slow blink); resonate's
    // stun has no perception component of its own, per the spec's explicit enumeration.
    if (tag === 'echo' || tag === 'kindle') this.indicators.set(enemyId, tag, 1, true);
  }

  private updateStunnedEnemies(deltaMs: number): void {
    for (let i = this.stunnedEnemies.length - 1; i >= 0; i--) {
      const s = this.stunnedEnemies[i]!;
      s.remainingMs -= deltaMs;

      // A4 副标示: echo's stall and resonate's stun both get the shared bracket marker
      // (compress/overwrite draw their own elsewhere); kindle's confusion does not, per
      // the spec's bracket-user list (A4).
      if (s.tag === 'echo' || s.tag === 'resonate') {
        const enemy = this.getEnemies().find((e) => e.getId() === s.enemyId);
        if (enemy && s.remainingMs > 0) {
          s.bracketVisual ??= this.scene.add.graphics().setDepth(26);
          s.bracketVisual.clear();
          const ep = enemy.getPosition();
          drawBracketMarker(s.bracketVisual, { x: ep.x, y: ep.y + 16 }, CONTAM_GLOW, 0.85);
        } else {
          s.bracketVisual?.clear();
        }
      }

      if (s.remainingMs <= 0) {
        this.setEnemySpeedMultiplier?.(s.enemyId, 1);
        if (s.tag === 'echo' || s.tag === 'kindle') this.indicators.clear(s.enemyId, s.tag);
        s.bracketVisual?.destroy();
        this.stunnedEnemies.splice(i, 1);
      }
    }
  }

  // --- Siphon (passive: on kill, +2 kindling + 5s chaos rate halved) ---

  private handleEnemyKilledForSiphon(_enemyId: string): void {
    if (!this.siphonEquipped || this.siphonTriggersRemaining <= 0) return;
    if (!this.commitPassiveUse('siphon')) return;
    this.siphonTriggersRemaining--;
    this.siphonEquipped = this.siphonTriggersRemaining > 0;
    this.addKindling?.(GAME_CONSTANTS.TOOLS.SIPHON_KINDLING_GAIN);
    this.reduceChaosRate?.(
      GAME_CONSTANTS.TOOLS.SIPHON_CHAOS_REDUCTION_MULT,
      CONTAMINANT_DATA.siphon.toolDurationMs,
    );
    this.siphonEffectRemainingMs = CONTAMINANT_DATA.siphon.toolDurationMs;
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
    for (const effect of this.freezeEffects) effect.visual.destroy();
    for (const device of this.delayDevices) device.visual.destroy();
    for (const zone of this.erodeZones) zone.visual.destroy();
    for (const mark of this.retrogradeMarks) mark.visual.destroy();
    for (const zone of this.kindleZones) zone.visual.destroy();
    for (const barrier of this.stitchBarriers) barrier.visual.destroy();
    this.stitchPendingVisual?.destroy();
    this.resonatePendingVisual?.destroy();
    if (this.expandEffect) {
      this.expandEffect.visual.destroy();
      // No-residue guarantee (spec) also covers the "run reset/scene shutdown mid-effect"
      // path - not just expand's own natural expiry above.
      this.getPlayerSprite?.()?.setAlpha(1);
    }
    // Slice 5 (T1)
    for (const anchor of this.compressAnchors) {
      anchor.visual.destroy();
      anchor.bracketVisual.destroy();
    }
    for (const decoy of this.mirrorDecoys) decoy.visual.destroy();
    for (const marker of this.mirrorDecoyMarkers.values()) marker.visual.destroy();
    for (const tripwire of this.resonateStrings) tripwire.visual.destroy();
    for (const mark of this.overwriteMarks) mark.bracketVisual.destroy();
    for (const field of this.combustFields) field.visual.destroy();
    for (const stunned of this.stunnedEnemies) stunned.bracketVisual?.destroy();
    for (const burst of this.abyssBursts) burst.visual.destroy();
  }
}
