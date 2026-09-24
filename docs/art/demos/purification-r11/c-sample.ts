/// <reference types="vite/client" />

import Phaser from 'phaser';
import { gameConfigWithScenes } from '@/config/game-config';
import { Player } from '@/entities/player';
import { generateDensePlayerPlaceholders, DENSE_PLAYER_GROUND_OFFSET_Y } from '@/entities/player-sprite-dense';
import { generatePlayerLampAuraTextures } from '@/entities/player-lamp-aura';
import originalUrl from './c.png?url';

// An optional glob avoids requesting an absent file or sending a loader error to
// the console while the art asset is still being authored. Vite tracks additions.
const sampleFiles = import.meta.glob('./c-finish-sample.png', {
  eager: true,
  query: '?url',
  import: 'default',
}) as Record<string, string>;
const sampleUrl = sampleFiles['./c-finish-sample.png'];

const ART_WIDTH = 1536;
const ART_HEIGHT = 1024;
const ART_WORLD_RATIO = 2.4;
const WORLD_WIDTH = ART_WIDTH / ART_WORLD_RATIO;
const WORLD_HEIGHT = ART_HEIGHT / ART_WORLD_RATIO;
const WORLD_TOP = 200 - WORLD_HEIGHT / 2;
const SPAWN = {
  x: 496 / ART_WORLD_RATIO,
  y: 623 / ART_WORLD_RATIO + WORLD_TOP - DENSE_PLAYER_GROUND_OFFSET_Y,
};

function element<T extends HTMLElement>(id: string): T {
  const value = document.getElementById(id);
  if (!value) throw new Error(`C sample is missing #${id}`);
  return value as T;
}

const originalButton = element<HTMLButtonElement>('show-original');
const sampleButton = element<HTMLButtonElement>('show-sample');
const playerToggle = element<HTMLInputElement>('show-player');
const movementToggle = element<HTMLInputElement>('allow-movement');
const resetButton = element<HTMLButtonElement>('reset-player');
const status = element('asset-status');
const movementStatus = element('movement-status');

class SampleScene extends Phaser.Scene {
  private backdrop?: Phaser.GameObjects.Image;
  private player?: Player;
  private sampleReady = false;
  private sampleFailure = false;
  private sampleSelected = false;
  private controls = new AbortController();

  constructor() {
    super({ key: 'PurificationCFinishSample' });
  }

  preload(): void {
    this.load.image('c-original', originalUrl);
    if (sampleUrl) this.load.image('c-finish', sampleUrl);
    this.load.on(Phaser.Loader.Events.FILE_LOAD_ERROR, (file: Phaser.Loader.File) => {
      if (file.key === 'c-finish') this.sampleFailure = true;
    });
  }

  create(): void {
    this.cameras.main.setZoom(1.5).centerOn(320, 200).setRoundPixels(true);
    this.physics.world.setBounds(0, WORLD_TOP, WORLD_WIDTH, WORLD_HEIGHT);

    if (!this.textures.exists('c-original')) {
      status.textContent = 'C 原图载入失败，请检查 c.png 后刷新。';
      return;
    }

    this.sampleReady = this.textures.exists('c-finish') && !this.sampleFailure;
    if (this.sampleReady) {
      const image = this.textures.get('c-finish').getSourceImage();
      if (image.width !== ART_WIDTH || image.height !== ART_HEIGHT) {
        this.sampleReady = false;
        this.sampleFailure = true;
      }
    }
    this.backdrop = this.add.image(320, 200, 'c-original')
      .setDisplaySize(WORLD_WIDTH, WORLD_HEIGHT).setDepth(0);
    generateDensePlayerPlaceholders(this);
    generatePlayerLampAuraTextures(this);

    const canvas = this.game.canvas;
    canvas.tabIndex = 0;
    canvas.setAttribute('aria-label', 'C 成品样板，启用人物移动后可用 WASD 和方向键观察');
    const signal = this.controls.signal;
    canvas.addEventListener('pointerdown', () => canvas.focus(), { signal });
    canvas.addEventListener('blur', () => this.stopPlayer(), { signal });
    window.addEventListener('blur', () => this.stopPlayer(), { signal });
    document.addEventListener('visibilitychange', () => {
      if (document.hidden) this.stopPlayer();
    }, { signal });
    originalButton.addEventListener('click', () => this.selectArtwork(false), { signal });
    sampleButton.addEventListener('click', () => this.selectArtwork(true), { signal });
    playerToggle.addEventListener('change', () => this.setPlayerShown(), { signal });
    movementToggle.addEventListener('change', () => {
      this.stopPlayer();
      if (movementToggle.checked) canvas.focus();
    }, { signal });
    resetButton.addEventListener('click', () => {
      this.spawnPlayer();
      if (movementToggle.checked) canvas.focus();
    }, { signal });
    this.events.on(Phaser.Scenes.Events.POST_UPDATE, this.postUpdate, this);
    this.events.once(Phaser.Scenes.Events.SHUTDOWN, () => {
      this.controls.abort();
      this.events.off(Phaser.Scenes.Events.POST_UPDATE, this.postUpdate, this);
      this.player?.destroy();
      this.player = undefined;
    });
    sampleButton.disabled = !this.sampleReady;
    this.selectArtwork(this.sampleReady);
  }

  private selectArtwork(useSample: boolean): void {
    this.sampleSelected = useSample && this.sampleReady;
    this.backdrop?.setTexture(this.sampleSelected ? 'c-finish' : 'c-original')
      .setDisplaySize(WORLD_WIDTH, WORLD_HEIGHT);
    originalButton.setAttribute('aria-pressed', String(!this.sampleSelected));
    sampleButton.setAttribute('aria-pressed', String(this.sampleSelected));
    if (!this.sampleReady) {
      status.textContent = this.sampleFailure
        ? '成品样板无法载入或不是 1536 × 1024；当前显示原始 C，未替换构图。'
        : '成品样板尚未载入；当前显示原始 C。';
    } else {
      status.textContent = this.sampleSelected
        ? '当前：成品样板 · 原画 1536 × 1024 → 游戏画幅 960 × 640。'
        : '当前：原始 C 构图 · 原画 1536 × 1024 → 游戏画幅 960 × 640。';
    }
  }

  private setPlayerShown(): void {
    movementToggle.disabled = !playerToggle.checked;
    resetButton.disabled = !playerToggle.checked;
    if (playerToggle.checked) {
      this.spawnPlayer();
    } else {
      movementToggle.checked = false;
      this.stopPlayer();
      this.player?.destroy();
      this.player = undefined;
      movementStatus.textContent = '人物叠加已关闭。';
    }
  }

  private spawnPlayer(): void {
    this.stopPlayer();
    this.player?.destroy();
    this.player = new Player();
    this.player.create(this, {
      spawn: SPAWN,
      baseSpeed: 80,
      facing: 'right',
      depth: 30,
    });
    this.player.setInputEnabled(false);
    this.updateMovementLabel();
  }

  private stopPlayer(): void {
    this.input.keyboard?.resetKeys();
    this.player?.setInputEnabled(false);
    if (this.player) (this.player.getSprite().body as Phaser.Physics.Arcade.Body).stop();
  }

  update(_time: number, delta: number): void {
    if (!this.player) return;
    const canMove = movementToggle.checked && document.activeElement === this.game.canvas && !document.hidden;
    this.player.setInputEnabled(canMove);
    if (!canMove) (this.player.getSprite().body as Phaser.Physics.Arcade.Body).stop();
    this.player.update(Math.min(delta, 100));
  }

  private postUpdate(): void {
    this.player?.postUpdate();
    if (this.player) this.updateMovementLabel();
  }

  private updateMovementLabel(): void {
    if (!this.player) return;
    const position = this.player.getPosition();
    const artX = position.x * ART_WORLD_RATIO;
    const artY = (this.player.getGroundY() - WORLD_TOP) * ART_WORLD_RATIO;
    const active = movementToggle.checked && document.activeElement === this.game.canvas && !document.hidden;
    movementStatus.textContent = `原人物 · ${active ? '键盘移动观察' : '静止观察'} · 原画脚点 ${artX.toFixed(0)}, ${artY.toFixed(0)} · 无场景碰撞与遮挡。`;
  }
}

const game = new Phaser.Game(gameConfigWithScenes([SampleScene]));
window.addEventListener('pagehide', () => game.destroy(true), { once: true });

if (import.meta.hot) import.meta.hot.dispose(() => game.destroy(true));
