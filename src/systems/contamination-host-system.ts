/**
 * Non-human contamination hosts: 乙缝核 / 丙簇核 / 丁体积 (DEC-076).
 * Not a second FSM. No corridor collision. Depth stays below the vision mask.
 */

import Phaser from 'phaser';
import { GAME_CONSTANTS } from '@/config/constants';
import { eventBus } from '@/core/event-bus';
import { drawSortie, type ContaminationForm, type SortieDraw } from '@/generation/contamination-draw';
import { mix32 } from '@/generation/seed-fork';
import type { ClusterCorePin, ContaminationPins, CorridorAabb, GeneratedRiftLayout, WallEdgePolyline } from '@/generation/types';
import type { CombatSystem } from '@/systems/combat-system';
import type { ChaosSystem } from '@/systems/chaos-system';
import { GameEvent } from '@/types/events';
import type { Vector2 } from '@/types/game-types';
import { SeededRandom } from '@/utils/random';
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
}

interface YiHost extends HostBase {
  kind: 'yi';
  strikeFloors: readonly { col: number; row: number }[];
  windupMs: number;
  telegraph: Phaser.GameObjects.Graphics;
}

interface BingHost extends HostBase {
  kind: 'bing';
  pin: ClusterCorePin;
  phase: number;
}

interface DingHost extends HostBase {
  kind: 'ding';
  box: CorridorAabb;
  awake: boolean;
}

type Host = YiHost | BingHost | DingHost;

/** Gym candidate visuals. Structurally matches FormAttachContext.pin; no gym import. */
export interface HostVisualPin {
  readonly kind: 'wall' | 'cluster' | 'volume';
  readonly x: number;
  readonly y: number;
  readonly width?: number;
  readonly height?: number;
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

  /**
   * Materialize 乙/丙/丁 from the same `drawSortie` as a sortie.
   * `combat` / `chaos` may be null: paint and tick visuals only (no swing hits / chaos).
   */
  create(
    scene: Phaser.Scene,
    layout: GeneratedRiftLayout,
    combat: CombatSystem | null,
    chaos: ChaosSystem | null,
    getVisibilityAt: (p: Readonly<Vector2>) => number,
  ): void {
    this.destroy();
    this.hosts = [];
    this.combat = combat;
    this.chaos = chaos;
    this.getVisibility = getVisibilityAt;

    const pins = layout.contaminationPins;
    const rng = new SeededRandom(mix32(layout.seed, 'lexicon-hosts'));
    const drawn = drawSortie(rng, {
      fragmentTypeId: layout.fragmentTypeId,
      hasClusters: pins.clusterCores.length > 0,
      hasWallEdges: pins.wallEdges.length > 0,
      hasCorridors: pins.corridorAabbs.length > 0,
      hearingAxisTaken: true,
    });
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
  ): void {
    this.clearHosts();
    this.scene = scene;
    this.pins = pins;
    this.combat = combat;
    this.chaos = chaos;
    this.getVisibility = getVisibilityAt;
    this.spawnSeq = 0;
  }

  clearHosts(): void {
    for (const host of this.hosts) {
      host.gfx.destroy();
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
    if (host.kind === 'yi') return { kind: 'wall', x: host.core.x, y: host.core.y };
    if (host.kind === 'bing') return { kind: 'cluster', x: host.core.x, y: host.core.y };
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

  isIdentifiable(hostId: string, playerCol: number, playerRow: number): boolean {
    const host = this.hosts.find((h) => h.id === hostId && h.alive);
    if (!host) return false;
    const vis = (this.getVisibility?.(host.core) ?? 0) > 0;
    if (host.kind === 'yi') return vis;
    if (host.kind === 'bing') {
      const onPaint =
        Math.abs(playerCol - host.pin.floorCol) <= 1 && Math.abs(playerRow - host.pin.floorRow) <= 1;
      return vis || onPaint;
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
        if (host.kind === 'yi') host.telegraph.setVisible(false);
        continue;
      }
      if (combat && swung && !this.swingHit) {
        if (this.coreInSwing(playerPos, combat.getLockedAttackAngle(), host.core)) {
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
    const tile = edge.tiles[Math.min(slot, edge.tiles.length - 1)]!;
    const core = { x: tile.col * TILE + TILE / 2, y: tile.row * TILE + TILE / 2 };
    const gfx = scene.add.graphics().setDepth(20);
    const telegraph = scene.add.graphics().setDepth(21);
    this.paintYi(gfx, core, false);
    this.hosts.push({
      kind: 'yi',
      id: `ENM_YI_${String(slot + 1).padStart(2, '0')}`,
      form,
      hp: C.CORE_MAX_HEALTH,
      alive: true,
      gfx,
      core,
      strikeFloors: edge.strikeFloors,
      windupMs: -1,
      telegraph,
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
    const gfx = scene.add.graphics().setDepth(0.2);
    const ox = (slot % 3) * TILE;
    const oy = Math.floor(slot / 3) * TILE;
    const core = { x: pin.cx + ox, y: pin.cy + oy };
    this.paintCore(gfx, core, 0x2ae6c8, 3);
    this.hosts.push({
      kind: 'bing',
      id: `ENM_BING_${String(slot + 1).padStart(2, '0')}`,
      form,
      hp: C.CORE_MAX_HEALTH,
      alive: true,
      gfx,
      core,
      pin: {
        ...pin,
        cx: core.x,
        cy: core.y,
        floorCol: pin.floorCol + (slot % 3),
        floorRow: pin.floorRow + Math.floor(slot / 3),
      },
      phase: 0,
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
    const gfx = scene.add.graphics().setDepth(C.VOLUME_DEPTH);
    const core = {
      x: box.coreCol * TILE + TILE / 2 + (slot % 2) * TILE,
      y: box.coreRow * TILE + TILE / 2,
    };
    this.paintDing(gfx, box, core, false);
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
    });
  }

  private tickYi(host: YiHost, col: number, row: number, dtMs: number): void {
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

  private tickBing(host: BingHost, col: number, row: number, dtMs: number): void {
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

  private tickDing(
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

  private hitCore(host: Host): void {
    const amount = GAME_CONSTANTS.COMBAT.PLAYER_DAMAGE;
    host.hp -= amount;
    eventBus.emit(GameEvent.ENEMY_DAMAGED, { enemyId: host.id, amount, source: 'player' });
    if (host.hp > 0) return;
    host.alive = false;
    host.gfx.clear();
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
    gfx.fillStyle(hot ? 0x3cffd4 : 0x2ae6c8, 1);
    gfx.fillRect(Math.round(core.x) - 1, Math.round(core.y) - 1, 3, 3);
  }

  private paintCore(gfx: Phaser.GameObjects.Graphics, core: Vector2, color: number, size: number): void {
    if (this.skipPaint) {
      gfx.clear();
      gfx.setVisible(false);
      return;
    }
    gfx.setVisible(true);
    gfx.clear();
    gfx.fillStyle(color, 1);
    const half = (size / 2) | 0;
    gfx.fillRect(Math.round(core.x) - half, Math.round(core.y) - half, size, size);
  }

  private paintDing(gfx: Phaser.GameObjects.Graphics, box: CorridorAabb, core: Vector2, awake: boolean): void {
    if (this.skipPaint) {
      gfx.clear();
      gfx.setVisible(false);
      return;
    }
    gfx.setVisible(true);
    gfx.clear();
    gfx.fillStyle(0x0e4a3f, awake ? 0.55 : 0.32);
    gfx.fillRect(
      box.minCol * TILE,
      box.minRow * TILE,
      (box.maxCol - box.minCol + 1) * TILE,
      (box.maxRow - box.minRow + 1) * TILE,
    );
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
    }
  }

  private refreshDefaultPaint(): void {
    for (const host of this.hosts) {
      if (!host.alive) {
        host.gfx.setVisible(false);
        if (host.kind === 'yi') host.telegraph.setVisible(false);
        continue;
      }
      if (host.kind === 'yi') {
        host.telegraph.setVisible(true);
        this.paintYi(host.gfx, host.core, host.windupMs >= 0);
      } else if (host.kind === 'bing') {
        const inflated = Math.sin(host.phase) > 0.35;
        this.paintCore(host.gfx, host.core, inflated ? 0x3cffd4 : 0x2ae6c8, inflated ? 4 : 3);
      } else {
        this.paintDing(host.gfx, host.box, host.core, host.awake);
      }
    }
  }
}
