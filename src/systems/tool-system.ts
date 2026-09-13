/**
 * Sortie ability authority. Inventory commits precede effects; scenes inject world access.
 * Iteration 20's thirteen families use fixed identities and source-scoped effects:
 * freeze, suspicion delay, stale lost-sight memory, sound suppression, safe wall crossing,
 * independent visual decoys, thrown sound sources, environment release controls,
 * crossing stops, local slowdown, damage-triggered resistance and bounded snapshots.
 * Legacy branches remain readable for compatibility; the catalogue uses thirteen families.
 */

import Phaser from 'phaser';
import { captureBodyEcho, type BodyEcho, type BodyEchoSource } from '@/systems/tool-body-echo';
import { drawToolObject, drawPressure, drawFootDrag, drawSeam, drawHostRestraint } from '@/systems/tool-ground-vfx';
import { GAME_CONSTANTS } from '@/config/constants';
import { eventBus } from '@/core/event-bus';
import { CONTAMINANT_DATA } from '@/generated/contaminant-data';
import { ENEMY_DATA } from '@/generated/enemy-data';
import { contaminantSystem } from '@/systems/contaminant-system';
import { AIState, type Contaminant, type ContaminantType, type Vector2 } from '@/types/game-types';
import { GameEvent } from '@/types/events';
import { crossesToolLine, selectNearestVisibleTarget, type ToolLine, type ToolRevealSnapshot } from '@/systems/tool-targeting';
import { EnemyControlState, type EnemyControlEffect } from '@/systems/enemy-control-state';
import type { EnemyView } from '@/types/ai-types';
import type { HostToolTarget } from '@/systems/contamination-host-system';
import { createToolPresentationFrame, type ToolPresentationView } from '@/systems/tool-presentation';
import { inventoryStore } from '@/systems/inventory-store';
import { copyRuntimeVector, runtimeInteger, runtimeNumber, runtimeRecord, runtimeStrings, runtimeVector } from '@/systems/ai/runtime-validation';
import {
  CONTAM_BRIGHT,
  CONTAM_COLD,
  CONTAM_GLOW,
  CONTAM_MID,
  CONTAM_PEAK,
  EnemyPerceptionIndicators,
  GHOST_COLOR,
  buildGlitchBlockField,
  createDissolveState,
  createStepFade,
  drawBracketMarker,
  hashSeed,
  mulberry32,
  renderGlitchBlockField,
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
  echo?: BodyEcho | null;
  enemyId: string;
  remainingMs: number;
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

/** One source-scoped pause of an environment host's pending release. */
interface DelayDevice {
  hostId: string;
  position: Vector2;
  remainingMs: number;
  visual: Phaser.GameObjects.Graphics;
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

/** A single stale last-seen footprint. It never follows an invisible enemy. */
interface RetrogradeMark {
  echo?: BodyEcho | null;
  enemyId: string;
  position: Vector2;
  remainingMs: number;
  visual: Phaser.GameObjects.Graphics;
  collapsing: boolean;
  collapseFade: StepFadeState;
}

interface TrackingEpisode {
  echo?: BodyEcho | null;
  sampledAt?: number;
  lastVisiblePosition: Vector2;
  hasVisiblePosition: boolean;
  spent: boolean;
}

/** One thrown sound source; no control or damage attached. */
interface KindleZone {
  throwFrom?: Vector2;
  position: Vector2;
  radius: number;
  remainingMs: number;
  elapsedMs: number;
  pulseAccumMs: number;
  visual: Phaser.GameObjects.Graphics;
  dissolving: boolean;
}

/** A finite seam stopping each crossing enemy once (族群 D). */
interface StitchBarrier {
  tensionMs?: number;
  previousPositions: Map<string, Vector2>;
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
  echo?: BodyEcho | null;
  remainingMs: number;
  stiffnessMs: number;
  phase: 'active' | 'stiffness';
  visual: Phaser.GameObjects.Graphics;
  jitterPhase: number;
}

// --- Slice 5 (T1) active tool state ---

/** A compress gravity anchor (族群 C): movement slowdown only inside radius. */
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
  groundY?: number;
  echo?: BodyEcho | null;
  position: Vector2;
  remainingMs: number;
  visual: Phaser.GameObjects.Graphics;
  shattering: boolean;
  shatterBlocks: GlitchBlock[];
  shatterDissolve: DissolveState;
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

/** A local sign of one environment host's suppressed release. */
interface CombustField {
  hostId: string;
  position: Vector2;
  remainingMs: number;
  visual: Phaser.GameObjects.Graphics;
  blocks: GlitchBlock[];
  dissolving: boolean;
  dissolve: DissolveState;
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
  echo?: BodyEcho | null;
  position: Vector2;
  remainingMs: number;
  visual: Phaser.GameObjects.Graphics;
  blocks: GlitchBlock[];
}

// ---------------------------------------------------------------------------
// Constants
// ---------------------------------------------------------------------------



const ERODE_DURATION_MS = 12000;
const ERODE_RADIUS = 128; // 4 tiles
/** erode: "移速-40%" for every state except CHASE, which uses the patrol/chase speed
 * ratio below instead (CSV: "追击速度降为巡逻级别"). */
const ERODE_SPEED_MULT = 0.6;
/** erode: "感知范围-30%" */
const ERODE_PERCEPTION_MULT = 0.7;

// Stale information remains visible beyond the vision mask; no live target data is drawn.
const RETROGRADE_VISUAL_DEPTH = 60;

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

type ToolControl = EnemyControlEffect & { movementLocked?: boolean; escalationSuppressed?: boolean };

const RECOVERABLE_TOOLS: readonly ContaminantType[] = ['stitch', 'compress', 'kindle', 'siphon', 'muffle'];
export interface ToolRuntimeState {
  readonly version: 1;
  readonly loadoutIds: readonly (string | null)[];
  readonly elapsedMs: number;
  readonly controlSerial: number;
  readonly presentationSerial: number;
  readonly lastUseFailure: string | null;
  readonly muffle: { readonly triggersRemaining: number; readonly equipped: boolean;
    readonly episodeActive: boolean; readonly lastSignalMs: number | null };
  readonly siphon: { readonly triggersRemaining: number; readonly equipped: boolean; readonly effectRemainingMs: number };
  readonly stitches: readonly {
    readonly presentationId: number | null;
    readonly pointA: Readonly<Vector2>; readonly pointB: Readonly<Vector2>;
    readonly remainingMs: number; readonly tensionMs: number; readonly dissolving: boolean;
    readonly fade: Readonly<StepFadeState>; readonly affectedEnemyIds: readonly string[];
    readonly previousPositions: readonly { readonly enemyId: string; readonly position: Readonly<Vector2> }[];
  }[];
  readonly stitchStops: readonly { readonly enemyId: string; readonly source: string; readonly remainingMs: number }[];
  readonly anchors: readonly {
    readonly presentationId: number | null; readonly source: string | null;
    readonly position: Readonly<Vector2>; readonly radius: number; readonly remainingMs: number;
    readonly dissolving: boolean; readonly dissolve: Readonly<DissolveState>;
    readonly blocks: readonly Readonly<GlitchBlock>[]; readonly affectedEnemyIds: readonly string[];
  }[];
  readonly lures: readonly {
    readonly presentationId: number | null; readonly position: Readonly<Vector2>;
    readonly throwFrom: Readonly<Vector2> | null; readonly radius: number;
    readonly remainingMs: number; readonly elapsedMs: number; readonly pulseAccumMs: number;
  }[];
}

export function validateToolRuntimeState(value: unknown): value is ToolRuntimeState {
  if (!runtimeRecord(value) || value.version !== 1 || !Array.isArray(value.loadoutIds) || value.loadoutIds.length > 16
    || !value.loadoutIds.every(id => id === null || (typeof id === 'string' && id.length > 0))
    || new Set(value.loadoutIds.filter(id => id !== null)).size !== value.loadoutIds.filter(id => id !== null).length
    || !runtimeNumber(value.elapsedMs, 0) || !runtimeInteger(value.controlSerial) || !runtimeInteger(value.presentationSerial)
    || !(value.lastUseFailure === null || typeof value.lastUseFailure === 'string')
    || !runtimeRecord(value.muffle) || !runtimeRecord(value.siphon)
    || !runtimeInteger(value.muffle.triggersRemaining, 0, 1000) || typeof value.muffle.equipped !== 'boolean'
    || typeof value.muffle.episodeActive !== 'boolean'
    || !(value.muffle.lastSignalMs === null || runtimeNumber(value.muffle.lastSignalMs, 0, value.elapsedMs))
    || (value.muffle.episodeActive && value.muffle.lastSignalMs === null)
    || !runtimeInteger(value.siphon.triggersRemaining, 0, 1000) || typeof value.siphon.equipped !== 'boolean'
    || !runtimeNumber(value.siphon.effectRemainingMs, 0, CONTAMINANT_DATA.siphon.toolDurationMs)
    || value.muffle.equipped !== (value.muffle.triggersRemaining > 0)
    || value.siphon.equipped !== (value.siphon.triggersRemaining > 0)) return false;
  for (const key of ['stitches', 'stitchStops', 'anchors', 'lures']) {
    if (!Array.isArray(value[key]) || (value[key] as unknown[]).length > 512) return false;
  }
  const sources = new Set<string>(), presentations = new Set<number>();
  const source = (id: unknown): id is string => {
    if (typeof id !== 'string' || !/^tool:[1-9][0-9]*$/.test(id) || sources.has(id)
      || !runtimeInteger(Number(id.slice(5)), 1, value.controlSerial as number)) return false;
    sources.add(id); return true;
  };
  const presentation = (id: unknown): boolean => {
    if (id === null) return true;
    if (!runtimeInteger(id, 1, value.presentationSerial as number) || presentations.has(id)) return false;
    presentations.add(id); return true;
  };
  const lifetime = (row: Record<string, unknown>, maximum: number): boolean => typeof row.dissolving === 'boolean'
    && runtimeNumber(row.remainingMs, row.dissolving ? -Infinity : Number.MIN_VALUE, row.dissolving ? 0 : maximum);
  for (const row of value.stitches as unknown[]) {
    if (!runtimeRecord(row) || !presentation(row.presentationId) || !runtimeVector(row.pointA) || !runtimeVector(row.pointB)
      || !lifetime(row, CONTAMINANT_DATA.stitch.toolDurationMs) || !runtimeNumber(row.tensionMs, 0, 320)
      || !runtimeStrings(row.affectedEnemyIds, 2048) || !Array.isArray(row.previousPositions) || row.previousPositions.length > 2048
      || !runtimeRecord(row.fade) || !Array.isArray(row.fade.alphaSteps)
      || row.fade.alphaSteps.length !== 3 || row.fade.alphaSteps.some((alpha, i) => alpha !== 1 - i / 2)
      || !runtimeInteger(row.fade.stepIndex, 0, 1) || row.fade.stepIntervalMs !== 90 || !runtimeNumber(row.fade.timerMs, 0, 90)) return false;
    const ids = new Set<string>();
    for (const previous of row.previousPositions) {
      if (!runtimeRecord(previous) || typeof previous.enemyId !== 'string' || !previous.enemyId
        || ids.has(previous.enemyId) || !runtimeVector(previous.position)) return false;
      ids.add(previous.enemyId);
    }
  }
  for (const row of value.stitchStops as unknown[]) {
    if (!runtimeRecord(row) || typeof row.enemyId !== 'string' || !row.enemyId || !source(row.source)
      || !runtimeNumber(row.remainingMs, Number.MIN_VALUE, CONTAMINANT_DATA.stitch.toolStopMs)) return false;
  }
  for (const row of value.anchors as unknown[]) {
    if (!runtimeRecord(row) || !presentation(row.presentationId) || !(row.source === null || source(row.source))
      || !runtimeVector(row.position) || row.radius !== CONTAMINANT_DATA.compress.toolRangePx
      || !lifetime(row, CONTAMINANT_DATA.compress.toolDurationMs) || !runtimeStrings(row.affectedEnemyIds, 2048)
      || ((row.source === null || row.dissolving) && row.affectedEnemyIds.length !== 0)
      || !runtimeRecord(row.dissolve) || row.dissolve.stepsTotal !== 2 || !runtimeInteger(row.dissolve.stepsDone, 0, 1)
      || row.dissolve.stepIntervalMs !== 80 || !runtimeNumber(row.dissolve.timerMs, 0, 80)
      || typeof row.dissolve.jitterPending !== 'boolean' || !Array.isArray(row.blocks) || row.blocks.length > 8
      || !row.blocks.every(block => runtimeRecord(block) && runtimeNumber(block.dx) && runtimeNumber(block.dy)
        && runtimeNumber(block.size, 0) && runtimeNumber(block.alphaMult, 0, 1))) return false;
  }
  for (const row of value.lures as unknown[]) {
    if (!runtimeRecord(row) || !presentation(row.presentationId) || !runtimeVector(row.position)
      || !(row.throwFrom === null || runtimeVector(row.throwFrom)) || row.radius !== CONTAMINANT_DATA.kindle.toolRangePx
      || !runtimeNumber(row.remainingMs, Number.MIN_VALUE, CONTAMINANT_DATA.kindle.toolDurationMs)
      || !runtimeNumber(row.elapsedMs, 0, CONTAMINANT_DATA.kindle.toolDurationMs)
      || Math.abs(row.elapsedMs + row.remainingMs - CONTAMINANT_DATA.kindle.toolDurationMs) > 0.001
      || !runtimeNumber(row.pulseAccumMs, 0, CONTAMINANT_DATA.kindle.toolPulseIntervalMs - Number.EPSILON)) return false;
  }
  return true;
}

export class ToolSystem {
  private readonly presentation = createToolPresentationFrame();
  private presentationIds = new WeakMap<object, number>();
  private presentationSerial = 0;
  private controlSources = new Map<string, Map<string, ToolControl>>();
  private controlIds = new WeakMap<object, string>();
  private controlSerial = 0;
  private setEnemyControl?: (id: string, source: string, effect: EnemyControlEffect) => void;
  private clearEnemyControl?: (id: string, source: string) => void;
  private hasEnemyControl?: (id: string, source: string) => boolean;
  private isTargetAlive?: (id: string) => boolean;
  private isTargetVisible?: (position: Readonly<Vector2>) => boolean;
  private hasTargetLineOfSight?: (from: Readonly<Vector2>, to: Readonly<Vector2>) => boolean;
  private elapsedMs = 0;
  private muffleLastSignalMs = -Infinity;
  private muffleEpisodeActive = false;
  private readonly reclaimedNodes = new Set<string>();

  private scene!: Phaser.Scene;
  private loadout: (Contaminant | null)[] = [];
  private getPlayerPos!: () => Vector2;
  private getEnemies!: () => readonly EnemyView[];
  /** expand (族群 G, A1 exception): the one tool allowed to touch the player sprite's own
   * alpha directly, for the "数据稀释" dim during its active phase. */
  private getPlayerGroundY?: () => number;
  private getGroundVisualDepth?: (groundY: number) => number;
  private captureEnemyVisual?: (id: string) => BodyEchoSource | undefined;
  private lastUseFailure: string | null = null;
  private passiveVisual: Phaser.GameObjects.Graphics | null = null;
  private getPlayerSprite?: () => Phaser.GameObjects.Image | undefined;
  private getPhaseDestination?: () => Vector2 | null;
  private movePlayerTo?: (position: Vector2) => void;
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
  private setVisualDecoy?: (source: string, pos: Vector2 | null) => void;
  private getSoundLureDestination?: (maxDistance: number) => Vector2 | null;
  private reportSoundLure?: (position: Vector2, radius: number) => void;
  private getEnvironmentTargets?: () => readonly HostToolTarget[];
  private getStitchPlacement?: (length: number, distance: number) => ToolLine | null;
  private getRevealSnapshot?: (range: number) => ToolRevealSnapshot;
  private delayEnvironmentHazard?: (id: string, source: string, durationMs: number) => boolean;
  private suppressEnvironmentHazard?: (id: string, source: string, durationMs: number) => boolean;
  private clearEnvironmentControl?: (id: string, source: string) => void;
  private readonly trackingEpisodes = new Map<string, TrackingEpisode>();
  private retrogradeEquipped = false;
  // T7 rewire: the 8 Slice 4 tools' AI-facing overrides, same shape as the block above.
  private setEnemyEscalationSuppressed?: (enemyId: string, suppressed: boolean) => void;
  private forceEnemyAlert?: (enemyId: string) => void;
  private setEnemyDetectionFillRateMult?: (enemyId: string, mult: number) => void;
  private setHearingSuppressed?: (active: boolean) => void;
  // Slice 5: combat/chaos-facing overrides.
  private showAbyssReveal?: (
    enemyPositions: readonly Vector2[],
    nodePositions: readonly Vector2[],
    durationMs: number,
    corePositions?: readonly Vector2[],
  ) => void;

  // Active effects
  private freezeEffects: FreezeEffect[] = [];
  private delayDevices: DelayDevice[] = [];
  private erodeZones: ErodeZone[] = [];
  private retrogradeMarks: RetrogradeMark[] = [];
  private kindleZones: KindleZone[] = [];
  private stitchBarriers: StitchBarrier[] = [];
  private stitchStops: { enemyId: string; remainingMs: number; source: string }[] = [];
  private expandEffect: ExpandEffect | null = null;

  // Slice 5 (T1) active effects
  private compressAnchors: CompressAnchor[] = [];
  private mirrorDecoys: MirrorDecoy[] = [];
  private resonateStrings: ResonateString[] = [];
  private overwriteMarks: OverwriteMark[] = [];
  private combustFields: CombustField[] = [];
  private stunnedEnemies: StunEntry[] = [];
  private abyssBursts: AbyssBurst[] = [];

  /** A4 主标示: shared "bad pixel dims with the enemy's real perception multiplier"
   * indicator, fed by every perception-affecting effect below. */
  private indicators!: EnemyPerceptionIndicators;

  // Passive state
  private scatterTriggersRemaining = 0;
  private muffleTriggersRemaining = 0;
  private siphonTriggersRemaining = 0;
  private scatterActive = false;
  private muffleEquipped = false;
  private siphonEquipped = false;
  /** abyss local snapshot reveal — not the 150ms burst VFX. */
  private abyssRevealRemainingMs = 0;
  /** siphon's temporary pollution resistance. */
  private siphonEffectRemainingMs = 0;

  // Resonate placement state (two-click, same convention as stitch)
  private resonatePendingPoint: Vector2 | null = null;
  private resonatePendingVisual: Phaser.GameObjects.Graphics | null = null;

  private readonly onPlayerDamaged = (payload: { amount: number }): void => {
    if (!Number.isFinite(payload.amount) || payload.amount <= 0 || this.siphonEffectRemainingMs > 0
      || !this.siphonEquipped || this.siphonTriggersRemaining <= 0) return;
    if (!this.commitPassiveUse('siphon')) return;
    this.siphonTriggersRemaining--;
    this.siphonEquipped = this.siphonTriggersRemaining > 0;
    this.siphonEffectRemainingMs = CONTAMINANT_DATA.siphon.toolDurationMs;
  };

  // scatter (T7 rewire): enemies currently carrying its fill-rate multiplier, so the
  // matching ENEMY_LOST_PLAYER can release exactly them.
  private readonly scatterSuppressedEnemyIds = new Set<string>();
  private readonly onEnemyAlert = (payload: { enemyId: string; alertLevel: 'suspicious' | 'alert' | 'chase' }): void => {
    if (payload.alertLevel === 'suspicious') this.notifyEnemySuspicious(payload.enemyId);
    if (payload.alertLevel === 'chase') this.beginTrackingEpisode(payload.enemyId);
  };
  private readonly onEnemyLostPlayer = (payload: { enemyId: string }): void => {
    this.trackingEpisodes.get(payload.enemyId)?.echo?.destroy();
    this.trackingEpisodes.delete(payload.enemyId);
    if (this.scatterSuppressedEnemyIds.delete(payload.enemyId)) {
      this.setEnemyDetectionFillRateMult?.(payload.enemyId, 1);
    }
  };

  /** Recovery is deliberately finite: fail before a world starts losing other families. */
  private supportsRuntimeRecovery(): boolean {
    return this.loadout.every(item => !item || RECOVERABLE_TOOLS.includes(item.type))
      && !this.freezeEffects.length && !this.delayDevices.length && !this.erodeZones.length
      && !this.retrogradeMarks.length && !this.trackingEpisodes.size && !this.retrogradeEquipped
      && !this.expandEffect && !this.mirrorDecoys.length && !this.resonateStrings.length
      && !this.overwriteMarks.length && !this.combustFields.length && !this.stunnedEnemies.length
      && !this.abyssBursts.length && !this.abyssRevealRemainingMs && !this.resonatePendingPoint
      && !this.scatterActive && !this.scatterTriggersRemaining && !this.scatterSuppressedEnemyIds.size
      && !this.reclaimedNodes.size;
  }

  exportRuntimeState(): ToolRuntimeState {
    if (!this.supportsRuntimeRecovery()) throw new Error('Tool recovery supports stitch, compress, kindle, siphon and muffle only');
    const value: ToolRuntimeState = {
      version: 1, loadoutIds: this.loadout.map(item => item?.id ?? null), elapsedMs: this.elapsedMs,
      controlSerial: this.controlSerial, presentationSerial: this.presentationSerial, lastUseFailure: this.lastUseFailure,
      muffle: { triggersRemaining: this.muffleTriggersRemaining, equipped: this.muffleEquipped,
        episodeActive: this.muffleEpisodeActive, lastSignalMs: Number.isFinite(this.muffleLastSignalMs) ? this.muffleLastSignalMs : null },
      siphon: { triggersRemaining: this.siphonTriggersRemaining, equipped: this.siphonEquipped,
        effectRemainingMs: this.siphonEffectRemainingMs },
      stitches: this.stitchBarriers.map(row => ({
        presentationId: this.presentationIds.get(row) ?? null, pointA: copyRuntimeVector(row.pointA), pointB: copyRuntimeVector(row.pointB),
        remainingMs: row.remainingMs, tensionMs: row.tensionMs ?? 0, dissolving: row.dissolving,
        fade: { ...row.fade, alphaSteps: [...row.fade.alphaSteps] }, affectedEnemyIds: [...row.affectedEnemyIds],
        previousPositions: [...row.previousPositions].map(([enemyId, position]) => ({ enemyId, position: copyRuntimeVector(position) })),
      })),
      stitchStops: this.stitchStops.map(row => ({ ...row })),
      anchors: this.compressAnchors.map(row => ({
        presentationId: this.presentationIds.get(row) ?? null, source: this.controlIds.get(row) ?? null,
        position: copyRuntimeVector(row.position), radius: row.radius, remainingMs: row.remainingMs,
        dissolving: row.dissolving, dissolve: { ...row.dissolve }, blocks: row.blocks.map(block => ({ ...block })),
        affectedEnemyIds: [...row.affectedEnemyIds],
      })),
      lures: this.kindleZones.map(row => ({
        presentationId: this.presentationIds.get(row) ?? null, position: copyRuntimeVector(row.position),
        throwFrom: row.throwFrom ? copyRuntimeVector(row.throwFrom) : null, radius: row.radius,
        remainingMs: row.remainingMs, elapsedMs: row.elapsedMs, pulseAccumMs: row.pulseAccumMs,
      })),
    };
    if (!this.validateRuntimeState(value)) throw new Error('Tool state does not match its recoverable inventory');
    return value;
  }

  validateRuntimeState(value: unknown): value is ToolRuntimeState {
    if (!this.scene || !this.supportsRuntimeRecovery() || !validateToolRuntimeState(value)) return false;
    const ids = inventoryStore.getEquipment().toolIds;
    // The legacy facade pads empty slots; InventoryStore may keep an empty/trailing-short array.
    if (value.loadoutIds.length !== contaminantSystem.getSortieLoadout().length
      || value.loadoutIds.some((id, i) => id !== (ids[i] ?? null))
      || ids.slice(value.loadoutIds.length).some(id => id !== null)) return false;
    const items: Contaminant[] = [];
    for (const id of value.loadoutIds) {
      if (id === null) continue;
      const item = inventoryStore.getItem(id);
      if (item?.kind !== 'contaminant' || item.location.kind !== 'carried' || item.contaminant.stage !== 'tool'
        || item.contaminant.usesRemaining <= 0 || !RECOVERABLE_TOOLS.includes(item.contaminant.type)) return false;
      items.push(item.contaminant);
    }
    for (const type of ['muffle', 'siphon'] as const) {
      const item = items.find(candidate => candidate.type === type);
      if (value[type].triggersRemaining !== (item?.usesRemaining ?? 0)) return false;
    }
    return true;
  }

  /** AI.restoreRuntimeState must precede this; AI.finishRuntimeRestore follows it.
   * Restore stable Tool-owned sources, never an aggregate speed or a second AI clock. */
  restoreRuntimeState(value: unknown): void {
    if (!this.validateRuntimeState(value)) throw new Error('Invalid or incompatible tool runtime state');
    for (const [enemyId, sources] of this.controlSources) {
      for (const source of sources.keys()) this.clearEnemyControl?.(enemyId, source);
      this.syncControlFallback(enemyId, new Map());
    }
    this.controlSources.clear();
    this.cleanupVisuals();
    this.loadout = value.loadoutIds.map(id => {
      const item = id ? inventoryStore.getItem(id) : undefined;
      return item?.kind === 'contaminant' ? item.contaminant : null;
    });
    this.elapsedMs = value.elapsedMs; this.controlSerial = value.controlSerial; this.presentationSerial = value.presentationSerial;
    this.controlIds = new WeakMap(); this.presentationIds = new WeakMap();
    this.lastUseFailure = value.lastUseFailure;
    this.muffleTriggersRemaining = value.muffle.triggersRemaining; this.muffleEquipped = value.muffle.equipped;
    this.muffleEpisodeActive = value.muffle.episodeActive; this.muffleLastSignalMs = value.muffle.lastSignalMs ?? -Infinity;
    this.siphonTriggersRemaining = value.siphon.triggersRemaining; this.siphonEquipped = value.siphon.equipped;
    this.siphonEffectRemainingMs = value.siphon.effectRemainingMs;
    this.stitchBarriers = value.stitches.map(saved => {
      const row: StitchBarrier = {
        pointA: copyRuntimeVector(saved.pointA), pointB: copyRuntimeVector(saved.pointB), remainingMs: saved.remainingMs,
        tensionMs: saved.tensionMs, dissolving: saved.dissolving, fade: { ...saved.fade, alphaSteps: [...saved.fade.alphaSteps] },
        previousPositions: new Map(saved.previousPositions.map(previous => [previous.enemyId, copyRuntimeVector(previous.position)])),
        affectedEnemyIds: new Set(saved.affectedEnemyIds), visual: this.scene.add.graphics().setDepth(10),
      };
      if (saved.presentationId !== null) this.presentationIds.set(row, saved.presentationId);
      drawSeam(row.visual, row.pointA, row.pointB, row.dissolving ? row.fade.alphaSteps[row.fade.stepIndex]! : 1, saved.tensionMs / 320);
      return row;
    });
    this.stitchStops = value.stitchStops.map(saved => {
      const stop = { ...saved };
      this.controlIds.set(stop, stop.source);
      this.applyControl(stop.enemyId, stop.source, { movementMultiplier: 0 });
      return stop;
    });
    this.compressAnchors = value.anchors.map(saved => {
      const row: CompressAnchor = {
        position: copyRuntimeVector(saved.position), radius: saved.radius, remainingMs: saved.remainingMs,
        dissolving: saved.dissolving, dissolve: { ...saved.dissolve }, blocks: saved.blocks.map(block => ({ ...block })),
        affectedEnemyIds: new Set(saved.affectedEnemyIds), visual: this.scene.add.graphics().setDepth(10),
        bracketVisual: this.scene.add.graphics().setDepth(10),
      };
      if (saved.presentationId !== null) this.presentationIds.set(row, saved.presentationId);
      if (saved.source !== null) {
        this.controlIds.set(row, saved.source);
        for (const enemyId of saved.affectedEnemyIds) this.applyControl(enemyId, saved.source, { movementMultiplier: CONTAMINANT_DATA.compress.toolMovementMult });
      }
      drawPressure(row.visual, row.position, row.radius, row.dissolving ? .2 : Math.min(1, row.remainingMs / 500));
      return row;
    });
    this.kindleZones = value.lures.map(saved => {
      const row: KindleZone = {
        position: copyRuntimeVector(saved.position), throwFrom: saved.throwFrom ? copyRuntimeVector(saved.throwFrom) : undefined,
        radius: saved.radius, remainingMs: saved.remainingMs, elapsedMs: saved.elapsedMs, pulseAccumMs: saved.pulseAccumMs,
        visual: this.scene.add.graphics().setDepth(10), dissolving: false,
      };
      if (saved.presentationId !== null) this.presentationIds.set(row, saved.presentationId);
      this.drawSoundShell(row); // Initial lure is already in the saved AI facts; do not report it again.
      return row;
    });
    // AI restored the last published hearing flag already. In particular, a fresh
    // equipped muffle has not published it until the first real Tool.update.
    this.updateSiphonEffect(0);
  }

  create(
    scene: Phaser.Scene,
    loadout: (Contaminant | null)[],
    getPlayerPos: () => Vector2,
    getEnemies: () => readonly EnemyView[],
    options?: {
      setEnemyControl?: (id: string, source: string, effect: EnemyControlEffect) => void;
      clearEnemyControl?: (id: string, source: string) => void;
      hasEnemyControl?: (id: string, source: string) => boolean;
      isTargetAlive?: (id: string) => boolean;
      isTargetVisible?: (position: Readonly<Vector2>) => boolean;
      hasTargetLineOfSight?: (from: Readonly<Vector2>, to: Readonly<Vector2>) => boolean;
      getPlayerGroundY?: () => number;
      getGroundVisualDepth?: (groundY: number) => number;
      captureEnemyVisual?: (id: string) => BodyEchoSource | undefined;
      getPlayerSprite?: () => Phaser.GameObjects.Image | undefined;
      getPhaseDestination?: () => Vector2 | null;
      movePlayerTo?: (position: Vector2) => void;
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
      setVisualDecoy?: (source: string, pos: Vector2 | null) => void;
      getSoundLureDestination?: (maxDistance: number) => Vector2 | null;
      reportSoundLure?: (position: Vector2, radius: number) => void;
      getEnvironmentTargets?: () => readonly HostToolTarget[];
      getStitchPlacement?: (length: number, distance: number) => ToolLine | null;
      getRevealSnapshot?: (range: number) => ToolRevealSnapshot;
      delayEnvironmentHazard?: (id: string, source: string, durationMs: number) => boolean;
      suppressEnvironmentHazard?: (id: string, source: string, durationMs: number) => boolean;
      clearEnvironmentControl?: (id: string, source: string) => void;
      damageEnemy?: (enemyId: string, amount: number) => void;
      showAbyssReveal?: (
        enemyPositions: readonly Vector2[],
        nodePositions: readonly Vector2[],
        durationMs: number,
        corePositions?: readonly Vector2[],
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
    if (this.scene) this.releaseAllOverrides();
    this.scene = scene;
    this.setEnemyControl = options?.setEnemyControl;
    this.clearEnemyControl = options?.clearEnemyControl;
    this.hasEnemyControl = options?.hasEnemyControl;
    this.isTargetAlive = options?.isTargetAlive;
    this.isTargetVisible = options?.isTargetVisible;
    this.hasTargetLineOfSight = options?.hasTargetLineOfSight;
    this.elapsedMs = 0;
    this.presentationIds = new WeakMap();
    this.presentationSerial = 0;
    this.muffleLastSignalMs = -Infinity;
    this.muffleEpisodeActive = false;
    this.reclaimedNodes.clear();
    this.loadout = loadout;
    this.getPlayerPos = getPlayerPos;
    this.getEnemies = getEnemies;
    this.getPlayerSprite = options?.getPlayerSprite;
    this.captureEnemyVisual = options?.captureEnemyVisual;
    this.getGroundVisualDepth = options?.getGroundVisualDepth;
    this.getPlayerGroundY = options?.getPlayerGroundY;
    this.setPlayerCollision = options?.setPlayerCollision;
    this.getPhaseDestination = options?.getPhaseDestination;
    this.movePlayerTo = options?.movePlayerTo;
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
    this.setVisualDecoy = options?.setVisualDecoy;
    this.getSoundLureDestination = options?.getSoundLureDestination;
    this.reportSoundLure = options?.reportSoundLure;
    this.getEnvironmentTargets = options?.getEnvironmentTargets;
    this.getStitchPlacement = options?.getStitchPlacement;
    this.getRevealSnapshot = options?.getRevealSnapshot;
    this.delayEnvironmentHazard = options?.delayEnvironmentHazard;
    this.suppressEnvironmentHazard = options?.suppressEnvironmentHazard;
    this.clearEnvironmentControl = options?.clearEnvironmentControl;
    for (const episode of this.trackingEpisodes.values()) episode.echo?.destroy();
    this.trackingEpisodes.clear();
    this.retrogradeEquipped = false;
    this.showAbyssReveal = options?.showAbyssReveal;
    this.setEnemyEscalationSuppressed = options?.setEnemyEscalationSuppressed;
    this.forceEnemyAlert = options?.forceEnemyAlert;
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
    this.stitchStops = [];
    this.expandEffect = null;
    this.compressAnchors = [];
    this.mirrorDecoys = [];
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
    this.abyssRevealRemainingMs = 0;
    this.siphonEffectRemainingMs = 0;

    for (const contaminant of loadout) {
      if (!contaminant) continue;
      if (contaminant.stage !== 'tool') continue;

      const def = CONTAMINANT_DATA[contaminant.type];
      if (!def || def.toolType !== 'passive') continue;

      if (contaminant.type === 'retrograde') {
        this.retrogradeEquipped = true;
      } else if (contaminant.type === 'scatter') {
        this.scatterTriggersRemaining += contaminant.usesRemaining;
        this.scatterActive = true;
      } else if (contaminant.type === 'muffle') {
        this.muffleTriggersRemaining += contaminant.usesRemaining;
        this.muffleEquipped = true;
      } else if (contaminant.type === 'siphon') {
        this.siphonTriggersRemaining += contaminant.usesRemaining;
        this.siphonEquipped = true;
      }
    }

    eventBus.off(GameEvent.PLAYER_DAMAGED, this.onPlayerDamaged);
    eventBus.on(GameEvent.PLAYER_DAMAGED, this.onPlayerDamaged);
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
  getLastUseFailure(): string | null { return this.lastUseFailure; }

  /** Aggregate actual applied sources; model feedback must not invent a new control. */
  getEnemyRestraintPose(id: string): import('@/entities/restraint-reaction').RestraintPose {
    return {
      pressure: this.compressAnchors.some(anchor => !anchor.dissolving && anchor.affectedEnemyIds.has(id)),
      snared: this.stitchStops.some(stop => stop.enemyId === id && stop.remainingMs > 0),
    };
  }

  /**
   * The Stage reads the same committed instances and clocks as the Phaser effects.
   * IDs are presentation-only: querying this view never changes control sources,
   * random streams, timers, inventory, targeting or simulation state.
   */
  getPresentationState(): ToolPresentationView {
    const out = this.presentation;
    out.elapsedMs = this.elapsedMs;
    for (let i = 0; i < this.loadout.length; i++) out.loadoutTypes[i] = this.loadout[i]?.type ?? null;
    out.loadoutTypes.length = this.loadout.length;
    out.siphonRemainingMs = this.siphonEffectRemainingMs;
    out.siphonDurationMs = CONTAMINANT_DATA.siphon.toolDurationMs;
    out.muffleEpisodeActive = this.muffleEpisodeActive;
    let index = 0;
    for (const seam of this.stitchBarriers) {
      const row = out.seams[index] ??= { id: 0, ax: 0, ay: 0, bx: 0, by: 0,
        remainingMs: 0, durationMs: 0, tension: 0, opacity: 0 };
      row.id = this.presentationId(seam);
      row.ax = seam.pointA.x; row.ay = seam.pointA.y; row.bx = seam.pointB.x; row.by = seam.pointB.y;
      row.remainingMs = Math.max(0, seam.remainingMs); row.durationMs = CONTAMINANT_DATA.stitch.toolDurationMs;
      row.tension = Math.min(1, (seam.tensionMs ?? 0) / 320);
      row.opacity = seam.dissolving ? seam.fade.alphaSteps[seam.fade.stepIndex] ?? 0 : 1;
      index++;
    }
    out.seams.length = index; index = 0;
    for (const anchor of this.compressAnchors) {
      const row = out.pressures[index] ??= { id: 0, x: 0, y: 0, radius: 0,
        remainingMs: 0, durationMs: 0, opacity: 0 };
      row.id = this.presentationId(anchor); row.x = anchor.position.x; row.y = anchor.position.y;
      row.radius = anchor.radius; row.remainingMs = Math.max(0, anchor.remainingMs);
      row.durationMs = CONTAMINANT_DATA.compress.toolDurationMs;
      row.opacity = anchor.dissolving ? .2 * (1 - anchor.dissolve.stepsDone / anchor.dissolve.stepsTotal)
        : Math.min(1, row.remainingMs / 500);
      index++;
    }
    out.pressures.length = index; index = 0;
    for (const sound of this.kindleZones) {
      const row = out.soundLures[index] ??= { id: 0, x: 0, y: 0, fromX: 0, fromY: 0, radius: 0,
        elapsedMs: 0, remainingMs: 0, durationMs: 0, pulseElapsedMs: 0, pulseIntervalMs: 0 };
      row.id = this.presentationId(sound); row.x = sound.position.x; row.y = sound.position.y;
      row.fromX = sound.throwFrom?.x ?? row.x; row.fromY = sound.throwFrom?.y ?? row.y;
      row.radius = sound.radius; row.elapsedMs = sound.elapsedMs;
      row.remainingMs = Math.max(0, sound.remainingMs); row.durationMs = CONTAMINANT_DATA.kindle.toolDurationMs;
      row.pulseElapsedMs = sound.pulseAccumMs; row.pulseIntervalMs = CONTAMINANT_DATA.kindle.toolPulseIntervalMs;
      index++;
    }
    out.soundLures.length = index;
    return out;
  }

  private presentationId(source: object): number {
    let id = this.presentationIds.get(source);
    if (id === undefined) { id = ++this.presentationSerial; this.presentationIds.set(source, id); }
    return id;
  }

  private playerEcho(mode: 'mirror' | 'phase' | 'memory'): BodyEcho | null {
    const sprite = this.getPlayerSprite?.();
    if (!sprite?.texture) return null;
    return captureBodyEcho(this.scene, { textureKey: sprite.texture.key, frame: sprite.frame.name,
      originX: sprite.originX, originY: sprite.originY, scaleX: sprite.scaleX, scaleY: sprite.scaleY }, mode);
  }

  private footContact(enemy: EnemyView): Vector2 {
    const position = enemy.getPosition();
    return { x: position.x, y: position.y + GAME_CONSTANTS.AI.BODY_SIZE / 2 };
  }

  private enemyEcho(id: string, mode: 'freeze' | 'memory'): BodyEcho | null {
    const source = this.captureEnemyVisual?.(id);
    return source ? captureBodyEcho(this.scene, source, mode) : null;
  }

  useSlot(slotIndex: number): boolean {
    this.lastUseFailure = null;
    const contaminant = this.loadout[slotIndex];
    if (!contaminant) return false;
    if (contaminant.stage !== 'tool') return false;
    if (contaminant.usesRemaining <= 0) return false;

    // Skip passive tools on manual activation
    const def = CONTAMINANT_DATA[contaminant.type];
    if (def && def.toolType === 'passive') return false;

    // Each effect validates its target/placement first, then calls this gate exactly
    // once before changing gameplay or creating its visible effect.
    const used = this.applyEffect(contaminant.type, () => this.commitToolUse(slotIndex));
    if (!used && !this.lastUseFailure) {
      const reasons: Partial<Record<ContaminantType, string>> = {
        solidify: '附近没有可凝滞的可见目标。', delay: '附近没有尚未释放、可暂缓的污染源。',
        combust: '附近没有可压制的活动污染源；已受压制或暂缓的目标不能重复使用。', kindle: '前方没有可落下回声空壳的位置。',
        stitch: '前方没有足够完整的地面铺设打结的细线。', expand: this.expandEffect ? '身体尚未归位。' : '朝向贴近薄墙，另一侧需要能落脚。',
        abyss: this.abyssRevealRemainingMs > 0 ? '旧影尚未散去。' : '附近没有可以留下旧影的目标。',
      };
      this.lastUseFailure = reasons[contaminant.type] ?? '此处无法施放，未消耗次数。';
    }
    return used;
  }

  private commitToolUse(slotIndex: number): boolean {
    const contaminant = this.loadout[slotIndex];
    if (!contaminant || contaminant.stage !== 'tool' || contaminant.usesRemaining <= 0) return false;
    const result = contaminantSystem.tryConsumeTool(contaminant.id);
    if (!result.ok) { this.lastUseFailure = result.error === 'storage-failed' ? '未能保存，本次未施放，未消耗次数。' : '物品状态已改变，本次未施放。'; return false; }
    if (result.value.broken) this.loadout[slotIndex] = null;
    return true;
  }

  private commitPassiveUse(type: ContaminantType): boolean {
    const slot = this.loadout.findIndex(item => item?.type === type && item.stage === 'tool' && item.usesRemaining > 0);
    return slot >= 0 && this.commitToolUse(slot);
  }

  /** Per-frame update of active tool effects. */
  update(deltaMs: number): void {
    this.elapsedMs += deltaMs;
    this.updateFreezes(deltaMs);
    this.updateDelayDevices(deltaMs);
    this.updateErodeZones(deltaMs);
    this.updateRetrogradeMarks(deltaMs);
    this.updateTrackingEpisodes();
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

  /** Re-seat body traces after the scene has resolved physics and painter order. */
  syncBodyVisuals(): void {
    for (const effect of this.freezeEffects) if (!effect.dissolving) {
      effect.echo?.update(effect.lastPos, 1 - effect.remainingMs / CONTAMINANT_DATA.solidify.toolDurationMs,
        this.getGroundVisualDepth?.(effect.lastPos.y) ?? 39);
    }
    for (const decoy of this.mirrorDecoys) if (!decoy.shattering) {
      decoy.echo?.update(decoy.position, 1 - decoy.remainingMs / CONTAMINANT_DATA.mirror.toolDurationMs,
        this.getGroundVisualDepth?.(decoy.groundY ?? decoy.position.y) ?? 29);
    }
    const phase = this.expandEffect;
    if (phase) phase.echo?.update(this.getPlayerPos(), 1 - phase.remainingMs / phase.stiffnessMs,
      (this.getPlayerSprite?.()?.depth ?? 38) + .2);
  }

  /** Called after Host motion; attached material traces must share this frame's core position. */
  syncHostVisuals(): void {
    if (!this.delayDevices.length && !this.combustFields.length) return;
    const targets = this.getEnvironmentTargets?.() ?? [];
    for (const device of this.delayDevices) {
      const host = targets.find(target => target.id === device.hostId);
      if (!host) continue;
      device.position = { ...host.position };
      drawHostRestraint(device.visual, device.position, true, device.remainingMs, this.elapsedMs);
    }
    for (const field of this.combustFields) {
      const host = targets.find(target => target.id === field.hostId);
      if (!host) continue;
      field.position = { ...host.position };
      drawHostRestraint(field.visual, field.position, false, field.remainingMs, this.elapsedMs);
    }
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
    for (const d of this.delayDevices) consider('delay', d.remainingMs, false);
    for (const z of this.erodeZones) consider('erode', z.remainingMs, z.dissolving);
    for (const m of this.retrogradeMarks) consider('retrograde', m.remainingMs, m.collapsing);
    for (const z of this.kindleZones) consider('kindle', z.remainingMs, z.dissolving);
    for (const b of this.stitchBarriers) consider('stitch', b.remainingMs, b.dissolving);
    for (const stop of this.stitchStops) consider('stitch', stop.remainingMs, false);
    if (this.expandEffect) {
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
    const enemy = this.getEnemies().find(candidate => candidate.getId() === enemyId);
    if (enemy?.isTargetingLure?.() || enemy?.isTargetingDecoy?.()) return;
    if (!this.scatterActive || this.scatterTriggersRemaining <= 0 || this.scatterSuppressedEnemyIds.has(enemyId)) return;
    if (!this.commitPassiveUse('scatter')) return;
    this.scatterTriggersRemaining--;
    this.scatterActive = this.scatterTriggersRemaining > 0;
    this.scatterSuppressedEnemyIds.add(enemyId);
    this.setEnemyDetectionFillRateMult?.(enemyId, CONTAMINANT_DATA.scatter.toolDetectionFillMult);
  }

  /** One continuous audible encounter spends once, including its complete final use. */
  notifyProximityAvoid(): boolean {
    if (this.muffleEpisodeActive && this.elapsedMs - this.muffleLastSignalMs < CONTAMINANT_DATA.muffle.toolDurationMs) {
      this.muffleLastSignalMs = this.elapsedMs;
      return true;
    }
    this.muffleEpisodeActive = false;
    if (!this.muffleEquipped || this.muffleTriggersRemaining <= 0) return false;
    if (!this.commitPassiveUse('muffle')) {
      this.setHearingSuppressed?.(false);
      return false;
    }
    this.muffleTriggersRemaining--;
    this.muffleEquipped = this.muffleTriggersRemaining > 0;
    this.muffleEpisodeActive = true;
    this.muffleLastSignalMs = this.elapsedMs;
    this.setHearingSuppressed?.(true);
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
    this.stitchStops = [];
    this.expandEffect = null;
    this.compressAnchors = [];
    this.mirrorDecoys = [];
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
    eventBus.off(GameEvent.PLAYER_DAMAGED, this.onPlayerDamaged);
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
    for (const [id, sources] of this.controlSources) {
      for (const source of [...sources.keys()]) this.releaseControl(id, source);
    }
    this.controlSources.clear();
    this.muffleEpisodeActive = false;
    this.muffleLastSignalMs = -Infinity;
    for (const decoy of this.mirrorDecoys) this.setVisualDecoy?.(this.sourceFor(decoy), null);
    for (const field of this.combustFields) this.clearEnvironmentControl?.(field.hostId, this.sourceFor(field));
    for (const device of this.delayDevices) this.clearEnvironmentControl?.(device.hostId, this.sourceFor(device));
    this.siphonEffectRemainingMs = 0;
    if (this.abyssRevealRemainingMs > 0) this.showAbyssReveal?.([], [], 0);
    this.abyssRevealRemainingMs = 0;
    for (const episode of this.trackingEpisodes.values()) episode.echo?.destroy();
    this.trackingEpisodes.clear();
    if (this.mirrorDecoys.length > 0) this.setDecoyPosition?.(null);
    if (this.expandEffect) {
      this.setPlayerCollision?.(true);
      this.setPlayerInput?.(true);
      this.getPlayerSprite?.()?.setAlpha(1);
    }
    for (const id of this.scatterSuppressedEnemyIds) this.setEnemyDetectionFillRateMult?.(id, 1);
    this.scatterSuppressedEnemyIds.clear();
    this.setHearingSuppressed?.(false);
  }

  private sourceFor(owner: object): string {
    let source = this.controlIds.get(owner);
    if (!source) { source = `tool:${++this.controlSerial}`; this.controlIds.set(owner, source); }
    return source;
  }

  private applyControl(id: string, source: string, effect: ToolControl): void {
    let sources = this.controlSources.get(id);
    if (!sources) { sources = new Map(); this.controlSources.set(id, sources); }
    sources.set(source, effect);
    this.setEnemyControl?.(id, source, effect);
    this.syncControlFallback(id, sources);
  }

  private releaseControl(id: string, source: string): void {
    const sources = this.controlSources.get(id);
    sources?.delete(source);
    this.clearEnemyControl?.(id, source);
    this.syncControlFallback(id, sources ?? new Map());
    if (sources?.size === 0) this.controlSources.delete(id);
  }

  private syncControlFallback(id: string, sources: ReadonlyMap<string, ToolControl>): void {
    if (!this.setEnemyControl) {
      const state = new EnemyControlState();
      for (const [source, effect] of sources) state.set(source, effect);
      this.setEnemySpeedMultiplier?.(id, state.movementMultiplier);
      this.setEnemyPerceptionMultiplier?.(id, state.perceptionMultiplier);
    }
    this.setEnemyMovementLocked?.(id, [...sources.values()].some(effect => effect.movementLocked));
    this.setEnemyEscalationSuppressed?.(id, [...sources.values()].some(effect => effect.escalationSuppressed));
  }

  private canTarget(enemy: EnemyView): boolean {
    const position = enemy.getPosition();
    return (this.isTargetAlive?.(enemy.getId()) ?? true)
      && (this.isTargetVisible?.(position) ?? true)
      && (this.hasTargetLineOfSight?.(this.getPlayerPos(), position) ?? true);
  }

  // ------------------------------------------------------------------ internal

  private applyEffect(type: ContaminantType, commit: () => boolean): boolean {
    switch (type) {
      case 'solidify': return this.applySolidify(commit);
      case 'delay': return this.applyDelay(commit);
      case 'erode': return this.applyErode(commit);
      case 'ruminate': return this.applyRuminate(commit);
      case 'retrograde': return false; // passive; old active-slot instances also follow the passive contract
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
    const nearest = selectNearestVisibleTarget(this.getPlayerPos(), this.getEnemies(), {
      getPosition: enemy => enemy.getPosition(),
      isAlive: enemy => !this.freezeEffects.some(effect => effect.enemyId === enemy.getId() && !effect.dissolving),
      isVisible: enemy => this.canTarget(enemy),
      hasLineOfSight: (from, to) => this.hasTargetLineOfSight?.(from, to) ?? true,
    });

    if (!nearest) return false;
    if (!commit()) return false;

    const id = nearest.getId();
    // "无法移动或感知": speed 0 stops it, perception range 0 makes every raycast fail
    // (perceive() gates both sight and hearing range on this same multiplier).
    this.applyControl(id, `solidify:${id}`, { movementMultiplier: 0, perceptionMultiplier: 0, suppressAttack: true, breakOnDamage: true });
    this.indicators.set(id, 'solidify', 0, false);

    // Capture the actual body; the visible trace is a material edge, not a selection shape.
    const g = this.scene.add.graphics().setDepth(26);


    this.freezeEffects.push({
      enemyId: id,
      echo: this.enemyEcho(id, 'freeze'),
      remainingMs: CONTAMINANT_DATA.solidify.toolDurationMs,
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
          effect.echo?.update(effect.lastPos, 1 - effect.remainingMs / CONTAMINANT_DATA.solidify.toolDurationMs, this.getGroundVisualDepth?.(effect.lastPos.y) ?? 39);
          effect.visual.clear();
        }

        if (!enemy || effect.remainingMs <= 0 || (this.hasEnemyControl && !this.hasEnemyControl(effect.enemyId, `solidify:${effect.enemyId}`))) {
          // "解冻后立即进入警戒状态": thaw, then wake up already searching.
          this.releaseControl(effect.enemyId, `solidify:${effect.enemyId}`);
          this.forceEnemyAlert?.(effect.enemyId);
          this.indicators.clear(effect.enemyId, 'solidify');

          // 结束消散: crack into blocks and shed them in 2 discrete steps, not a fade.
          effect.echo?.destroy();
          effect.dissolving = true;
          const rng = mulberry32(hashSeed(effect.enemyId) ^ 0x9e3779b9);
          effect.dissolveBlocks = effect.remainingMs > 0 ? buildGlitchBlockField(12, 7, 1, 2, rng) : [];
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
    if (!this.getEnvironmentTargets || !this.delayEnvironmentHazard) return false;
    const def = CONTAMINANT_DATA.delay;
    const target = selectNearestVisibleTarget(this.getPlayerPos(), this.getEnvironmentTargets(), {
      getPosition: host => host.position,
      isAlive: host => !host.hazardReleased && host.canDelayNextHazard && host.delayRemainingMs <= 0,
      isVisible: host => this.isTargetVisible?.(host.position) ?? true,
      hasLineOfSight: (from, to) => this.hasTargetLineOfSight?.(from, to) ?? true,
      maxDistance: def.toolRangePx,
    });
    if (!target || !commit()) return false;
    const device: DelayDevice = { hostId: target.id, position: { ...target.position }, remainingMs: def.toolDurationMs,
      visual: this.scene.add.graphics().setDepth(43) };
    this.delayEnvironmentHazard(target.id, this.sourceFor(device), def.toolDurationMs);
    this.delayDevices.push(device);
    return true;
  }

  private updateDelayDevices(deltaMs: number): void {
    for (let i = this.delayDevices.length - 1; i >= 0; i--) {
      const device = this.delayDevices[i]!;
      device.remainingMs -= deltaMs;
      if (device.remainingMs <= -450) {
        // Host owns the actual timer and consumes the remaining frame fraction itself.
        // The extra 450 ms is only falling grit; it never extends the delay.
        device.visual.destroy(); this.delayDevices.splice(i, 1); continue;
      }
      const host = this.getEnvironmentTargets?.().find(target => target.id === device.hostId);
      if (!host) { device.visual.destroy(); this.delayDevices.splice(i, 1); continue; }
      device.position = { ...host.position };
      drawHostRestraint(device.visual, device.position, true, device.remainingMs, this.elapsedMs);
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
            this.applyControl(id, this.sourceFor(zone), { movementMultiplier: speedMult, perceptionMultiplier: ERODE_PERCEPTION_MULT });
            this.indicators.set(id, 'erode', ERODE_PERCEPTION_MULT, false);
          }
        }
        for (const id of zone.affectedEnemyIds) {
          if (!stillIn.has(id)) {
            this.releaseControl(id, this.sourceFor(zone));
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
            this.releaseControl(id, this.sourceFor(zone));
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
    const def = CONTAMINANT_DATA.kindle;
    const destination = this.getSoundLureDestination?.(def.toolThrowDistancePx);
    if (!destination || !this.reportSoundLure) return false;
    if (!commit()) return false;
    const zone: KindleZone = {
      position: { ...destination }, throwFrom: { ...this.getPlayerPos() }, radius: def.toolRangePx,
      remainingMs: def.toolDurationMs, elapsedMs: 0, pulseAccumMs: 0,
      visual: this.scene.add.graphics().setDepth(10), dissolving: false,
    };
    this.kindleZones.push(zone);
    this.reportSoundLure(zone.position, zone.radius);
    this.drawSoundShell(zone);
    return true;
  }

  private drawSoundShell(zone: KindleZone): void {
    const g = zone.visual;
    const fade = Math.min(1, Math.max(0, zone.remainingMs / 500));
    const x = Math.round(zone.position.x), y = Math.round(zone.position.y);
    g.clear();
    drawToolObject(g, 'kindle', zone.position, fade);
    if (zone.throwFrom && zone.elapsedMs < 160) {
      const p = zone.elapsedMs / 160;
      drawToolObject(g, 'kindle', { x: zone.throwFrom.x + (zone.position.x - zone.throwFrom.x) * p,
        y: zone.throwFrom.y + (zone.position.y - zone.throwFrom.y) * p - Math.sin(p * Math.PI) * 10 }, .45 * (1 - p));
    }
    const pulse = (zone.elapsedMs % CONTAMINANT_DATA.kindle.toolPulseIntervalMs) / CONTAMINANT_DATA.kindle.toolPulseIntervalMs;
    const radius = 6 + pulse * 22;
    for (let i = 0; i < 18; i++) {
      if (i % 5 === 0) continue;
      const angle = i * Math.PI / 9;
      const r = radius + (i % 3 - 1) * 2;
      g.fillStyle(GHOST_COLOR, .38 * (1 - pulse) * fade);
      g.fillRect(x + Math.round(Math.cos(angle) * r / 2) * 2,
        y + Math.round(Math.sin(angle) * r * .55 / 2) * 2, 2, 1);
    }
  }

  private updateKindleZones(deltaMs: number): void {
    for (let i = this.kindleZones.length - 1; i >= 0; i--) {
      const zone = this.kindleZones[i]!;
      zone.remainingMs -= deltaMs;
      zone.elapsedMs += deltaMs;
      zone.pulseAccumMs += deltaMs;
      if (zone.remainingMs <= 0) {
        zone.visual.destroy(); this.kindleZones.splice(i, 1); continue;
      }
      const interval = CONTAMINANT_DATA.kindle.toolPulseIntervalMs;
      if (zone.pulseAccumMs >= interval) {
        zone.pulseAccumMs %= interval;
        this.reportSoundLure?.(zone.position, zone.radius);
      }
      this.drawSoundShell(zone);
    }
  }

  // --- Compress (gravity anchor: movement slowdown only in radius) ---

  private applyCompress(commit: () => boolean): boolean {
    if (!commit()) return false;
    // The stone anchors its slowdown at the current position for its full lifetime.
    const pos = { ...this.getPlayerPos() };
    const def = CONTAMINANT_DATA.compress;
    const radius = def.toolRangePx;
    const rng = mulberry32(hashSeed(`compress-${this.scene.time.now}`));
    const tier = RARITY_VFX.fine;
    const blocks = buildGlitchBlockField(radius, tier.count, tier.sizeMin, tier.sizeMax, rng);

    const g = this.scene.add.graphics().setDepth(10);
    drawPressure(g, pos, radius, 1);

    this.compressAnchors.push({
      position: pos,
      radius,
      remainingMs: def.toolDurationMs,
      visual: g,
      bracketVisual: this.scene.add.graphics().setDepth(10),
      blocks,
      dissolving: false,
      dissolve: createDissolveState(2, 80),
      affectedEnemyIds: new Set(),
    });
    return true;
  }

  private updateCompressAnchors(deltaMs: number): void {
    const enemies = this.getEnemies();
    const mult = CONTAMINANT_DATA.compress.toolMovementMult;

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
              this.applyControl(id, this.sourceFor(anchor), { movementMultiplier: mult });
            }
          }
        }
        // "对已脱离范围的敌人无效" - release exactly the ones that left (or the anchor expired).
        for (const id of anchor.affectedEnemyIds) {
          if (!stillIn.has(id)) {
            this.releaseControl(id, this.sourceFor(anchor));
          }
        }
        anchor.affectedEnemyIds = stillIn;

        drawPressure(anchor.visual, anchor.position, anchor.radius,
          Math.min(1, anchor.remainingMs / 500));

        // Pressure at the physical foot; leaving the radius removes it immediately.
        anchor.bracketVisual.clear();
        for (const id of anchor.affectedEnemyIds) {
          const enemy = enemies.find((e) => e.getId() === id);
          if (!enemy || !this.canTarget(enemy)) continue;
          drawFootDrag(anchor.bracketVisual, this.footContact(enemy), .85);
        }

        if (anchor.remainingMs <= 0) {
          for (const id of anchor.affectedEnemyIds) {
            this.releaseControl(id, this.sourceFor(anchor));
          }
          anchor.affectedEnemyIds.clear();
          anchor.bracketVisual.clear();
          anchor.dissolving = true;
        }
        continue;
      }

      const { jitter, done } = stepDissolve(anchor.dissolve, anchor.blocks, deltaMs);
      const dAnchor = { x: anchor.position.x + jitter.x, y: anchor.position.y + jitter.y };
      drawPressure(anchor.visual, dAnchor, anchor.radius, done ? 0 : .2);

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

  private beginTrackingEpisode(enemyId: string): void {
    if (!this.retrogradeEquipped || this.trackingEpisodes.has(enemyId)
      || !this.loadout.some(item => item?.type === 'retrograde' && item.usesRemaining > 0)) return;
    const enemy = this.getEnemies().find(candidate => candidate.getId() === enemyId);
    if (!enemy || enemy.isTargetingLure?.() || enemy.isTargetingDecoy?.()) return;
    const visible = this.canTarget(enemy);
    this.trackingEpisodes.set(enemyId, {
      lastVisiblePosition: visible ? { ...enemy.getPosition() } : { x: 0, y: 0 },
      hasVisiblePosition: visible, spent: false, echo: visible ? this.enemyEcho(enemyId, 'memory') : null, sampledAt: this.elapsedMs,
    });
  }

  private updateTrackingEpisodes(): void {
    for (const [id, episode] of this.trackingEpisodes) {
      if (!this.loadout.some(item => item?.type === 'retrograde' && item.stage === 'tool' && item.usesRemaining > 0)) {
        for (const remaining of this.trackingEpisodes.values()) remaining.echo?.destroy();
        this.trackingEpisodes.clear();
        return; // Generated marks own their full lifetime; no further snapshots can be used.
      }
      if (episode.spent) continue;
      const enemy = this.getEnemies().find(candidate => candidate.getId() === id);
      if (!enemy || this.isTargetAlive?.(id) === false) { episode.echo?.destroy(); this.trackingEpisodes.delete(id); continue; }
      if (this.canTarget(enemy)) {
        const position = enemy.getPosition();
        episode.lastVisiblePosition.x = position.x;
        episode.lastVisiblePosition.y = position.y;
        episode.hasVisiblePosition = true;
        if (this.elapsedMs - (episode.sampledAt ?? -Infinity) >= 100) {
          episode.echo?.destroy(); episode.echo = this.enemyEcho(id, 'memory'); episode.sampledAt = this.elapsedMs;
        }
      } else if (episode.hasVisiblePosition && this.commitPassiveUse('retrograde')) {
        episode.spent = true;
        this.retrogradeMarks.push({ enemyId: id, echo: episode.echo, position: { ...episode.lastVisiblePosition },
          remainingMs: CONTAMINANT_DATA.retrograde.toolDurationMs,
          visual: this.scene.add.graphics().setDepth(RETROGRADE_VISUAL_DEPTH),
          collapsing: false, collapseFade: createStepFade(2, 90) });
        episode.echo = null;
      }
    }
  }

  private updateRetrogradeMarks(deltaMs: number): void {
    for (let i = this.retrogradeMarks.length - 1; i >= 0; i--) {
      const mark = this.retrogradeMarks[i]!;
      mark.remainingMs -= deltaMs;
      if (mark.remainingMs <= 0) { mark.echo?.destroy(); mark.visual.destroy(); this.retrogradeMarks.splice(i, 1); continue; }
      mark.echo?.update(mark.position, 1 - mark.remainingMs / CONTAMINANT_DATA.retrograde.toolDurationMs, RETROGRADE_VISUAL_DEPTH);
    }
  }

  private applyOverwrite(commit: () => boolean): boolean {
    const nearest = selectNearestVisibleTarget(this.getPlayerPos(), this.getEnemies(), {
      getPosition: enemy => enemy.getPosition(),
      isAlive: () => true,
      isVisible: enemy => this.canTarget(enemy),
      hasLineOfSight: (from, to) => this.hasTargetLineOfSight?.(from, to) ?? true,
    });

    if (!nearest) return false;
    if (!commit()) return false;

    const id = nearest.getId();
    const def = CONTAMINANT_DATA.overwrite;

    this.reverseEnemyPatrol?.(id);
    this.forceEnemyReturn?.(id);
    this.applyControl(id, `overwrite:${id}`, { perceptionMultiplier: GAME_CONSTANTS.TOOLS.OVERWRITE_PERCEPTION_MULT });
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
        this.releaseControl(m.enemyId, `overwrite:${m.enemyId}`);
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
    const def = CONTAMINANT_DATA.stitch;
    const placement = this.getStitchPlacement?.(def.toolRangePx, def.toolPlacementDistancePx);
    if (!placement || !commit()) return false;
    this.stitchBarriers.push({ ...placement, remainingMs: def.toolDurationMs,
      previousPositions: new Map(this.getEnemies().map(enemy => [enemy.getId(), { ...enemy.getPosition() }])),
      affectedEnemyIds: new Set(), visual: this.scene.add.graphics().setDepth(10),
      dissolving: false, fade: createStepFade(2, 90) });
    return true;
  }

  private updateStitchBarriers(deltaMs: number): void {
    for (let i = this.stitchStops.length - 1; i >= 0; i--) {
      const stop = this.stitchStops[i]!;
      stop.remainingMs -= deltaMs;
      if (stop.remainingMs <= 0) {
        this.releaseControl(stop.enemyId, stop.source); this.stitchStops.splice(i, 1);
      }
    }
    const enemies = this.getEnemies();
    for (let i = this.stitchBarriers.length - 1; i >= 0; i--) {
      const barrier = this.stitchBarriers[i]!;
      barrier.tensionMs = Math.max(0, (barrier.tensionMs ?? 0) - deltaMs);
      if (!barrier.dissolving) {
        barrier.remainingMs -= deltaMs;
        if (barrier.remainingMs > 0) for (const enemy of enemies) {
          const id = enemy.getId(), position = enemy.getPosition();
          const previous = barrier.previousPositions.get(id);
          if (previous && !barrier.affectedEnemyIds.has(id) && (this.isTargetAlive?.(id) ?? true)
            && crossesToolLine(previous, position, barrier)) {
            barrier.affectedEnemyIds.add(id);
            barrier.tensionMs = 320;
            const stop = { enemyId: id, remainingMs: CONTAMINANT_DATA.stitch.toolStopMs, source: '' };
            stop.source = this.sourceFor(stop);
            this.stitchStops.push(stop);
            this.applyControl(id, stop.source, { movementMultiplier: 0 });
          }
          if (previous) { previous.x = position.x; previous.y = position.y; }
          else barrier.previousPositions.set(id, { ...position });
        }
        drawSeam(barrier.visual, barrier.pointA, barrier.pointB, 1, (barrier.tensionMs ?? 0) / 320);
        for (const stop of this.stitchStops) {
          const enemy = enemies.find(candidate => candidate.getId() === stop.enemyId);
          if (enemy && this.canTarget(enemy)) drawFootDrag(barrier.visual, this.footContact(enemy), Math.min(1, stop.remainingMs / 200));
        }
        if (barrier.remainingMs <= 0) barrier.dissolving = true;
        continue;
      }
      const { alpha, done } = stepFade(barrier.fade, deltaMs);
      this.drawStitchLine(barrier.visual, barrier.pointA, barrier.pointB, alpha);
      if (done) { barrier.visual.destroy(); this.stitchBarriers.splice(i, 1); }
    }
  }

  /** Same fibers persist through release, with their opacity falling away. */
  private drawStitchLine(g: Phaser.GameObjects.Graphics, a: Vector2, b: Vector2, alphaMult: number): void {
    drawSeam(g, a, b, alphaMult);
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
    if (!this.setVisualDecoy && !this.setDecoyPosition) return false;
    if (!commit()) return false;
    const pos = { ...this.getPlayerPos() };
    const def = CONTAMINANT_DATA.mirror;

    const g = this.scene.add.graphics().setDepth(24);

    const decoy: MirrorDecoy = {
      echo: this.playerEcho('mirror'),
      groundY: this.getPlayerGroundY?.() ?? pos.y,
      position: pos,
      remainingMs: def.toolDurationMs,
      visual: g,
      shattering: false,
      shatterBlocks: [],
      shatterDissolve: createDissolveState(1, 1),
    };
    this.mirrorDecoys.push(decoy);
    if (this.setVisualDecoy) this.setVisualDecoy(this.sourceFor(decoy), pos);
    else this.setDecoyPosition?.(pos);
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
        decoy.echo?.destroy();
        decoy.shatterBlocks = buildGlitchBlockField(13, 8, 1, 3, rng);
        decoy.shatterDissolve = createDissolveState(2, 75);
        decoy.shattering = true;
        this.setVisualDecoy?.(this.sourceFor(decoy), null);
        continue;
      }

      if (decoy.remainingMs <= 0) {
        this.setVisualDecoy?.(this.sourceFor(decoy), null);
        decoy.echo?.destroy();
        // The real-pose imprint has already faded over the final part of its lifetime.
        decoy.visual.destroy();
        this.mirrorDecoys.splice(i, 1);
        continue;
      }

      decoy.echo?.update(decoy.position, 1 - decoy.remainingMs / CONTAMINANT_DATA.mirror.toolDurationMs, this.getGroundVisualDepth?.(decoy.groundY ?? decoy.position.y) ?? 29);
    }

    // Point AISystem at whichever decoy is newest/still alive; clear once none remain.
    if (!this.setVisualDecoy) {
      const active = this.mirrorDecoys.find(decoy => !decoy.shattering);
      this.setDecoyPosition?.(active?.position ?? null);
    }

  }

  // =========================================================================
  // 族群 G — 自身相变 (expand) - the one tool whose effect is on the player's own body.
  // =========================================================================

  private applyExpand(commit: () => boolean): boolean {
    if (this.expandEffect || !this.movePlayerTo) return false;
    const destination = this.getPhaseDestination?.();
    if (!destination || !commit()) return false;
    // The entire crossing is validated before payment; the body stays enabled.
    this.movePlayerTo(destination);
    this.setPlayerInput?.(false);
    const duration = CONTAMINANT_DATA.expand.toolDurationMs;
    this.expandEffect = {
      remainingMs: duration,
      stiffnessMs: duration,
      phase: 'stiffness',
      echo: this.playerEcho('phase'),
      visual: this.scene.add.graphics().setDepth(30),
      jitterPhase: 0,
    };
    return true;
  }

  private updateExpandEffect(deltaMs: number): void {
    if (!this.expandEffect) return;
    const effect = this.expandEffect;
    const pos = this.getPlayerPos();

    effect.remainingMs -= deltaMs;
    effect.echo?.update(pos, 1 - effect.remainingMs / effect.stiffnessMs, (this.getPlayerSprite?.()?.depth ?? 38) + .2);

    if (effect.remainingMs <= 0) {
      this.setPlayerInput?.(true);
      effect.echo?.destroy();
      effect.visual.destroy();
      this.expandEffect = null;
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
      if (this.reclaimedNodes.has(`${node.x},${node.y}`)) continue;
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

    this.reclaimedNodes.add(`${nearest.x},${nearest.y}`);
    // Grant once per already-searched kindling pile.
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
    const def = CONTAMINANT_DATA.abyss;
    if (!this.getRevealSnapshot || !this.showAbyssReveal || this.abyssRevealRemainingMs > 0) return false;
    const snapshot = this.getRevealSnapshot(def.toolRangePx);
    if (snapshot.enemyPositions.length + snapshot.nodePositions.length + (snapshot.corePositions?.length ?? 0) === 0 || !commit()) return false;
    this.showAbyssReveal(snapshot.enemyPositions.map(p => ({ ...p })), snapshot.nodePositions.map(p => ({ ...p })), def.toolDurationMs, snapshot.corePositions?.map(p => ({ ...p })));
    this.abyssRevealRemainingMs = def.toolDurationMs;

    // 施放瞬间: "孔径闭合" - blocks collapse inward and vanish, the one effect in the
    // whole spec that starts wide and *contracts* rather than bursting outward.
    const pos = { ...this.getPlayerPos() };
    const rng = mulberry32(hashSeed(`abyss-${this.scene.time.now}`));
    const blocks = buildGlitchBlockField(28, 5, 6, 10, rng);
    const g = this.scene.add.graphics().setDepth(15);
    this.abyssBursts.push({ position: pos, remainingMs: 240, visual: g, blocks, echo: this.playerEcho('memory') });

    return true;
  }

  private updateAbyssBursts(deltaMs: number): void {
    for (let i = this.abyssBursts.length - 1; i >= 0; i--) {
      const burst = this.abyssBursts[i]!;
      burst.remainingMs -= deltaMs;
      burst.echo?.update(burst.position, 1 - burst.remainingMs / 240, 39);
      if (burst.remainingMs <= 0) {
        burst.echo?.destroy();
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
    this.passiveVisual ??= this.scene.add.graphics().setDepth(39);
    this.passiveVisual.clear();
    const elapsed = CONTAMINANT_DATA.siphon.toolDurationMs - this.siphonEffectRemainingMs;
    if (elapsed < 650 && this.siphonEffectRemainingMs > 0) {
      const p = this.getPlayerPos();
      const inset = Math.round(3 * elapsed / 650);
      this.passiveVisual.fillStyle(0x859887, .7 * (1 - elapsed / 650));
      // A brief closing material edge, not a heal or a damage-absorbing bubble.
      this.passiveVisual.fillRect(Math.round(p.x) - 8 + inset, Math.round(p.y) - 10, 1, 5);
      this.passiveVisual.fillRect(Math.round(p.x) + 7 - inset, Math.round(p.y) - 6, 1, 4);
    }
  }

  // =========================================================================
  // Combust: suppress one visible, active environmental source.
  // =========================================================================

  private applyCombust(commit: () => boolean): boolean {
    if (!this.getEnvironmentTargets || !this.suppressEnvironmentHazard) return false;
    const def = CONTAMINANT_DATA.combust;
    const origin = this.getPlayerPos();
    const nearest = selectNearestVisibleTarget(origin, this.getEnvironmentTargets(), {
      getPosition: host => host.position,
      isAlive: host => host.canSuppressHazard && host.suppressionRemainingMs <= 0 && !host.recoveryPending && !(host.delayRemainingMs > 0),
      isVisible: host => this.isTargetVisible?.(host.position) ?? true,
      hasLineOfSight: (from, to) => this.hasTargetLineOfSight?.(from, to) ?? true,
      maxDistance: def.toolRangePx,
    });
    if (!nearest || !commit()) return false;
    const field: CombustField = {
      hostId: nearest.id, position: { ...nearest.position }, remainingMs: def.toolDurationMs,
      visual: this.scene.add.graphics().setDepth(43),
      blocks: buildGlitchBlockField(15, 9, 2, 5, mulberry32(hashSeed(nearest.id))),
      dissolving: false, dissolve: createDissolveState(3, 90),
    };
    this.suppressEnvironmentHazard(nearest.id, this.sourceFor(field), def.toolDurationMs);
    this.combustFields.push(field);
    return true;
  }

  private updateCombustFields(deltaMs: number): void {
    for (let i = this.combustFields.length - 1; i >= 0; i--) {
      const field = this.combustFields[i]!;
      field.remainingMs -= deltaMs;
      if (field.remainingMs <= 0) {
        field.visual.destroy(); this.combustFields.splice(i, 1); continue;
      }
      const host = this.getEnvironmentTargets?.().find(target => target.id === field.hostId);
      if (!host) { field.visual.destroy(); this.combustFields.splice(i, 1); continue; }
      field.position = { ...host.position };
      drawHostRestraint(field.visual, field.position, false, field.remainingMs, this.elapsedMs);
    }
  }

  // --- Passive tools update ---

  private updatePassives(_deltaMs: number): void {
    // Muffle: "被动生效。装备期间不触发敌人近距感知" - global for as long as it is
    // equipped and still has charges; the per-avoidance charge spend happens in
    // `notifyProximityAvoid()`, called back through `AISystem`'s hearing-avoided listener.
    if (this.muffleEpisodeActive && this.elapsedMs - this.muffleLastSignalMs >= CONTAMINANT_DATA.muffle.toolDurationMs) {
      this.muffleEpisodeActive = false;
    }
    this.setHearingSuppressed?.(this.muffleEpisodeActive || (this.muffleEquipped && this.muffleTriggersRemaining > 0));
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
    this.applyControl(enemyId, `stun:${enemyId}`, { movementMultiplier: 0, suppressAttack: true });
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
        this.releaseControl(s.enemyId, `stun:${s.enemyId}`);
        this.indicators.clear(s.enemyId, 'echo');
        this.indicators.clear(s.enemyId, 'kindle');
        s.bracketVisual?.destroy();
        this.stunnedEnemies.splice(i, 1);
      }
    }
  }

  /** Timed source survives its final charge; effective cap is applied by the scene's attribute projection. */
  getPollutionResistanceBonus(): number {
    return this.siphonEffectRemainingMs > 0 ? CONTAMINANT_DATA.siphon.toolResistanceBonus : 0;
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
    this.passiveVisual?.destroy(); this.passiveVisual = null;
    for (const effect of this.freezeEffects) { effect.echo?.destroy(); effect.visual.destroy(); }
    for (const device of this.delayDevices) device.visual.destroy();
    for (const zone of this.erodeZones) zone.visual.destroy();
    for (const mark of this.retrogradeMarks) { mark.echo?.destroy(); mark.visual.destroy(); }
    for (const zone of this.kindleZones) zone.visual.destroy();
    for (const barrier of this.stitchBarriers) barrier.visual.destroy();
    this.resonatePendingVisual?.destroy();
    if (this.expandEffect) {
      this.expandEffect.echo?.destroy();
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
    for (const decoy of this.mirrorDecoys) { decoy.echo?.destroy(); decoy.visual.destroy(); }
    for (const tripwire of this.resonateStrings) tripwire.visual.destroy();
    for (const mark of this.overwriteMarks) mark.bracketVisual.destroy();
    for (const field of this.combustFields) field.visual.destroy();
    for (const stunned of this.stunnedEnemies) stunned.bracketVisual?.destroy();
    for (const burst of this.abyssBursts) { burst.echo?.destroy(); burst.visual.destroy(); }
  }
}
