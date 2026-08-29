/**
 * Vision-lab gym: live comparison of smooth-mask candidates on a real rift layout.
 * Same generateRiftLayout + RiftSurfacePainter + Player + VisibilitySystem as a
 * sortie - only the mask render style switches (keys 1-5), plus a teal-edge demo
 * (T). Contract: docs/dev/gym.md.
 */

import Phaser from 'phaser';
import { GAME_CONSTANTS } from '@/config/constants';
import { Player } from '@/entities/player';
import { generateRiftLayout } from '@/generation/rift-layout';
import {
  createRiftVisionConfig,
  VisibilitySystem,
  type CorruptionEdgeStyle,
  type VisionMaskStyle,
} from '@/systems/visibility-system';
import { RiftSurfacePainter } from '@/systems/procedural-surface';
import { TileGrid } from '@/systems/tile-grid';
import { TilemapRenderer } from '@/systems/tilemap-renderer';
import { TileType } from '@/types/game-types';

const SURFACE_KEY = 'gym-vision-surface';

const DEPTH = {
  surface: 0,
  player: 30,
  visionMask: 50,
} as const;

/** Fixed demo level so hard vs soft compare at the same strength (chaos 50+ look). */
const CORRUPTION_DEMO_LEVEL = 0.6;

type CorruptionDemo = 'off' | 'hard' | 'soft';

const MASK_STYLES: readonly VisionMaskStyle[] = ['bands', 'subdiv', 'field', 'bayer', 'field-dim'];

const MODE_LABEL: Record<VisionMaskStyle, string> = {
  bands: '现状 · 三档阶梯 + 2px 棋盘',
  subdiv: '细分带 · 8 层插值（形状不变，径向变平滑）',
  field: '光场 v3 · 弱灯×强手电（360° 墙截模板，远处黑边已修）',
  bayer: '抖动坡 v2 · 时序颗粒（站着不动边界也活）',
  'field-dim': '光场 v3 · 灯再弱一档（强度抽卡对照）',
};

const CORRUPTION_LABEL: Record<CorruptionDemo, string> = {
  off: '关',
  hard: '开 · 硬内缘（现状）',
  soft: '开 · 软内缘 v5（光场联动：强光顶住、弱光渗入；尾巴不过墙；非光场模式仍 v3 几何环）',
};

export class GymVisionLabScene extends Phaser.Scene {
  private readonly tiles = new TilemapRenderer();
  private readonly riftSurface = new RiftSurfacePainter();
  private readonly player = new Player();
  private readonly visibility = new VisibilitySystem();
  private maskStyle: VisionMaskStyle = 'bands';
  private corruptionDemo: CorruptionDemo = 'off';

  constructor() {
    super({ key: 'GymVisionLabScene' });
  }

  create(): void {
    // Deep-link support: ?lesson=vision-lab&mode=field&teal=soft
    const params = new URLSearchParams(window.location.search);
    const mode = params.get('mode');
    if (
      mode === 'bands' ||
      mode === 'subdiv' ||
      mode === 'field' ||
      mode === 'field-dim' ||
      mode === 'bayer'
    ) {
      this.maskStyle = mode;
    }
    const teal = params.get('teal');
    if (teal === 'hard' || teal === 'soft') this.corruptionDemo = teal;

    const seed = readSeed();
    const layout = generateRiftLayout(seed);
    const tileMap = layout.tileMap;
    const grid = new TileGrid(tileMap);

    // Same split as the sortie: tilemap layer is collision-only, the visible
    // ground is the procedural surface (DEC-018).
    const layer = this.tiles.create(this, tileMap, {
      tilesetKey: 'placeholder-rift-tileset',
      collidingIndices: [TileType.WALL, TileType.VOID],
      depth: DEPTH.surface,
    });
    layer.setVisible(false);
    this.riftSurface.mount(this, layout.ruins, SURFACE_KEY, DEPTH.surface);

    this.physics.world.setBounds(0, 0, grid.widthPx, grid.heightPx);
    // Zoom before visibility create: the mask sizes itself to the camera view.
    const camera = this.cameras.main;
    camera.setBounds(0, 0, grid.widthPx, grid.heightPx);
    camera.setZoom(GAME_CONSTANTS.CAMERA.ZOOM);
    camera.setBackgroundColor(GAME_CONSTANTS.VISIBILITY.VOID_COLOR);

    this.player.create(this, { spawn: layout.spawnPoint, depth: DEPTH.player, facing: 'right' });
    this.physics.add.collider(this.player.getSprite(), layer);
    camera.startFollow(this.player.getSprite(), true);

    this.visibility.create(this, createRiftVisionConfig(DEPTH.visionMask), grid);
    this.visibility.clipLightsToIsland(tileMap);
    this.visibility.setExtractionPosition(layout.extractionPoint.position);
    this.visibility.registerGlowSource(
      layout.extractionPoint.id,
      layout.extractionPoint.position,
      GAME_CONSTANTS.VISIBILITY.GLOW_LEAK_RADIUS
    );
    this.visibility.setMaskStyle(this.maskStyle);
    this.applyCorruptionDemo();

    window.addEventListener('keydown', this.onKeyDown);
    const generate = document.getElementById('gym-vision-generate');
    generate?.addEventListener('click', this.onGenerateClick);

    this.events.on(Phaser.Scenes.Events.POST_UPDATE, this.onPostUpdate, this);
    this.events.once(Phaser.Scenes.Events.SHUTDOWN, this.onShutdown, this);
    this.events.once(Phaser.Scenes.Events.DESTROY, this.onShutdown, this);

    this.paintSidebar(seed);
  }

  update(_time: number, delta: number): void {
    this.player.update(delta);
  }

  private onPostUpdate(_time: number, delta: number): void {
    this.player.postUpdate();
    this.visibility.update(this.player.getPosition(), this.player.getFacingAngle(), delta);
  }

  private readonly onKeyDown = (event: KeyboardEvent): void => {
    const target = event.target;
    if (target instanceof HTMLInputElement || target instanceof HTMLSelectElement) return;
    if (event.code.startsWith('Digit')) {
      const index = Number(event.code.slice(5)) - 1;
      const style = MASK_STYLES[index];
      if (!style) return;
      this.maskStyle = style;
      this.visibility.setMaskStyle(style);
      this.paintCaption();
      return;
    }
    if (event.code === 'KeyT') {
      this.corruptionDemo =
        this.corruptionDemo === 'off' ? 'hard' : this.corruptionDemo === 'hard' ? 'soft' : 'off';
      this.applyCorruptionDemo();
      this.paintCaption();
      return;
    }
    if (event.code === 'KeyR') {
      writeSeed(Date.now() >>> 0);
      this.scene.restart();
    }
  };

  private readonly onGenerateClick = (): void => {
    this.scene.restart();
  };

  private applyCorruptionDemo(): void {
    const level = this.corruptionDemo === 'off' ? 0 : CORRUPTION_DEMO_LEVEL;
    const edge: CorruptionEdgeStyle = this.corruptionDemo === 'soft' ? 'soft' : 'hard';
    this.visibility.setEdgeCorruption(level);
    this.visibility.setCorruptionEdge(edge);
  }

  private paintSidebar(seed: number): void {
    const title = document.getElementById('gym-title');
    if (title) title.textContent = '练习场 · 视野渲染对比';
    const roster = document.getElementById('gym-roster');
    if (roster) {
      roster.textContent = [
        `种子 ${seed}`,
        '',
        '1 现状：三档阶梯 + 2px 棋盘',
        '2 细分带：8 层插值，形状不变，径向平滑',
        '3 光场 v3：弱灯 + 强手电（360° 墙截模板，远处黑边已修）',
        '4 抖动坡 v2：三档不动，8px 抖动坡 + 时序颗粒',
        '5 光场 v3′：灯再弱一档（强度抽卡对照）',
        '',
        'T teal 渗透：关 → 硬内缘 → 软内缘 v5（光场联动：前锋钉等亮度线，尾巴不过墙）',
        'R 换种子重生成（模式保持）',
      ].join('\n');
    }
    const status = document.getElementById('gym-status');
    if (status) {
      status.textContent =
        'WASD 移动，与出击同一套玩家 / 相机 / 视野。数字键切渲染模式，边走边对比肩膀与边界。';
    }
    this.paintCaption();
  }

  private paintCaption(): void {
    const caption = document.getElementById('gym-vision-caption');
    if (!caption) return;
    caption.textContent = `${MODE_LABEL[this.maskStyle]} ｜ teal ${CORRUPTION_LABEL[this.corruptionDemo]}`;
  }

  private onShutdown(): void {
    this.events.off(Phaser.Scenes.Events.POST_UPDATE, this.onPostUpdate, this);
    window.removeEventListener('keydown', this.onKeyDown);
    document.getElementById('gym-vision-generate')?.removeEventListener('click', this.onGenerateClick);
    this.visibility.destroy();
    this.player.destroy();
    this.riftSurface.destroy();
    this.tiles.destroy();
  }
}

function readSeed(): number {
  const el = document.getElementById('gym-vision-seed');
  if (el instanceof HTMLInputElement) {
    const parsed = Number(el.value);
    if (Number.isFinite(parsed) && el.value.trim() !== '') return parsed >>> 0;
  }
  const seed = Date.now() >>> 0;
  writeSeed(seed);
  return seed;
}

function writeSeed(seed: number): void {
  const el = document.getElementById('gym-vision-seed');
  if (el instanceof HTMLInputElement) el.value = String(seed);
}
