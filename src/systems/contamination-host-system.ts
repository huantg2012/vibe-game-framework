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
import type { ContaminationForm, SortieDraw } from '@/generation/contamination-draw';
import type { ClusterCorePin, ContaminationPins, CorridorAabb, GeneratedRiftLayout, WallEdgePolyline } from '@/generation/types';
import { orderWallEdgeTiles, wallAttachForTile, type FormWallAttach } from '@/generation/wall-edge-path';
import type { CombatSystem } from '@/systems/combat-system';
import type { ChaosSystem } from '@/systems/chaos-system';
import {
  aabbPixelRect,
  chebyshevTiles,
  colonyNucleusSeats,
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
import type { Vector2 } from '@/types/game-types';
import { degToRad, shortestArc } from '@/utils/math';

const C = GAME_CONSTANTS.CONTAMINATION;
const TILE = GAME_CONSTANTS.TILE_SIZE;

export interface HostSubject {
  readonly id: string;
  readonly form: ContaminationForm;
  readonly position: Vector2;
}

interface HostBase {
  id: string;
  form: ContaminationForm;
  hp: number;
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
}

interface BingHost extends HostBase {
  kind: 'bing';
  pin: ClusterCorePin;
  phase: number;
  /** Live colony only. Empty when `liveMotion` is false and on unkillable field. */
  nuclei: BingNucleus[];
}

interface DingHost extends HostBase {
  kind: 'ding';
  box: CorridorAabb;
  awake: boolean;
  live: PixelRect;
  elapsedMs: number;
  moving: boolean;
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

    const pins = layout.contaminationPins;
    const drawn = layout.contaminationDraw;
    this.lastDraw = drawn;
    for (const w of drawn.warnings) console.warn(`[contamination-hosts] ${w}`);

    for (const form of drawn.forms) {
      if (form.portfolio === 'jia') continue;
      if (form.portfolio === 'yi') this.spawnYi(scene, form, pins.wallEdges[0]);
      else if (form.portfolio === 'bing') this.spawnBing(scene, form, pins.clusterCores[0]);
      else if (form.portfolio === 'ding') this.spawnDing(scene, form, pins.corridorAabbs[0]);
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
  }

  clearHosts(): void {
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
    if (form.portfolio === 'yi') this.spawnYi(scene, form, pins.wallEdges[0], slot);
    else if (form.portfolio === 'bing') this.spawnBing(scene, form, pins.clusterCores[0], slot);
    else if (form.portfolio === 'ding') this.spawnDing(scene, form, pins.corridorAabbs[0], slot);
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

  /** Hide stand-in Graphics. Combat / chaos / occupancy ticks stay on. */
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
    if (host.kind === 'bing') return { kind: 'cluster', x: host.core.x, y: host.core.y };
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
    if (host.kind === 'yi') return host.windupMs >= 0 ? 'strike' : 'idle';
    if (host.kind === 'bing') return Math.sin(host.phase) > 0.35 ? 'inflated' : 'idle';
    return host.awake ? 'awake' : 'idle';
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
      if (host.nuclei.length > 0) {
        const onPaint = host.nuclei.some(
          (n) => n.alive && Math.abs(playerCol - n.floorCol) <= 1 && Math.abs(playerRow - n.floorRow) <= 1,
        );
        return vis || onPaint;
      }
      const onPaint =
        Math.abs(playerCol - host.pin.floorCol) <= 1 && Math.abs(playerRow - host.pin.floorRow) <= 1;
      return vis || onPaint;
    }
    if (this.liveMotion) {
      const px = playerCol * TILE + TILE / 2;
      const py = playerRow * TILE + TILE / 2;
      return vis || pointInRect({ x: px, y: py }, host.live);
    }
    const inside =
      playerCol >= host.box.minCol &&
      playerCol <= host.box.maxCol &&
      playerRow >= host.box.minRow &&
      playerRow <= host.box.maxRow;
    return vis || inside;
  }

  update(dt: number, playerPos: Readonly<Vector2>): void {
    const combat = this.combat;
    const dtMs = dt;
    this.volumeSight = 1;
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
      if (combat && swung && !this.swingHit) {
        if (this.liveMotion && host.kind === 'bing' && host.nuclei.length > 0) {
          const hit = host.nuclei.find((n) => n.alive && this.coreInSwing(playerPos, combat.getLockedAttackAngle(), n.core));
          if (hit) {
            this.hitCore(host, hit);
            this.swingHit = true;
          }
        } else if (this.coreInSwing(playerPos, combat.getLockedAttackAngle(), host.core)) {
          this.hitCore(host);
          this.swingHit = true;
        }
      }
      if (host.kind === 'yi') this.tickYi(host, col, row, dtMs);
      else if (host.kind === 'bing') this.tickBing(host, col, row, dtMs);
      else this.tickDing(host, col, row, playerPos, dtMs);
    }
    this.lastPlayerTile = { col, row };
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
      hp: C.CORE_MAX_HEALTH,
      alive: true,
      gfx,
      core,
      tile: { col: tile.col, row: tile.row },
      strikeFloors,
      windupMs: -1,
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
    pin: ClusterCorePin | undefined,
    slot = 0,
  ): void {
    if (!pin) {
      console.warn('[contamination-hosts] bing skipped: no cluster core');
      return;
    }
    if (resolveStopLoss(form) === 'illegal') {
      console.warn('[contamination-hosts] bing skipped: illegal stop-loss');
      return;
    }
    const gfx = scene.add.graphics().setDepth(0.2);
    const ox = (slot % 3) * TILE;
    const oy = Math.floor(slot / 3) * TILE;
    const core = { x: pin.cx + ox, y: pin.cy + oy };
    if (!this.liveMotion) this.paintCore(gfx, core, 0x2ae6c8, 3);
    const nuclei = this.liveMotion ? this.spawnBingNuclei(form, pin, ox, oy) : [];
    const marks = this.liveMotion ? scene.add.graphics().setDepth(0.35) : null;
    this.hosts.push({
      kind: 'bing',
      id: `ENM_BING_${String(slot + 1).padStart(2, '0')}`,
      form,
      hp: C.CORE_MAX_HEALTH,
      alive: true,
      gfx,
      core: nuclei[0]?.core ?? core,
      pin: {
        ...pin,
        cx: core.x,
        cy: core.y,
        floorCol: pin.floorCol + (slot % 3),
        floorRow: pin.floorRow + Math.floor(slot / 3),
      },
      phase: 0,
      nuclei,
      marks,
    });
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
      id: `ENM_DING_${String(slot + 1).padStart(2, '0')}`,
      form,
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
    const stop = resolveStopLoss(host.form);
    if (stop === 'illegal') return;
    const walk = host.walk;
    if (walk) {
      const stepped = stepYiWalk(walk, host.form.lexemes.motion, dtMs, TILE, host.floorUniverse);
      walk.along = stepped.along;
      walk.dir = stepped.dir;
      walk.turnAccumMs = stepped.turnAccumMs;
      host.tile = { col: stepped.tile.col, row: stepped.tile.row };
      host.core = stepped.core;
      host.strikeFloors = stepped.strikeFloors.map((f) => ({ col: f.col, row: f.row }));
      host.moving = stepped.moving;
    }
    const channel = resolveContactChannel(host.form.portfolio, host.form.lexemes.contact);
    const canStrike = channel === 'adjacent_hp';
    const onStrike = canStrike && host.strikeFloors.some((f) => f.col === col && f.row === row);
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
    this.paintMarks(host);
  }

  private tickBing(host: BingHost, col: number, row: number, dtMs: number): void {
    if (this.liveMotion) this.tickBingLive(host, col, row, dtMs);
    else this.tickBingSortie(host, col, row, dtMs);
  }

  /** Pre-R2-C2 body. Always step-chaos. Does not read lexemes.contact. */
  private tickBingSortie(host: BingHost, col: number, row: number, dtMs: number): void {
    host.phase += dtMs * 0.002;
    const inflated = Math.sin(host.phase) > 0.35;
    const onPaint = Math.abs(col - host.pin.floorCol) <= 1 && Math.abs(row - host.pin.floorRow) <= 1;
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
    host.phase += dtMs * 0.002;
    const inflated = Math.sin(host.phase) > 0.35;
    const stepped = col !== this.lastPlayerTile.col || row !== this.lastPlayerTile.row;
    const channel = resolveContactChannel(host.form.portfolio, host.form.lexemes.contact);
    if (channel === 'step_chaos' && stepped) {
      const onPaint =
        host.nuclei.length > 0
          ? host.nuclei.some(
              (n) => n.alive && chebyshevTiles({ col, row }, { col: n.floorCol, row: n.floorRow }) <= 1,
            )
          : Math.abs(col - host.pin.floorCol) <= 1 && Math.abs(row - host.pin.floorRow) <= 1;
      if (onPaint) {
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

  private tickDing(
    host: DingHost,
    col: number,
    row: number,
    playerPos: Readonly<Vector2>,
    dtMs: number,
  ): void {
    if (this.liveMotion) this.tickDingLive(host, playerPos, dtMs);
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
    host.elapsedMs += dtMs;
    host.live = dingLiveRect(host.box, host.form.lexemes.motion, host.elapsedMs, TILE);
    host.core = rectCenter(host.live);
    host.moving =
      Math.abs(host.live.x - prev.x) > 0.05 ||
      Math.abs(host.live.y - prev.y) > 0.05 ||
      Math.abs(host.live.w - prev.w) > 0.05 ||
      Math.abs(host.live.h - prev.h) > 0.05;
    const vis = this.getVisibility?.(host.core) ?? 0;
    host.awake = vis > 0;
    const channel = resolveContactChannel(host.form.portfolio, host.form.lexemes.contact);
    const inside = pointInRect(playerPos, host.live);
    if (channel === 'volume_chaos_sight' && inside) {
      this.volumeSight = C.VOLUME_SIGHT_MULT;
      this.chaos?.addChaos('volume_field', C.VOLUME_CHAOS_PER_SEC * (dtMs / 1000));
    }
    this.paintDing(host.gfx, host.box, host.core, host.awake, host.live);
    this.paintMarks(host);
  }

  private spawnBingNuclei(
    form: ContaminationForm,
    pin: ClusterCorePin,
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
    if (this.skipPaint) {
      gfx.setVisible(false);
      return;
    }
    const stop = resolveStopLoss(host.form);
    if (stop === 'illegal' || !stop.hittable) {
      gfx.setVisible(false);
      return;
    }
    gfx.setVisible(true);
    const standard = host.kind === 'ding' ? 2 : 3;
    const size = coreMarkPx(stop.corePolicy, standard);
    if (size <= 0) {
      gfx.setVisible(false);
      return;
    }
    if (host.kind === 'bing' && host.nuclei.length > 0) {
      for (const nucleus of host.nuclei) {
        if (!nucleus.alive) continue;
        const flash = nucleus.flashMs > 0;
        this.paintCore(gfx, nucleus.core, flash ? 0x3cffd4 : 0x2ae6c8, size, true, true);
      }
      return;
    }
    this.paintCore(gfx, host.core, 0x2ae6c8, size, true, true);
  }

  private coreInSwing(origin: Readonly<Vector2>, angle: number, core: Vector2): boolean {
    const combat = GAME_CONSTANTS.COMBAT;
    const dx = core.x - origin.x;
    const dy = core.y - origin.y;
    const dist = Math.hypot(dx, dy);
    if (dist > combat.ATTACK_RANGE) return false;
    if (dist < combat.ATTACK_MIN_ANGLE_BYPASS) return true;
    const bearing = Math.atan2(dy, dx);
    return Math.abs(shortestArc(bearing - angle)) <= degToRad(combat.ATTACK_HALF_ANGLE);
  }

  private hitCore(host: Host, nucleus?: BingNucleus): void {
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
      if (host.marks) {
        host.marks.clear();
        host.marks.setVisible(false);
      }
      if (host.kind === 'yi') {
        host.telegraph.clear();
        host.telegraph.setVisible(false);
      }
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
        const inflated = Math.sin(host.phase) > 0.35;
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
