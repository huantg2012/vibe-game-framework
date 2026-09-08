import { findTerrainSafeVolumeSeat, isMaterialVolume } from '@/generation/terrain-safe-volume-seat';
import { createVolumePresenceFrame, updateVolumePresenceFrame, isVolumeDangerousAt, sampleVolumeDensity, type VolumePresenceFrame } from './volume-presence';
import { doorwayWallSeats } from '@/generation/wall-host-placement';
/**
 * Non-human contamination hosts: 乙缝核 / 丙簇核 / 丁体积 (DEC-076).
 * Not a second FSM. No corridor collision. Depth stays below the vision mask.
 *
 * ## Live motion (I3-F / DEC-084)
 *
 * Public option is `liveMotion?: boolean` (default false). `RiftScene` passes
 * `{ liveMotion: true }`. The gym lexicon lesson does too. The gym map lesson
 * omits the 6th argument so hosts stay a still frame.
 *
 * I3-A: `create` materializes 乙/丙/丁 from `layout.contaminationDraw` and does
 * **not** call `drawSortie`. Jia forms on that draw feed `EnemySpawnData.form`.
 *
 * When `liveMotion === false` (map lesson and rollback):
 * - Birth 乙 is still `edge.tiles[slot]` (collectWallEdges visit order), core at
 *   **tile centre**. `orderWallEdgeTiles` is not used for spawn or ticks.
 * - `tickYiSortie` / `tickBingSortie` / `tickDingSortie` stay the still-frame
 *   bodies: 乙 core does not move, 丁 box does not move, `lexemes.contact` is
 *   **not** read, damage stays by host kind.
 * - This file must not call `stepYiWalk` / `dingLiveRect` on that path.
 *
 * When `liveMotion === true` (sortie + lexicon lesson):
 * - 乙 core on the wall-floor seam, walks `orderWallEdgeTiles` (segment breaks
 *   are not crossed), `strikeFloors` recomputed from the current tile.
 * - 丁 cloud translates / morphs; volume chaos + sight use the **current** rect.
 * - `resolveContactChannel(portfolio, form.lexemes.contact)` (rewrite_to, no
 *   new DPS). 丁 never becomes melee.
 * - `resolveStopLoss` decides hittable cores / colony nuclei. Unkillable still
 *   applies step chaos / volume field (unkillable ≠ harmless).
 *
 * Combat V3 is not modified: no screen shake, no hit-stop, no damage numbers.
 * Prices do not rise. If a fight starts to feel "satisfying to win," this
 * wiring failed — unkillable exists so going around is cheaper, not as a new
 * way to fight.
 */

import Phaser from 'phaser';
import { GAME_CONSTANTS } from '@/config/constants';
import { eventBus } from '@/core/event-bus';
import { isPaintInflated, PAINT_BREATH } from '@/entities/form-renderers/d/paint-genome/live';
import type { ContaminationForm, SortieDraw } from '@/generation/contamination-draw';
import type { ContaminationPins, CorridorAabb, GeneratedRiftLayout, PaintFloorPin, WallEdgePolyline } from '@/generation/types';
import { orderWallEdgeTiles, wallAttachForTile, type FormWallAttach } from '@/generation/wall-edge-path';
import type { CombatSystem } from '@/systems/combat-system';
import type { ChaosSystem } from '@/systems/chaos-system';
import {
  aabbPixelRect,
  chebyshevTiles,
  colonyNucleusSeats,
  colonyNucleusSeatsInFloors,
  coreMarkPx,
  dingLiveRect,
  facingFromAttach,
  pointInRect,
  rectCenter,
  resolveContactChannel,
  resolveStopLoss,
  segmentContaining,
  splitWalkSegments,
  stepYiWalk,
  strikeFloorsAt,
  type Facing4,
  type PixelRect,
  type YiWalkState,
} from '@/systems/contamination-host-live';
import { GameEvent } from '@/types/events';
import { TileType, type Vector2 } from '@/types/game-types';
import { degToRad, shortestArc } from '@/utils/math';
import type { FormAttackPose } from '@/entities/form-renderers/form-renderer';
import type { OccluderGrid } from '@/types/map-types';
import { TileGrid } from '@/systems/tile-grid';
import { hasLineOfSight } from '@/utils/grid-raycast';
import { ActivityClock, ReverseActivityClock, type ActivityVisualState } from '@/systems/ai/activity-state';
import { BEHAVIOR_PROFILE_DATA } from '@/generated/contamination-capability-data';
import { ENEMY_DATA } from '@/generated/enemy-data';

const C = GAME_CONSTANTS.CONTAMINATION;
const TILE = GAME_CONSTANTS.TILE_SIZE;
/** Oil-film sprites attach at depth 1 (rift + lexicon). Colony marks sit above that. */
const BING_MARK_DEPTH = 2;

export interface HostSubject {
  readonly id: string;
  readonly form: ContaminationForm;
  readonly position: Vector2;
}

interface HostBase {
  id: string;
  form: ContaminationForm;
  hp: number;
  activity: ActivityClock;
  noiseRemainingMs: number;
  hearingAccumMs: number;
  alive: boolean;
  gfx: Phaser.GameObjects.Graphics;
  core: Vector2;
  /** Live hittable-core marks. Null when `liveMotion` is false. */
  marks: Phaser.GameObjects.Graphics | null;
}

interface BingNucleus {
  core: Vector2;
  hp: number;
  alive: boolean;
  floorCol: number;
  floorRow: number;
  flashMs: number;
}

interface YiHost extends HostBase {
  kind: 'yi';
  tile: { col: number; row: number };
  strikeFloors: { col: number; row: number }[];
  windupMs: number;
  strikeThisFrame: boolean;
  windupCol: number;
  windupRow: number;
  telegraph: Phaser.GameObjects.Graphics;
  /** Live walk only. Null when `liveMotion` is false so still-frame ticks cannot wander. */
  walk: YiWalkState | null;
  floorUniverse: readonly { col: number; row: number }[];
  moving: boolean;
}

export interface HostSystemOptions {
  /**
   * Default false. `RiftScene` and the lexicon lesson pass `{ liveMotion: true }`.
   * The map lesson omits this so still-frame ticks stay in use.
   */
  readonly liveMotion?: boolean;
  readonly occluders?: OccluderGrid;
  readonly hearingPolicy?: {
    getRangeMultiplier(): number;
    suppressDiscovery(id: string): boolean;
  };
}

interface BingSeat {
  floorCol: number;
  floorRow: number;
  cx: number;
  cy: number;
}

function seatFromPaint(pin: PaintFloorPin): BingSeat {
  return {
    floorCol: pin.floorCol,
    floorRow: pin.floorRow,
    cx: pin.floorCol * TILE + TILE / 2,
    cy: pin.floorRow * TILE + TILE / 2,
  };
}

interface BingHost extends HostBase {
  kind: 'bing';
  pin: BingSeat;
  phase: number;
  /** Live colony only. Empty when `liveMotion` is false and on unkillable field. */
  nuclei: BingNucleus[];
}

interface DingHost extends HostBase {
  presence: VolumePresenceFrame | null;
  previewTimeMs: number | null;
  kind: 'ding';
  box: CorridorAabb;
  awake: boolean;
  live: PixelRect;
  elapsedMs: number;
  moving: boolean;
  reverseActivity: ReverseActivityClock;
}

type Host = YiHost | BingHost | DingHost;

/** Gym candidate visuals. Structurally matches FormAttachContext.pin; no gym import. */
export interface HostVisualPin {
  readonly kind: 'wall' | 'cluster' | 'volume';
  readonly x: number;
  readonly y: number;
  readonly width?: number;
  readonly height?: number;
  readonly attach?: FormWallAttach;
}

export type HostVisualSignal = 'idle' | 'strike' | 'inflated' | 'awake';

export class ContaminationHostSystem {
  private hosts: Host[] = [];
  private combat: CombatSystem | null = null;
  private chaos: ChaosSystem | null = null;
  private getVisibility: ((p: Readonly<Vector2>) => number) | null = null;
  private swingHit = false;
  private volumeSight = 1;
  private lastPlayerTile = { col: -1, row: -1 };
  private lastDraw: SortieDraw | null = null;
  private scene: Phaser.Scene | null = null;
  private pins: ContaminationPins | null = null;
  private spawnSeq = 0;
  /** Gym lexicon candidate layer. Default false: still paint stand-in geometry. */
  private skipPaint = false;
  /** Default false: still-frame cores and ticks (map lesson / rollback). */
  private liveMotion = false;
  /** Oil-film genome paint tiles. Empty = fall back to nucleus / pin Chebyshev. */
  private readonly paintFloors = new Map<string, ReadonlySet<string>>();
  private walkableFloors: ReadonlySet<string> | null = null;
  private readonly visQuery = { x: 0, y: 0 };
  private occluders: OccluderGrid | null = null;
  private hearingPolicy: HostSystemOptions['hearingPolicy'];
  private readonly swingTarget = { x: 0, y: 0 };
  private playerFacingAngle = 0;
  private readonly playerPosition = { x: 0, y: 0 };

  /**
   * Materialize 乙/丙/丁 from `layout.contaminationDraw`. Does not call `drawSortie`.
   * `combat` / `chaos` may be null: paint and tick visuals only (no swing hits / chaos).
   */
  create(
    scene: Phaser.Scene,
    layout: GeneratedRiftLayout,
    combat: CombatSystem | null,
    chaos: ChaosSystem | null,
    getVisibilityAt: (p: Readonly<Vector2>) => number,
    options?: HostSystemOptions,
  ): void {
    this.destroy();
    this.hosts = [];
    this.combat = combat;
    this.chaos = chaos;
    this.getVisibility = getVisibilityAt;
    this.liveMotion = options?.liveMotion === true;
    this.hearingPolicy = options?.hearingPolicy;
    this.occluders = options?.occluders ?? new TileGrid(layout.tileMap);
    this.walkableFloors = walkableFloorKeys(layout.tileMap.tiles);

    const pins = layout.contaminationPins;
    const drawn = layout.contaminationDraw;
    this.lastDraw = drawn;
    for (const w of drawn.warnings) console.warn(`[contamination-hosts] ${w}`);

    let bingSlot = 0;
    for (const form of drawn.forms) {
      if (form.portfolio === 'jia') continue;
      if (form.portfolio === 'yi') this.spawnYi(scene, form, this.wallSeat(form, pins));
      else if (form.portfolio === 'bing') {
        this.spawnBing(scene, form, pins.paintFloors[bingSlot], bingSlot, false);
        bingSlot++;
      } else if (form.portfolio === 'ding') this.spawnDing(scene, form, this.volumeSeat(form, pins));
    }
  }

  destroy(): void {
    for (const host of this.hosts) {
      host.gfx.destroy();
      host.marks?.destroy();
      if (host.kind === 'yi') host.telegraph.destroy();
    }
    this.hosts = [];
    this.combat = null;
    this.chaos = null;
    this.getVisibility = null;
    this.volumeSight = 1;
    this.lastDraw = null;
    this.scene = null;
    this.pins = null;
    this.spawnSeq = 0;
    this.skipPaint = false;
    this.liveMotion = false;
    this.paintFloors.clear();
    this.walkableFloors = null;
    this.occluders = null;
    this.hearingPolicy = undefined;
  }

  /**
   * Practice-field: keep combat/chaos/pins, spawn one configured 乙/丙/丁.
   * Does not run `drawSortie`.
   */
  bindPractice(
    scene: Phaser.Scene,
    pins: ContaminationPins,
    combat: CombatSystem | null,
    chaos: ChaosSystem | null,
    getVisibilityAt: (p: Readonly<Vector2>) => number,
    options?: HostSystemOptions,
  ): void {
    this.clearHosts();
    this.scene = scene;
    this.pins = pins;
    this.combat = combat;
    this.chaos = chaos;
    this.getVisibility = getVisibilityAt;
    this.spawnSeq = 0;
    this.liveMotion = options?.liveMotion === true;
    this.hearingPolicy = options?.hearingPolicy;
    this.occluders = options?.occluders ?? null;
    this.walkableFloors = null;
  }

  clearHosts(): void {
    this.paintFloors.clear();
    for (const host of this.hosts) {
      host.gfx.destroy();
      host.marks?.destroy();
      if (host.kind === 'yi') host.telegraph.destroy();
    }
    this.hosts = [];
  }

  purgeDead(): void {
    const keep: Host[] = [];
    for (const host of this.hosts) {
      if (host.alive) {
        keep.push(host);
        continue;
      }
      this.paintFloors.delete(host.id);
      host.gfx.destroy();
      host.marks?.destroy();
      if (host.kind === 'yi') host.telegraph.destroy();
    }
    this.hosts = keep;
  }

  spawnForm(form: ContaminationForm): string | null {
    const scene = this.scene;
    const pins = this.pins;
    if (!scene || !pins) return null;
    const before = this.hosts.length;
    const slot = this.spawnSeq++;
    if (form.portfolio === 'yi') this.spawnYi(scene, form, this.wallSeat(form, pins, slot), slot);
    else if (form.portfolio === 'bing') this.spawnBing(scene, form, pins.paintFloors[0], slot, true);
    else if (form.portfolio === 'ding') this.spawnDing(scene, form, this.volumeSeat(form, pins), slot);
    else return null;
    return this.hosts[before]?.id ?? null;
  }

  getLastDraw(): SortieDraw | null {
    return this.lastDraw;
  }

  getVolumeSightMult(): number {
    return this.volumeSight;
  }

  getSubjects(): readonly HostSubject[] {
    return this.hosts
      .filter((h) => h.alive)
      .map((h) => ({ id: h.id, form: h.form, position: h.core }));
  }

  /**
   * Register world floor tiles that currently show this host's paint genome.
   * An empty registered surface has no danger; only never-registered hosts use the legacy fallback.
   * Paint never writes collision.
   */
  setStepFloors(hostId: string, floors: readonly { readonly col: number; readonly row: number }[]): void {
    const legal = new Set<string>();
    for (const floor of floors) {
      if (this.isLegalPaintFloor(floor.col, floor.row)) legal.add(`${floor.col},${floor.row}`);
    }
    this.paintFloors.set(hostId, legal);
    if (legal.size === 0) {
      this.disablePaintDeployment(hostId);
      return;
    }
    this.relocateBingColonyNuclei(hostId);
  }

  private disablePaintDeployment(hostId: string): void {
    // Invalid deployment is not a player kill; do not emit rewards/death noise.
    const host = this.hosts.find(h => h.id === hostId && h.kind === 'bing');
    if (host?.kind !== 'bing') return;
    host.alive = false;
    host.hp = 0;
    for (const nucleus of host.nuclei) nucleus.alive = false;
    host.gfx.clear();
    host.marks?.clear();
  }

  private isLegalPaintFloor(col: number, row: number): boolean {
    if (!Number.isInteger(col) || !Number.isInteger(row)) return false;
    if (this.walkableFloors && !this.walkableFloors.has(`${col},${row}`)) return false;
    if (!this.occluders) return true; // External legacy gym callers may lack terrain.
    const grid = this.occluders as OccluderGrid & { isWalkable?: (col: number, row: number) => boolean };
    if (col < 0 || row < 0 || col >= grid.cols || row >= grid.rows) return false;
    return grid.isWalkable ? grid.isWalkable(col, row) : !grid.isOpaque(col, row);
  }

  /** Query the same live tile gate used by chaos; renderers may dim dead colony regions. */
  isPaintFloorActive(hostId: string, col: number, row: number): boolean {
    const host = this.hosts.find(h => h.id === hostId && h.alive);
    return !!host && host.kind === 'bing' && this.bingOnPaint(host, col, row);
  }

  /** Hide stand-in Graphics. Combat / chaos / occupancy ticks stay on.
   * Colony hittable marks stay visible so scheme D oil film still reads as killable. */
  setSkipPaint(skip: boolean): void {
    this.skipPaint = skip;
    if (skip) this.hideDefaultPaint();
    else this.refreshDefaultPaint();
  }

  getVisualPin(hostId: string): HostVisualPin | null {
    const host = this.hosts.find((h) => h.id === hostId && h.alive);
    if (!host) return null;
    if (host.kind === 'yi') {
      if (!this.liveMotion) return { kind: 'wall', x: host.core.x, y: host.core.y };
      const attach = wallAttachForTile(host.tile, host.strikeFloors, TILE);
      return { kind: 'wall', x: host.core.x, y: host.core.y, attach };
    }
    // A colony's first reachable nucleus may move inside its surface; the
    // surface texture and registered world footprint must keep their birth anchor.
    if (host.kind === 'bing') return { kind: 'cluster', x: host.pin.cx, y: host.pin.cy };
    if (this.liveMotion) {
      return {
        kind: 'volume',
        x: host.live.x,
        y: host.live.y,
        width: host.live.w,
        height: host.live.h,
      };
    }
    return {
      kind: 'volume',
      x: host.box.minCol * TILE,
      y: host.box.minRow * TILE,
      width: (host.box.maxCol - host.box.minCol + 1) * TILE,
      height: (host.box.maxRow - host.box.minRow + 1) * TILE,
    };
  }

  getVisualSignal(hostId: string): HostVisualSignal {
    const host = this.hosts.find((h) => h.id === hostId && h.alive);
    if (!host) return 'idle';
    if (host.kind === 'yi') return host.windupMs >= 0 || host.strikeThisFrame ? 'strike' : 'idle';
    if (host.kind === 'bing') return isPaintInflated(host.phase) ? 'inflated' : 'idle';
    return host.awake ? 'awake' : 'idle';
  }

  /** The wall host's real hazard clock. It must not be replaced by a decorative pulse. */
  getAttackVisualState(hostId: string): FormAttackPose | undefined {
    const host = this.hosts.find((h) => h.id === hostId && h.alive);
    if (!host || host.kind !== 'yi') return undefined;
    if (host.strikeThisFrame) return { phase: 'strike', progress: 0 };
    if (host.windupMs >= 0) return {
      phase: 'windup', progress: Math.min(1, host.windupMs / C.ADJACENT_STRIKE_WINDUP_MS),
    };
    return { phase: 'idle', progress: 0 };
  }

  /** Shared by actual contact, renderer and inspection. Echo retains its prior contract. */
  getVolumePresenceFrame(hostId: string): Readonly<VolumePresenceFrame> | undefined {
    const host = this.hosts.find(h => h.id === hostId && h.alive);
    return host?.kind === 'ding' ? host.presence ?? undefined : undefined;
  }

  setVolumePreviewTime(hostId: string, timeMs: number | null, activeOverride?: boolean): void {
    const host = this.hosts.find(h => h.id === hostId && h.alive);
    if (!host || host.kind !== 'ding' || !host.presence) return;
    host.previewTimeMs = timeMs === null ? null : Math.max(0, timeMs);
    this.refreshVolumePresence(host, host.previewTimeMs ?? host.elapsedMs, timeMs === null ? this.volumeActive(host) : activeOverride ?? this.volumeActive(host));
  }

  private readonly volumeFloorAllowed = (col: number, row: number): boolean => this.isLegalPaintFloor(col, row);

  private volumeActive(host: DingHost): boolean {
    return host.activity.visual.phase === 'active' &&
      (host.form.lexemes.sense !== 'sense_reverse' || host.reverseActivity.active);
  }

  private refreshVolumePresence(host: DingHost, elapsedMs: number, active: boolean): void {
    if (!host.presence) return;
    updateVolumePresenceFrame(host.presence, { substrate: host.form.substrate, coverage: host.form.coverage,
      elapsedMs, rect: host.live, active, isWalkableFloor: this.volumeFloorAllowed });
    if (host.presence.hasPresence) { host.core.x = host.presence.coreX; host.core.y = host.presence.coreY; }
  }

  getActivityVisualState(hostId: string): Readonly<ActivityVisualState> | undefined {
    const host = this.hosts.find((h) => h.id === hostId && h.alive);
    if (!host) return undefined;
    const rhythm = host.activity.visual;
    if (host.kind !== 'ding' || host.form.lexemes.sense !== 'sense_reverse') return rhythm;
    const sense = host.reverseActivity.visual;
    // An observation gate and a pulse gate can coexist. Show the tighter opening;
    // neither one's active phase may visually override the other's closed state.
    if (rhythm.phase === 'active') return sense;
    if (sense.phase === 'active') return rhythm;
    return rhythm.progress <= sense.progress ? rhythm : sense;
  }

  reportNoise(pos: Readonly<Vector2>, radius: number): void {
    for (const host of this.hosts) {
      if (!host.alive || Math.hypot(pos.x - host.core.x, pos.y - host.core.y) > radius) continue;
      host.noiseRemainingMs = BEHAVIOR_PROFILE_DATA.rhythm_sleep!.wakeMs + C.ADJACENT_STRIKE_WINDUP_MS;
    }
  }

  /** Current 乙 telegraph cells. Empty for 丙/丁. Scheme D reads this while signal==='strike'. */
  getStrikeFloors(hostId: string): readonly { col: number; row: number }[] {
    const host = this.hosts.find((h) => h.id === hostId && h.alive);
    if (!host || host.kind !== 'yi') return [];
    return host.strikeFloors;
  }

  getVisualMoving(hostId: string): boolean {
    const host = this.hosts.find((h) => h.id === hostId && h.alive);
    if (!host) return false;
    if (host.kind === 'yi' || host.kind === 'ding') return host.moving;
    return false;
  }

  getVisualFacing(hostId: string): Facing4 {
    const pin = this.getVisualPin(hostId);
    if (pin?.attach) return facingFromAttach(pin.attach);
    return 'down';
  }

  /** Remaining hittable cores when `liveMotion`. Still-frame path returns 1. */
  getLiveNucleusCount(hostId: string): number {
    const host = this.hosts.find((h) => h.id === hostId && h.alive);
    if (!host) return 0;
    if (!this.liveMotion) return 1;
    const stop = resolveStopLoss(host.form);
    if (stop === 'illegal' || !stop.hittable) return 0;
    if (host.kind === 'bing' && host.nuclei.length > 0) {
      return host.nuclei.filter((n) => n.alive).length;
    }
    return 1;
  }

  isIdentifiable(hostId: string, playerCol: number, playerRow: number): boolean {
    const host = this.hosts.find((h) => h.id === hostId && h.alive);
    if (!host) return false;
    const vis = (this.getVisibility?.(host.core) ?? 0) > 0;
    if (host.kind === 'yi') return vis;
    if (host.kind === 'bing') {
      return this.bingPaintVisible(host) || this.bingOnPaint(host, playerCol, playerRow);
    }
    if (this.liveMotion) {
      const px = playerCol * TILE + TILE / 2;
      const py = playerRow * TILE + TILE / 2;
      return vis || (host.presence ? sampleVolumeDensity(host.presence, px, py) >= host.presence.dangerThreshold : pointInRect({ x: px, y: py }, host.live));
    }
    const inside =
      playerCol >= host.box.minCol &&
      playerCol <= host.box.maxCol &&
      playerRow >= host.box.minRow &&
      playerRow <= host.box.maxRow;
    return vis || inside;
  }

  update(dt: number, playerPos: Readonly<Vector2>, playerIsMoving = false, playerFacingAngle = 0): void {
    const combat = this.combat;
    const dtMs = Number.isFinite(dt) ? Math.max(0, Math.min(dt, GAME_CONSTANTS.AI.DT_CLAMP_MS)) : 0;
    this.volumeSight = 1;
    this.playerFacingAngle = playerFacingAngle;
    this.playerPosition.x = playerPos.x;
    this.playerPosition.y = playerPos.y;
    const col = Math.floor(playerPos.x / TILE);
    const row = Math.floor(playerPos.y / TILE);
    const swung = combat?.getAttackState().phase === 'active';
    if (!swung) this.swingHit = false;

    for (const host of this.hosts) {
      if (!host.alive) {
        host.gfx.setVisible(false);
        host.marks?.setVisible(false);
        if (host.kind === 'yi') host.telegraph.setVisible(false);
        continue;
      }
      host.noiseRemainingMs = Math.max(0, host.noiseRemainingMs - dtMs);
      host.hearingAccumMs += dtMs;
      if (host.hearingAccumMs >= GAME_CONSTANTS.AI.PERCEPTION_TICK_MS) {
        host.hearingAccumMs = 0;
        const asleep = host.form.lexemes.rhythm === 'rhythm_sleep' && host.activity.visual.phase === 'rest';
        const activeHearing = host.form.lexemes.sense === 'sense_hear' && host.activity.visual.phase === 'active';
        if (playerIsMoving && (asleep || activeHearing)) {
          const hear = ENEMY_DATA.rewriter;
          const clear = !this.occluders || hasLineOfSight(this.occluders, playerPos, host.core);
          const range = hear.hearingRange * (clear ? 1 : hear.hearingWallFactor) *
            (this.hearingPolicy?.getRangeMultiplier() ?? 1);
          if (Math.hypot(playerPos.x - host.core.x, playerPos.y - host.core.y) <= range) {
            // No repeated charge for a host already alerted by a real report/footstep.
            const suppressed = host.noiseRemainingMs === 0 && this.hearingPolicy?.suppressDiscovery(host.id);
            if (!suppressed) host.noiseRemainingMs = BEHAVIOR_PROFILE_DATA.rhythm_sleep!.wakeMs + C.ADJACENT_STRIKE_WINDUP_MS;
          }
        }
      }
      const touching = host.kind === 'yi' && host.strikeFloors.some(f => f.col === col && f.row === row);
      host.activity.tick(dtMs, host.noiseRemainingMs > 0, !touching && host.noiseRemainingMs === 0);
      const stop = this.liveMotion ? resolveStopLoss(host.form) : null;
      const hittable = !this.liveMotion || (stop !== null && stop !== 'illegal' && stop.hittable);
      if (combat && swung && !this.swingHit && hittable) {
        if (this.liveMotion && host.kind === 'bing' && host.nuclei.length > 0) {
          const hit = host.nuclei.find((n) => n.alive && this.coreInSwing(playerPos, combat.getLockedAttackAngle(), n.core));
          if (hit) {
            this.hitCore(host, hit);
            this.swingHit = true;
          }
        } else if (this.coreInSwing(playerPos, combat.getLockedAttackAngle(), host.core, host)) {
          this.hitCore(host);
          this.swingHit = true;
        }
      }
      if (!host.alive) continue;
      if (host.kind === 'yi') this.tickYi(host, col, row, dtMs);
      else if (host.kind === 'bing') this.tickBing(host, col, row, dtMs);
      else this.tickDing(host, col, row, playerPos, dtMs);
    }
    this.lastPlayerTile = { col, row };
  }

  private wallSeat(form: ContaminationForm, pins: ContaminationPins, slot = 0): WallEdgePolyline | undefined {
    if (form.substrate !== 'doorframe' || !this.occluders) return pins.wallEdges[0];
    const seats = doorwayWallSeats(pins.wallEdges, this.occluders);
    return seats.length ? seats[slot % seats.length] : undefined;
  }

  private spawnYi(
    scene: Phaser.Scene,
    form: ContaminationForm,
    edge: WallEdgePolyline | undefined,
    slot = 0,
  ): void {
    if (!edge || edge.tiles.length === 0) {
      console.warn('[contamination-hosts] yi skipped: no wall edge');
      return;
    }
    if (resolveStopLoss(form) === 'illegal') {
      console.warn('[contamination-hosts] yi skipped: illegal stop-loss');
      return;
    }
    const tile = edge.tiles[Math.min(slot, edge.tiles.length - 1)]!;
    // Tile identity is the original collectWallEdges / practice-pin array slot.
    // Do not substitute orderWallEdgeTiles here — that would change which cell
    // 乙 occupies on a sortie. liveMotion only walks after that same birth cell.
    const center = { x: tile.col * TILE + TILE / 2, y: tile.row * TILE + TILE / 2 };
    const attach = wallAttachForTile(tile, edge.strikeFloors, TILE);
    const core = this.liveMotion ? { x: attach.seamX, y: attach.seamY } : center;
    const gfx = scene.add.graphics().setDepth(20);
    const telegraph = scene.add.graphics().setDepth(21);
    const marks = this.liveMotion ? scene.add.graphics().setDepth(22) : null;
    this.paintYi(gfx, core, false);
    const floors = edge.strikeFloors.map((f) => ({ col: f.col, row: f.row }));
    let walk: YiWalkState | null = null;
    let strikeFloors = floors;
    if (this.liveMotion) {
      const ordered = orderWallEdgeTiles(edge.tiles);
      const segments = splitWalkSegments(ordered);
      const segment = segmentContaining(segments, tile) ?? segments[0] ?? [tile];
      const along = Math.max(
        0,
        segment.findIndex((t) => t.col === tile.col && t.row === tile.row),
      );
      walk = { segment, along, dir: 1, turnAccumMs: 0 };
      const local = strikeFloorsAt(tile, floors);
      if (local.length > 0) strikeFloors = local;
    }
    this.hosts.push({
      kind: 'yi',
      id: `ENM_YI_${String(slot + 1).padStart(2, '0')}`,
      form,
      activity: new ActivityClock(form.lexemes.rhythm, `yi:${slot}:${core.x}:${core.y}`),
      noiseRemainingMs: 0, hearingAccumMs: 0,
      hp: C.CORE_MAX_HEALTH,
      alive: true,
      gfx,
      core,
      tile: { col: tile.col, row: tile.row },
      strikeFloors,
      windupMs: -1,
      strikeThisFrame: false,
      windupCol: -1,
      windupRow: -1,
      telegraph,
      walk,
      floorUniverse: floors,
      moving: false,
      marks,
    });
    if (this.skipPaint) telegraph.setVisible(false);
  }

  private spawnBing(
    scene: Phaser.Scene,
    form: ContaminationForm,
    pin: PaintFloorPin | undefined,
    slot = 0,
    stagger = false,
  ): void {
    if (!pin) {
      console.warn('[contamination-hosts] bing skipped: no paint seat');
      return;
    }
    if (resolveStopLoss(form) === 'illegal') {
      console.warn('[contamination-hosts] bing skipped: illegal stop-loss');
      return;
    }
    const seat = seatFromPaint(pin);
    const gfx = scene.add.graphics().setDepth(0.2);
    const ox = stagger ? (slot % 3) * TILE : 0;
    const oy = stagger ? Math.floor(slot / 3) * TILE : 0;
    const core = { x: seat.cx + ox, y: seat.cy + oy };
    const floorCol = seat.floorCol + (stagger ? slot % 3 : 0);
    const floorRow = seat.floorRow + (stagger ? Math.floor(slot / 3) : 0);
    const placed: BingSeat = { floorCol, floorRow, cx: core.x, cy: core.y };
    if (!this.liveMotion) this.paintCore(gfx, core, 0x2ae6c8, 3);
    const nuclei = this.liveMotion ? this.spawnBingNuclei(form, placed, ox, oy) : [];
    const marks = this.liveMotion ? scene.add.graphics().setDepth(BING_MARK_DEPTH) : null;
    this.hosts.push({
      kind: 'bing',
      id: `ENM_BING_${String(slot + 1).padStart(2, '0')}`,
      form,
      activity: new ActivityClock(form.lexemes.rhythm, `bing:${slot}:${core.x}:${core.y}`),
      noiseRemainingMs: 0, hearingAccumMs: 0,
      hp: C.CORE_MAX_HEALTH,
      alive: true,
      gfx,
      core: nuclei[0]?.core ?? core,
      pin: placed,
      phase: slot * 2.1,
      nuclei,
      marks,
    });
  }

  private volumeSeat(form: ContaminationForm, pins: ContaminationPins): CorridorAabb | undefined {
    return isMaterialVolume(form.substrate)
      ? findTerrainSafeVolumeSeat(pins.corridorAabbs, this.volumeFloorAllowed)
      : pins.corridorAabbs[0];
  }

  private spawnDing(
    scene: Phaser.Scene,
    form: ContaminationForm,
    box: CorridorAabb | undefined,
    slot = 0,
  ): void {
    if (!box) {
      console.warn('[contamination-hosts] ding skipped: no corridor');
      return;
    }
    if (resolveStopLoss(form) === 'illegal') {
      console.warn('[contamination-hosts] ding skipped: illegal stop-loss');
      return;
    }
    const gfx = scene.add.graphics().setDepth(C.VOLUME_DEPTH);
    const core = {
      x: box.coreCol * TILE + TILE / 2 + (slot % 2) * TILE,
      y: box.coreRow * TILE + TILE / 2,
    };
    this.paintDing(gfx, box, core, false);
    const marks = this.liveMotion ? scene.add.graphics().setDepth(C.VOLUME_DEPTH + 1) : null;
    this.hosts.push({
      kind: 'ding',
      presence: isMaterialVolume(form.substrate) ? createVolumePresenceFrame() : null,
      previewTimeMs: null,
      id: `ENM_DING_${String(slot + 1).padStart(2, '0')}`,
      form,
      activity: new ActivityClock(form.lexemes.rhythm, `ding:${slot}:${core.x}:${core.y}`),
      noiseRemainingMs: 0, hearingAccumMs: 0,
      reverseActivity: new ReverseActivityClock(),
      hp: C.CORE_MAX_HEALTH,
      alive: true,
      gfx,
      core,
      box,
      awake: false,
      live: aabbPixelRect(box, TILE),
      elapsedMs: 0,
      moving: false,
      marks,
    });
    const host = this.hosts[this.hosts.length - 1] as DingHost;
    this.refreshVolumePresence(host, 0, this.volumeActive(host));
  }

  private tickYi(host: YiHost, col: number, row: number, dtMs: number): void {
    if (this.liveMotion) this.tickYiLive(host, col, row, dtMs);
    else this.tickYiSortie(host, col, row, dtMs);
  }

  /** Pre-R2-C2 body. Do not read lexemes. Do not move the core. */
  private tickYiSortie(host: YiHost, col: number, row: number, dtMs: number): void {
    const onStrike = host.strikeFloors.some((f) => f.col === col && f.row === row);
    host.telegraph.clear();
    if (onStrike) {
      if (host.windupMs < 0) host.windupMs = 0;
      host.windupMs += dtMs;
      const cell = host.strikeFloors.find((f) => f.col === col && f.row === row)!;
      if (!this.skipPaint) {
        host.telegraph.fillStyle(0x1aad96, 0.55);
        host.telegraph.fillRect(cell.col * TILE + 14, cell.row * TILE + 14, 4, 4);
      }
      if (host.windupMs >= C.ADJACENT_STRIKE_WINDUP_MS) {
        this.combat?.applyHazardHit(host.id, C.ADJACENT_STRIKE_DAMAGE);
        host.windupMs = 0;
      }
    } else {
      host.windupMs = -1;
    }
    this.paintYi(host.gfx, host.core, onStrike);
  }

  private tickYiLive(host: YiHost, col: number, row: number, dtMs: number): void {
    host.strikeThisFrame = false;
    const stop = resolveStopLoss(host.form);
    if (stop === 'illegal') return;
    const walk = host.walk;
    if (walk && host.activity.visual.phase === 'active') {
      const stepped = stepYiWalk(walk, host.form.lexemes.motion, dtMs, TILE, host.floorUniverse);
      walk.along = stepped.along;
      walk.dir = stepped.dir;
      walk.turnAccumMs = stepped.turnAccumMs;
      host.tile = { col: stepped.tile.col, row: stepped.tile.row };
      host.core = stepped.core;
      host.strikeFloors = stepped.strikeFloors.map((f) => ({ col: f.col, row: f.row }));
      host.moving = stepped.moving;
    } else {
      host.moving = false;
    }
    const channel = resolveContactChannel(host.form.portfolio, host.form.lexemes.contact);
    const canStrike = channel === 'adjacent_hp';
    const adjacent = host.strikeFloors.some((f) => f.col === col && f.row === row);
    const committed = host.windupMs >= 0 && host.windupCol === col && host.windupRow === row;
    const hears = host.form.lexemes.sense !== 'sense_hear' || host.noiseRemainingMs > 0;
    const sees = host.form.lexemes.sense !== 'sense_narrow' || this.wallSeesPlayer(host);
    const onStrike = canStrike && adjacent && (committed || (host.activity.visual.phase === 'active' && hears && sees));
    host.telegraph.clear();
    if (onStrike) {
      // A new threatened cell is shown for a frame before its timer advances. A large
      // delta or stepping between adjacent cells cannot bypass the visible warning.
      if (host.windupMs < 0 || host.windupCol !== col || host.windupRow !== row) {
        host.windupMs = 0;
        host.windupCol = col;
        host.windupRow = row;
      } else {
        host.windupMs += dtMs;
      }
      const cell = host.strikeFloors.find((f) => f.col === col && f.row === row)!;
      if (!this.skipPaint) {
        host.telegraph.fillStyle(0x1aad96, 0.55);
        host.telegraph.fillRect(cell.col * TILE + 14, cell.row * TILE + 14, 4, 4);
      }
      if (host.windupMs >= C.ADJACENT_STRIKE_WINDUP_MS) {
        this.combat?.applyHazardHit(host.id, C.ADJACENT_STRIKE_DAMAGE);
        host.strikeThisFrame = true;
        host.windupMs = -1;
      }
    } else {
      host.windupMs = -1;
    }
    this.paintYi(host.gfx, host.core, onStrike);
    this.paintMarks(host);
  }

  private wallSeesPlayer(host: YiHost): boolean {
    const attach = wallAttachForTile(host.tile, host.strikeFloors, TILE);
    const x = this.playerPosition.x;
    const y = this.playerPosition.y;
    const facing = Math.atan2(attach.ny, attach.nx);
    const bearing = Math.atan2(y - host.core.y, x - host.core.x);
    if (Math.abs(shortestArc(bearing - facing)) > degToRad(BEHAVIOR_PROFILE_DATA.sense_narrow!.coneDeg / 2)) return false;
    this.visQuery.x = host.core.x + attach.nx * .5;
    this.visQuery.y = host.core.y + attach.ny * .5;
    this.swingTarget.x = x; this.swingTarget.y = y;
    return !this.occluders || hasLineOfSight(this.occluders, this.visQuery, this.swingTarget);
  }

  private tickBing(host: BingHost, col: number, row: number, dtMs: number): void {
    if (this.liveMotion) this.tickBingLive(host, col, row, dtMs);
    else this.tickBingSortie(host, col, row, dtMs);
  }

  /** Pre-R2-C2 body. Always step-chaos. Does not read lexemes.contact. */
  private tickBingSortie(host: BingHost, col: number, row: number, dtMs: number): void {
    host.phase += dtMs * PAINT_BREATH;
    const inflated = isPaintInflated(host.phase);
    const onPaint = this.bingOnPaint(host, col, row);
    const stepped = col !== this.lastPlayerTile.col || row !== this.lastPlayerTile.row;
    if (onPaint && stepped) {
      const amount = inflated ? C.PAINT_STEP_CHAOS_INFLATED : C.PAINT_STEP_CHAOS_REST;
      this.chaos?.addChaos('paint_step', amount);
    }
    this.paintCore(host.gfx, host.core, inflated ? 0x3cffd4 : 0x2ae6c8, inflated ? 4 : 3);
  }

  private tickBingLive(host: BingHost, col: number, row: number, dtMs: number): void {
    const stop = resolveStopLoss(host.form);
    if (stop === 'illegal') return;
    host.phase += dtMs * PAINT_BREATH;
    const inflated = isPaintInflated(host.phase);
    const stepped = col !== this.lastPlayerTile.col || row !== this.lastPlayerTile.row;
    const channel = resolveContactChannel(host.form.portfolio, host.form.lexemes.contact);
    if (channel === 'step_chaos' && stepped) {
      if (this.bingOnPaint(host, col, row)) {
        const amount = inflated ? C.PAINT_STEP_CHAOS_INFLATED : C.PAINT_STEP_CHAOS_REST;
        this.chaos?.addChaos('paint_step', amount);
      }
    }
    for (const nucleus of host.nuclei) {
      if (nucleus.flashMs > 0) nucleus.flashMs = Math.max(0, nucleus.flashMs - dtMs);
    }
    this.paintBingLive(host, inflated);
    this.paintMarks(host);
  }

  private bingPaintVisible(host: BingHost): boolean {
    const floors = this.paintFloors.get(host.id);
    if (floors && floors.size > 0) {
      for (const key of floors) {
        const comma = key.indexOf(',');
        const col = Number(key.slice(0, comma));
        const row = Number(key.slice(comma + 1));
        this.visQuery.x = col * TILE + TILE / 2;
        this.visQuery.y = row * TILE + TILE / 2;
        if ((this.getVisibility?.(this.visQuery) ?? 0) > 0) return true;
      }
      return false;
    }
    return (this.getVisibility?.(host.core) ?? 0) > 0;
  }

  /**
   * Colony: each alive nucleus Chebyshev ≤ 1 (spec: dead nucleus drops its 3×3).
   * Field oil film: genome paint tiles. No row → pin Chebyshev ≤ 1.
   */
  private bingOnPaint(host: BingHost, col: number, row: number): boolean {
    if (!this.isLegalPaintFloor(col, row)) return false;
    const floors = this.paintFloors.get(host.id);
    // Registered visual coverage is authoritative even when it is empty.
    if (floors && !floors.has(`${col},${row}`)) return false;
    if (host.nuclei.length > 0) {
      return host.nuclei.some(
        (nucleus) =>
          nucleus.alive && chebyshevTiles({ col, row }, { col: nucleus.floorCol, row: nucleus.floorRow }) <= 1,
      );
    }
    if (floors) return floors.has(`${col},${row}`);
    return Math.abs(col - host.pin.floorCol) <= 1 && Math.abs(row - host.pin.floorRow) <= 1;
  }

  private tickDing(
    host: DingHost,
    col: number,
    row: number,
    playerPos: Readonly<Vector2>,
    dtMs: number,
  ): void {
    if (this.liveMotion || host.presence) this.tickDingLive(host, playerPos, dtMs);
    else this.tickDingSortie(host, col, row, playerPos, dtMs);
  }

  /** Pre-R2-C2 body. Birth box only. Does not read lexemes. Does not move the box. */
  private tickDingSortie(
    host: DingHost,
    col: number,
    row: number,
    playerPos: Readonly<Vector2>,
    dtMs: number,
  ): void {
    const inside =
      col >= host.box.minCol &&
      col <= host.box.maxCol &&
      row >= host.box.minRow &&
      row <= host.box.maxRow;
    const vis = this.getVisibility?.(host.core) ?? 0;
    host.awake = vis > 0;
    if (inside) {
      this.volumeSight = C.VOLUME_SIGHT_MULT;
      this.chaos?.addChaos('volume_field', C.VOLUME_CHAOS_PER_SEC * (dtMs / 1000));
    }
    this.paintDing(host.gfx, host.box, host.core, host.awake);
    void playerPos;
  }

  private tickDingLive(host: DingHost, playerPos: Readonly<Vector2>, dtMs: number): void {
    const stop = resolveStopLoss(host.form);
    if (stop === 'illegal') return;
    const prev = host.live;
    if (host.activity.visual.phase === 'active') host.elapsedMs += dtMs;
    // New material volumes own their complete shape cycle; do not compound it
    // with the legacy echo box morph (which can flip a near-square mist axis).
    if (!host.presence) host.live = dingLiveRect(host.box, host.form.lexemes.motion, host.elapsedMs, TILE);
    if (!host.presence) host.core = rectCenter(host.live);
    else this.refreshVolumePresence(host, host.previewTimeMs ?? host.elapsedMs, this.volumeActive(host));
    host.moving =
      Math.abs(host.live.x - prev.x) > 0.05 ||
      Math.abs(host.live.y - prev.y) > 0.05 ||
      Math.abs(host.live.w - prev.w) > 0.05 ||
      Math.abs(host.live.h - prev.h) > 0.05;
    const vis = this.getVisibility?.(host.core) ?? 0;
    host.awake = vis > 0;
    if (host.form.lexemes.sense === 'sense_reverse') {
      host.reverseActivity.tick(dtMs, this.watchingVolume(host, playerPos));
      host.awake = host.reverseActivity.active;
    }
    host.awake = host.awake && host.activity.visual.phase === 'active';
    const channel = resolveContactChannel(host.form.portfolio, host.form.lexemes.contact);
    const active = this.volumeActive(host);
    this.refreshVolumePresence(host, host.previewTimeMs ?? host.elapsedMs, active);
    const inside = host.presence ? isVolumeDangerousAt(host.presence, playerPos.x, playerPos.y) : pointInRect(playerPos, host.live);
    if (channel === 'volume_chaos_sight' && inside && active) {
      this.volumeSight = C.VOLUME_SIGHT_MULT;
      this.chaos?.addChaos('volume_field', C.VOLUME_CHAOS_PER_SEC * (dtMs / 1000));
    }
    this.paintDing(host.gfx, host.box, host.core, host.awake, host.live);
    this.paintMarks(host);
  }

  private watchingVolume(host: DingHost, playerPos: Readonly<Vector2>): boolean {
    if (host.presence) {
      const f = host.presence, dx = Math.cos(this.playerFacingAngle), dy = Math.sin(this.playerFacingAngle);
      if (sampleVolumeDensity(f, playerPos.x, playerPos.y) >= f.dangerThreshold) {
        const bearing = Math.atan2(host.core.y - playerPos.y, host.core.x - playerPos.x);
        if (Math.abs(shortestArc(bearing - this.playerFacingAngle)) > Math.PI / 3) return false;
        return (!this.getVisibility || this.getVisibility(host.core) > 0) &&
          (!this.occluders || hasLineOfSight(this.occluders, playerPos, host.core));
      }
      const limit = Math.hypot(playerPos.x - (f.rect.x + f.rect.w / 2), playerPos.y - (f.rect.y + f.rect.h / 2)) + Math.hypot(f.rect.w, f.rect.h);
      for (let d = 0; d <= limit; d += 4) {
        this.visQuery.x = playerPos.x + dx * d; this.visQuery.y = playerPos.y + dy * d;
        if (sampleVolumeDensity(f, this.visQuery.x, this.visQuery.y) < f.dangerThreshold) continue;
        if (this.getVisibility && this.getVisibility(this.visQuery) <= 0) continue;
        return !this.occluders || hasLineOfSight(this.occluders, playerPos, this.visQuery);
      }
      return false;
    }
    const rect = host.live;
    if (pointInRect(playerPos, rect)) {
      const bearing = Math.atan2(host.core.y - playerPos.y, host.core.x - playerPos.x);
      if (Math.abs(shortestArc(bearing - this.playerFacingAngle)) > Math.PI / 3) return false;
      this.visQuery.x = host.core.x; this.visQuery.y = host.core.y;
    } else {
      const dx = Math.cos(this.playerFacingAngle);
      const dy = Math.sin(this.playerFacingAngle);
      let near = 0; let far = Infinity;
      for (let axis = 0; axis < 2; axis++) {
        const start = axis === 0 ? playerPos.x : playerPos.y;
        const direction = axis === 0 ? dx : dy;
        const min = axis === 0 ? rect.x : rect.y;
        const max = min + (axis === 0 ? rect.w : rect.h);
        if (Math.abs(direction) < .00001) {
          if (start < min || start > max) return false;
        } else {
          const a = (min - start) / direction;
          const b = (max - start) / direction;
          near = Math.max(near, Math.min(a, b)); far = Math.min(far, Math.max(a, b));
          if (far < near) return false;
        }
      }
      this.visQuery.x = playerPos.x + dx * (near + .01);
      this.visQuery.y = playerPos.y + dy * (near + .01);
      if (this.getVisibility && this.getVisibility(this.visQuery) <= 0) return false;
    }
    return !this.occluders || hasLineOfSight(this.occluders, playerPos, this.visQuery);
  }

  private spawnBingNuclei(
    form: ContaminationForm,
    pin: BingSeat,
    ox: number,
    oy: number,
  ): BingNucleus[] {
    const stop = resolveStopLoss(form);
    if (stop === 'illegal' || stop.family !== 'scatter_rejoin') return [];
    const seats = colonyNucleusSeats(
      { col: pin.floorCol, row: pin.floorRow },
      C.COLONY_NUCLEUS_COUNT_MIN,
      C.COLONY_NUCLEUS_MIN_TILE_GAP,
    );
    return seats.map((seat) => ({
      core: { x: seat.col * TILE + TILE / 2 + ox, y: seat.row * TILE + TILE / 2 + oy },
      hp: C.CORE_MAX_HEALTH,
      alive: true,
      floorCol: seat.col,
      floorRow: seat.row,
      flashMs: 0,
    }));
  }

  private relocateBingColonyNuclei(hostId: string): void {
    const host = this.hosts.find((row) => row.id === hostId && row.alive);
    if (!host || host.kind !== 'bing' || !this.liveMotion) return;
    const stop = resolveStopLoss(host.form);
    if (stop === 'illegal' || stop.family !== 'scatter_rejoin') return;
    const keys = this.paintFloors.get(hostId);
    if (!keys || keys.size === 0) return;
    const tiles: { col: number; row: number }[] = [];
    for (const key of keys) {
      const comma = key.indexOf(',');
      const col = Number(key.slice(0, comma));
      const row = Number(key.slice(comma + 1));
      if (!this.isLegalPaintFloor(col, row)) continue;
      tiles.push({ col, row });
    }
    if (tiles.length === 0) return;
    const seats = colonyNucleusSeatsInFloors(
      tiles,
      C.COLONY_NUCLEUS_COUNT_MIN,
      C.COLONY_NUCLEUS_COUNT_MAX,
      C.COLONY_NUCLEUS_MIN_TILE_GAP,
      2,
    );
    if (seats.length < C.COLONY_NUCLEUS_COUNT_MIN) {
      this.disablePaintDeployment(hostId);
      return;
    }
    host.nuclei = seats.map((seat) => ({
      core: { x: seat.col * TILE + TILE / 2, y: seat.row * TILE + TILE / 2 },
      hp: C.CORE_MAX_HEALTH,
      alive: true,
      floorCol: seat.col,
      floorRow: seat.row,
      flashMs: 0,
    }));
    host.core = host.nuclei[0]!.core;
    this.paintMarks(host);
  }

  private paintBingLive(host: BingHost, inflated: boolean): void {
    if (this.skipPaint) {
      host.gfx.clear();
      host.gfx.setVisible(false);
      return;
    }
    host.gfx.setVisible(true);
    host.gfx.clear();
    const stop = resolveStopLoss(host.form);
    if (stop === 'illegal' || !stop.hittable) {
      host.gfx.fillStyle(0x1a6b5c, inflated ? 0.4 : 0.28);
      host.gfx.fillRect(host.pin.floorCol * TILE + 6, host.pin.floorRow * TILE + 6, TILE - 12, TILE - 12);
      return;
    }
    const stain = inflated ? 0.32 : 0.2;
    const floors =
      host.nuclei.length > 0
        ? host.nuclei.filter((n) => n.alive).map((n) => ({ col: n.floorCol, row: n.floorRow }))
        : [{ col: host.pin.floorCol, row: host.pin.floorRow }];
    host.gfx.fillStyle(0x1a6b5c, stain);
    for (const floor of floors) {
      host.gfx.fillRect(floor.col * TILE + 6, floor.row * TILE + 6, TILE - 12, TILE - 12);
    }
  }

  private paintMarks(host: Host): void {
    const gfx = host.marks;
    if (!gfx || !this.liveMotion) return;
    gfx.clear();
    const stop = resolveStopLoss(host.form);
    if (stop === 'illegal' || !stop.hittable) {
      gfx.setVisible(false);
      return;
    }
    const colonyCores = host.kind === 'bing' && host.nuclei.length > 0;
    if (this.skipPaint && !colonyCores) {
      gfx.setVisible(false);
      return;
    }
    const standard = host.kind === 'ding' ? 2 : 3;
    const size = coreMarkPx(stop.corePolicy, standard);
    if (size <= 0) {
      gfx.setVisible(false);
      return;
    }
    gfx.setVisible(true);
    if (colonyCores) {
      gfx.setDepth(BING_MARK_DEPTH);
      for (const nucleus of host.nuclei) {
        if (!nucleus.alive) continue;
        const flash = nucleus.flashMs > 0;
        this.paintCore(gfx, nucleus.core, flash ? 0x3cffd4 : 0x2ae6c8, size, true, true);
      }
      return;
    }
    this.paintCore(gfx, host.core, 0x2ae6c8, size, true, true);
  }

  private coreInSwing(origin: Readonly<Vector2>, angle: number, core: Vector2, host?: Host): boolean {
    const combat = GAME_CONSTANTS.COMBAT;
    const dx = core.x - origin.x;
    const dy = core.y - origin.y;
    const dist = Math.hypot(dx, dy);
    if (dist > combat.ATTACK_RANGE) return false;
    const bearing = Math.atan2(dy, dx);
    if (dist >= combat.ATTACK_MIN_ANGLE_BYPASS &&
        Math.abs(shortestArc(bearing - angle)) > degToRad(combat.ATTACK_HALF_ANGLE)) return false;
    if (!this.occluders) return true; // Older external practice callers may have no terrain.
    this.swingTarget.x = core.x;
    this.swingTarget.y = core.y;
    if (host?.kind === 'yi') {
      const attach = wallAttachForTile(host.tile, host.strikeFloors, TILE);
      this.swingTarget.x += attach.nx * .5;
      this.swingTarget.y += attach.ny * .5;
    }
    return hasLineOfSight(this.occluders, origin, this.swingTarget);
  }

  private hitCore(host: Host, nucleus?: BingNucleus): void {
    host.noiseRemainingMs = BEHAVIOR_PROFILE_DATA.rhythm_sleep!.wakeMs + C.ADJACENT_STRIKE_WINDUP_MS;
    if (this.liveMotion) {
      const stop = resolveStopLoss(host.form);
      if (stop === 'illegal' || !stop.hittable) return;
      if (host.kind === 'bing' && stop.family === 'scatter_rejoin') {
        if (!nucleus || !nucleus.alive) return;
        const amount = GAME_CONSTANTS.COMBAT.PLAYER_DAMAGE;
        nucleus.hp -= amount;
        nucleus.flashMs = 80;
        eventBus.emit(GameEvent.ENEMY_DAMAGED, { enemyId: host.id, amount, source: 'player' });
        if (nucleus.hp > 0) return;
        nucleus.alive = false;
        if (host.nuclei.some((n) => n.alive)) return;
        host.alive = false;
        host.hp = 0;
        host.gfx.clear();
        host.marks?.clear();
        eventBus.emit(GameEvent.ENEMY_KILLED, {
          enemyId: host.id,
          position: { x: host.core.x, y: host.core.y },
        });
        return;
      }
    }
    const amount = GAME_CONSTANTS.COMBAT.PLAYER_DAMAGE;
    host.hp -= amount;
    eventBus.emit(GameEvent.ENEMY_DAMAGED, { enemyId: host.id, amount, source: 'player' });
    if (host.hp > 0) return;
    host.alive = false;
    host.gfx.clear();
    host.marks?.clear();
    if (host.kind === 'yi') host.telegraph.clear();
    eventBus.emit(GameEvent.ENEMY_KILLED, { enemyId: host.id, position: { x: host.core.x, y: host.core.y } });
  }

  private paintYi(gfx: Phaser.GameObjects.Graphics, core: Vector2, hot: boolean): void {
    if (this.skipPaint) {
      gfx.clear();
      gfx.setVisible(false);
      return;
    }
    gfx.setVisible(true);
    gfx.clear();
    if (this.liveMotion) return;
    gfx.fillStyle(hot ? 0x3cffd4 : 0x2ae6c8, 1);
    gfx.fillRect(Math.round(core.x) - 1, Math.round(core.y) - 1, 3, 3);
  }

  private paintCore(
    gfx: Phaser.GameObjects.Graphics,
    core: Vector2,
    color: number,
    size: number,
    append = false,
    ignoreSkip = false,
  ): void {
    if (this.skipPaint && !ignoreSkip) {
      gfx.clear();
      gfx.setVisible(false);
      return;
    }
    gfx.setVisible(true);
    if (!append) gfx.clear();
    gfx.fillStyle(color, 1);
    const half = (size / 2) | 0;
    gfx.fillRect(Math.round(core.x) - half, Math.round(core.y) - half, size, size);
  }

  private paintDing(
    gfx: Phaser.GameObjects.Graphics,
    box: CorridorAabb,
    core: Vector2,
    awake: boolean,
    live?: PixelRect,
  ): void {
    if (this.skipPaint) {
      gfx.clear();
      gfx.setVisible(false);
      return;
    }
    gfx.setVisible(true);
    gfx.clear();
    gfx.fillStyle(0x0e4a3f, awake ? 0.55 : 0.32);
    const rect = live ?? aabbPixelRect(box, TILE);
    gfx.fillRect(rect.x, rect.y, rect.w, rect.h);
    if (this.liveMotion) return;
    gfx.fillStyle(awake ? 0x2ae6c8 : 0x1a6b5c, 1);
    gfx.fillRect(Math.round(core.x) - 1, Math.round(core.y) - 1, 2, 2);
  }

  private hideDefaultPaint(): void {
    for (const host of this.hosts) {
      host.gfx.clear();
      host.gfx.setVisible(false);
      if (host.kind === 'yi') {
        host.telegraph.clear();
        host.telegraph.setVisible(false);
      }
      this.paintMarks(host);
    }
  }

  private refreshDefaultPaint(): void {
    for (const host of this.hosts) {
      if (!host.alive) {
        host.gfx.setVisible(false);
        host.marks?.setVisible(false);
        if (host.kind === 'yi') host.telegraph.setVisible(false);
        continue;
      }
      if (host.kind === 'yi') {
        host.telegraph.setVisible(true);
        this.paintYi(host.gfx, host.core, host.windupMs >= 0);
      } else if (host.kind === 'bing') {
        const inflated = isPaintInflated(host.phase);
        if (this.liveMotion) this.paintBingLive(host, inflated);
        else this.paintCore(host.gfx, host.core, inflated ? 0x3cffd4 : 0x2ae6c8, inflated ? 4 : 3);
      } else {
        this.paintDing(
          host.gfx,
          host.box,
          host.core,
          host.awake,
          this.liveMotion ? host.live : undefined,
        );
      }
      this.paintMarks(host);
    }
  }
}

function walkableFloorKeys(tiles: readonly number[][]): Set<string> {
  const keys = new Set<string>();
  for (let row = 0; row < tiles.length; row++) {
    const line = tiles[row];
    if (!line) continue;
    for (let col = 0; col < line.length; col++) {
      if (line[col] === TileType.FLOOR) keys.add(`${col},${row}`);
    }
  }
  return keys;
}
