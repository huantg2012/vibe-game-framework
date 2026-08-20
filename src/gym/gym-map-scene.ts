/**
 * Map-generation gym. Same generateRiftLayout + RiftSurfacePainter as a sortie.
 * No VisibilitySystem. Contract: docs/dev/gym.md.
 */

import Phaser from 'phaser';
import { GAME_CONSTANTS } from '@/config/constants';
import { RIFT_FRAGMENT_DATA } from '@/generated/rift-fragment-data';
import { isContaminationAge, isRuinSeverity } from '@/generation/fragment-roll';
import {
  isContaminationDrawStyle,
  type ContaminationDrawStyle,
} from '@/generation/preview-paint';
import { PREVIEW_RECIPES } from '@/generation/recipes';
import {
  generateRiftLayout,
  type RiftLayoutOptions,
} from '@/generation/rift-layout';
import type { GeneratedRiftLayout } from '@/generation/types';
import { TileType } from '@/types/game-types';
import { RiftSurfacePainter } from '@/systems/procedural-surface';
import { TileGrid } from '@/systems/tile-grid';
import { TilemapRenderer } from '@/systems/tilemap-renderer';

const SURFACE_KEY = 'gym-map-surface';
const MARKER_DEPTH = 20;
const ZOOM_MIN = 0.12;
const ZOOM_MAX = 3;
const MARKER = 12;

const AGE_LABEL: Record<string, string> = {
  new: '新',
  standard: '常',
  ancient: '古',
};

const RUIN_LABEL: Record<string, string> = {
  intact: '完整',
  broken: '残破',
  eaten: '啃蚀',
};

const DRAW_LABEL: Record<ContaminationDrawStyle, string> = {
  blocks: '对照平涂',
  cluster: '方案一 崩坏簇',
  crystal: '方案二 接缝晶结',
  dissolve: '方案三 坏格溶蚀',
};

export class GymMapScene extends Phaser.Scene {
  private readonly tiles = new TilemapRenderer();
  private readonly riftSurface = new RiftSurfacePainter();
  private markers: Phaser.GameObjects.Graphics | null = null;
  private dragging = false;
  private generating = false;
  private formBound = false;
  private lastLayout: GeneratedRiftLayout | null = null;

  constructor() {
    super({ key: 'GymMapScene' });
  }

  create(): void {
    const camera = this.cameras.main;
    camera.setBackgroundColor(GAME_CONSTANTS.VISIBILITY.VOID_COLOR);
    this.input.mouse?.disableContextMenu();

    this.bindForm();
    this.bindCamera();
    this.queueRebuild(false);

    this.events.once(Phaser.Scenes.Events.SHUTDOWN, this.onShutdown, this);
    this.events.once(Phaser.Scenes.Events.DESTROY, this.onShutdown, this);
  }

  update(_time: number, delta: number): void {
    this.riftSurface.update(delta);
  }

  private bindForm(): void {
    const recipe = document.getElementById('gym-recipe');
    const generate = document.getElementById('gym-map-generate');
    const random = document.getElementById('gym-map-random');
    const seed = document.getElementById('gym-seed');
    if (!(recipe instanceof HTMLSelectElement)) return;
    if (!(generate instanceof HTMLButtonElement)) return;
    if (!(random instanceof HTMLButtonElement)) return;
    if (!(seed instanceof HTMLInputElement)) return;

    if (!this.formBound) {
      fillRecipeSelect(recipe);
      if (!seed.value) seed.value = String(Date.now() >>> 0);
      generate.addEventListener('click', this.onGenerateClick);
      random.addEventListener('click', this.onRandomClick);
      const draw = document.getElementById('gym-contam-draw');
      if (draw instanceof HTMLSelectElement) {
        draw.addEventListener('change', this.onDrawChange);
      }
      this.formBound = true;
    }

    const title = document.getElementById('gym-title');
    if (title) title.textContent = '练习场 · 地图生成';
    const status = document.getElementById('gym-status');
    if (status) status.textContent = '拖动画布平移，滚轮缩放。无视野迷雾。崩坏簇：内核烤死，支撑区/外围区在胀缩。出击这层先关掉。改污染画法会重烤同一张图。';
  }

  private readonly onGenerateClick = (): void => {
    this.queueRebuild(false);
  };

  private readonly onRandomClick = (): void => {
    this.queueRebuild(true);
  };

  private readonly onDrawChange = (): void => {
    if (!this.lastLayout) {
      this.queueRebuild(false);
      return;
    }
    this.mountLayout(this.lastLayout, false);
  };

  private queueRebuild(randomSeed: boolean): void {
    if (this.generating) return;
    if (randomSeed) {
      const seed = document.getElementById('gym-seed');
      if (seed instanceof HTMLInputElement) seed.value = String(Date.now() >>> 0);
    }
    const status = document.getElementById('gym-status');
    if (status) status.textContent = '生成中…';
    this.setButtonsDisabled(true);
    requestAnimationFrame(() => {
      requestAnimationFrame(() => this.rebuildFromForm());
    });
  }

  private rebuildFromForm(): void {
    this.generating = true;
    const request = readMapRequest();
    try {
      const layout = request.options
        ? generateRiftLayout(request.seed, request.options)
        : generateRiftLayout(request.seed);
      this.lastLayout = layout;
      this.mountLayout(layout, true);
      const status = document.getElementById('gym-status');
      if (status) {
        status.textContent = '拖动画布平移，滚轮缩放。无视野迷雾。崩坏簇：内核烤死，支撑区/外围区在胀缩。出击这层先关掉。改污染画法会重烤同一张图。';
      }
    } catch (err) {
      const message = err instanceof Error ? err.message : String(err);
      const status = document.getElementById('gym-status');
      if (status) status.textContent = `生成失败：${message}`;
      const roster = document.getElementById('gym-roster');
      if (roster) roster.textContent = message;
    } finally {
      this.generating = false;
      this.setButtonsDisabled(false);
    }
  }

  private mountLayout(layout: GeneratedRiftLayout, resetView: boolean): void {
    const draw = readDrawStyle();
    if (resetView) {
      this.markers?.destroy();
      this.markers = null;
      this.tiles.destroy();

      const tileMap = layout.tileMap;
      const grid = new TileGrid(tileMap);
      const layer = this.tiles.create(this, tileMap, {
        tilesetKey: 'placeholder-rift-tileset',
        collidingIndices: [TileType.WALL, TileType.VOID],
        depth: 0,
      });
      layer.setVisible(false);

      this.physics.world.setBounds(0, 0, grid.widthPx, grid.heightPx);
      fitCamera(this.cameras.main, grid.widthPx, grid.heightPx);
      this.paintMarkers(layout, tileMap.tileSize);
    }

    this.riftSurface.mount(this, layout.ruins, SURFACE_KEY, 0, {
      contaminationDraw: draw,
      liveClusterBreath: draw === 'cluster',
    });
    fillMapRoster(layout, draw);
  }

  private paintMarkers(layout: GeneratedRiftLayout, tileSize: number): void {
    const g = this.add.graphics();
    g.setDepth(MARKER_DEPTH);
    this.markers = g;

    for (const node of layout.kindlingNodes) {
      stamp(g, node.position.x, node.position.y, 0xc4873a);
    }
    for (const node of layout.contaminantNodes) {
      stamp(g, node.position.x, node.position.y, 0x7fffee);
    }
    for (const mark of layout.landmarks) {
      stamp(
        g,
        mark.col * tileSize + tileSize / 2,
        mark.row * tileSize + tileSize / 2,
        0x5a4030,
      );
    }
    for (const spawn of layout.enemySpawns) {
      const color = spawn.type === 'rewriter' ? 0xb0fff5 : 0x8a8f96;
      stamp(
        g,
        spawn.spawn.col * tileSize + tileSize / 2,
        spawn.spawn.row * tileSize + tileSize / 2,
        color,
      );
      g.fillStyle(0x1a6b5c, 0.45);
      for (const tile of spawn.patrol.waypoints) {
        g.fillRect(
          tile.col * tileSize + (tileSize - 8) / 2,
          tile.row * tileSize + (tileSize - 8) / 2,
          8,
          8,
        );
      }
    }
    stamp(g, layout.spawnPoint.x, layout.spawnPoint.y, 0x1aad96);
    stamp(
      g,
      layout.extractionPoint.position.x,
      layout.extractionPoint.position.y,
      0xe0a848,
    );
  }

  private bindCamera(): void {
    this.input.on('pointerdown', this.onPointerDown, this);
    this.input.on('pointerup', this.onPointerUp, this);
    this.input.on('pointerupoutside', this.onPointerUp, this);
    this.input.on('pointermove', this.onPointerMove, this);
    this.input.on('wheel', this.onWheel, this);
  }

  private onPointerDown(): void {
    this.dragging = true;
  }

  private onPointerUp(): void {
    this.dragging = false;
  }

  private onPointerMove(pointer: Phaser.Input.Pointer): void {
    if (!this.dragging || !pointer.isDown) return;
    const camera = this.cameras.main;
    camera.scrollX -= (pointer.x - pointer.prevPosition.x) / camera.zoom;
    camera.scrollY -= (pointer.y - pointer.prevPosition.y) / camera.zoom;
  }

  private onWheel(
    pointer: Phaser.Input.Pointer,
    _currentlyOver: Phaser.GameObjects.GameObject[],
    _dx: number,
    dy: number,
    _dz: number,
    event: WheelEvent,
  ): void {
    event.preventDefault();
    const camera = this.cameras.main;
    const before = camera.getWorldPoint(pointer.x, pointer.y);
    const next = Phaser.Math.Clamp(
      camera.zoom * (dy > 0 ? 0.9 : 1.1),
      ZOOM_MIN,
      ZOOM_MAX,
    );
    camera.setZoom(next);
    const after = camera.getWorldPoint(pointer.x, pointer.y);
    camera.scrollX += before.x - after.x;
    camera.scrollY += before.y - after.y;
  }

  private setButtonsDisabled(disabled: boolean): void {
    for (const id of ['gym-map-generate', 'gym-map-random']) {
      const el = document.getElementById(id);
      if (el instanceof HTMLButtonElement) el.disabled = disabled;
    }
  }

  private onShutdown(): void {
    this.input.off('pointerdown', this.onPointerDown, this);
    this.input.off('pointerup', this.onPointerUp, this);
    this.input.off('pointerupoutside', this.onPointerUp, this);
    this.input.off('pointermove', this.onPointerMove, this);
    this.input.off('wheel', this.onWheel, this);
    const generate = document.getElementById('gym-map-generate');
    const random = document.getElementById('gym-map-random');
    const draw = document.getElementById('gym-contam-draw');
    generate?.removeEventListener('click', this.onGenerateClick);
    random?.removeEventListener('click', this.onRandomClick);
    draw?.removeEventListener('change', this.onDrawChange);
    this.formBound = false;
    this.lastLayout = null;
    this.markers?.destroy();
    this.markers = null;
    this.tiles.destroy();
    this.riftSurface.destroy();
  }
}

function stamp(
  graphics: Phaser.GameObjects.Graphics,
  x: number,
  y: number,
  color: number,
): void {
  graphics.fillStyle(color, 0.95);
  graphics.fillRect(x - MARKER / 2, y - MARKER / 2, MARKER, MARKER);
  graphics.lineStyle(1, 0x080a0c, 0.9);
  graphics.strokeRect(x - MARKER / 2, y - MARKER / 2, MARKER, MARKER);
}

function fitCamera(
  camera: Phaser.Cameras.Scene2D.Camera,
  worldW: number,
  worldH: number,
): void {
  camera.setBounds(0, 0, worldW, worldH);
  const zoom = Math.min(camera.width / worldW, camera.height / worldH) * 0.92;
  camera.setZoom(Phaser.Math.Clamp(zoom, ZOOM_MIN, ZOOM_MAX));
  camera.centerOn(worldW / 2, worldH / 2);
}

function fillRecipeSelect(select: HTMLSelectElement): void {
  select.replaceChildren();
  select.add(new Option('按种子抽锚（与出击相同）', ''));
  for (const recipe of PREVIEW_RECIPES) {
    const frag = RIFT_FRAGMENT_DATA[recipe.fragmentTypeId];
    const live = frag?.enabled === true;
    const name = frag?.displayName ?? recipe.fragmentTypeId;
    const locked = live ? '' : '，出击未抽';
    select.add(new Option(`${recipe.label} · ${name}（${recipe.id}${locked}）`, recipe.id));
  }
}

function readMapRequest(): { seed: number; options?: RiftLayoutOptions } {
  const seedEl = document.getElementById('gym-seed');
  const recipeEl = document.getElementById('gym-recipe');
  const jitterEl = document.getElementById('gym-jitter');
  const ageEl = document.getElementById('gym-age');
  const ruinEl = document.getElementById('gym-ruin');

  const parsed = seedEl instanceof HTMLInputElement ? Number(seedEl.value) : NaN;
  const seed = Number.isFinite(parsed) ? parsed >>> 0 : Date.now() >>> 0;
  if (seedEl instanceof HTMLInputElement) seedEl.value = String(seed);

  const recipeId =
    recipeEl instanceof HTMLSelectElement && recipeEl.value ? recipeEl.value : undefined;
  const jitter = jitterEl instanceof HTMLInputElement ? jitterEl.checked : true;
  const age = ageEl instanceof HTMLSelectElement ? ageEl.value : '';
  const ruin = ruinEl instanceof HTMLSelectElement ? ruinEl.value : '';

  const options: RiftLayoutOptions = {
    ...(recipeId ? { recipeId } : {}),
    ...(jitter ? {} : { jitter: false }),
    ...(isContaminationAge(age) ? { contaminationAge: age } : {}),
    ...(isRuinSeverity(ruin) ? { ruinSeverity: ruin } : {}),
  };
  const locked = Object.keys(options).length > 0;
  return { seed, options: locked ? options : undefined };
}

function readDrawStyle(): ContaminationDrawStyle {
  const el = document.getElementById('gym-contam-draw');
  const value = el instanceof HTMLSelectElement ? el.value : '';
  return isContaminationDrawStyle(value) ? value : 'cluster';
}

function fillMapRoster(layout: GeneratedRiftLayout, draw: ContaminationDrawStyle): void {
  const roster = document.getElementById('gym-roster');
  if (!roster) return;
  const frag = RIFT_FRAGMENT_DATA[layout.fragmentTypeId];
  const recipe = PREVIEW_RECIPES.find((row) => row.id === layout.recipeId);
  const rewriter = layout.enemySpawns.filter((e) => e.type === 'rewriter').length;
  roster.textContent = [
    `种子 ${layout.seed}`,
    `风格锚 ${recipe?.label ?? layout.recipeId}（${layout.recipeId}）`,
    `碎片 ${frag?.displayName ?? layout.fragmentTypeId}`,
    `污染年龄 ${AGE_LABEL[layout.contaminationAge] ?? layout.contaminationAge} · 残破度 ${RUIN_LABEL[layout.ruinSeverity] ?? layout.ruinSeverity}`,
    `污染画法 ${DRAW_LABEL[draw]}`,
    `出生 / 撤离 / 薪柴 ${layout.kindlingNodes.length} / 污染物 ${layout.contaminantNodes.length}`,
    `巡逻 ${layout.enemySpawns.length}（改写体 ${rewriter}）`,
  ].join('\n');
}
