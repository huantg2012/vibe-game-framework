/**
 * Oil-film vein-variant card pull. Two rounds stamped on open, six cards.
 * Round 1 (A/B/C) pulled by cursor-grok-4.6-xhigh-fast; round 2 (D/E/F) by kimi-k3.
 * Not a gallery catalog. Not the lexicon observation yard.
 * Must not import `d/genome`. Must not raise sortie paint.
 */

import Phaser from 'phaser';
import { GAME_CONSTANTS } from '@/config/constants';
import { attachBingPaintGenome } from '@/entities/form-renderers/d/paint-genome/attach';
import type { PaintVeinVariant } from '@/entities/form-renderers/d/paint-genome/topology';
import { LEXICON_DEFAULT_FRAGMENT } from '@/entities/form-renderers/d/fragment-ramp';
import type { FormVisual } from '@/entities/form-renderers/form-renderer';
import type { ContaminationForm } from '@/generation/contamination-draw';
import {
  bindGymCamera,
  lockGymPhaserHost,
  unlockGymPhaserHost,
  type GymCameraHandle,
} from '@/gym/gym-camera';

const CARD_SEED = 1000;
/** 200px box around a 88px texture at displayScale 2. Two rows of three. */
const CARD_BOX = 200;
const CARD_XS = [190, 480, 770] as const;
const CARD_YS = [200, 460] as const;
const CARD_DISPLAY_SCALE = 2;
const ROUND_ONE_MODEL = 'cursor-grok-4.6-xhigh-fast';
const ROUND_TWO_MODEL = 'kimi-k3';
const CARD_STAGE_CLASS = 'gym-paint-vein-card-stage';

interface CardDef {
  readonly variant: PaintVeinVariant;
  readonly label: string;
  readonly model: string;
}

const CARDS: readonly CardDef[] = [
  { variant: 0, label: 'A 更扁更贴地', model: ROUND_ONE_MODEL },
  { variant: 1, label: 'B 更亮膜感', model: ROUND_ONE_MODEL },
  { variant: 2, label: 'C 更汇流', model: ROUND_ONE_MODEL },
  { variant: 3, label: 'D 聚珠成滩', model: ROUND_TWO_MODEL },
  { variant: 4, label: 'E 沾抹拖尾', model: ROUND_TWO_MODEL },
  { variant: 5, label: 'F 薄滩收边', model: ROUND_TWO_MODEL },
];

const OIL_FILM_REWRITE: ContaminationForm = {
  substrate: 'oil_film',
  coverage: 'rewrite',
  continuity: 'colony',
  occupancy: 'paint',
  portfolio: 'bing',
  lexemes: {
    motion: 'motion_cluster',
    sense: 'sense_touch',
    rhythm: 'rhythm_cluster',
    contact: 'contact_step_chaos',
  },
};

interface CardSlot {
  readonly variant: PaintVeinVariant;
  readonly x: number;
  readonly y: number;
  readonly visual: FormVisual;
}

export class GymPaintVeinCardScene extends Phaser.Scene {
  private cameraHandle: GymCameraHandle | null = null;
  private slots: CardSlot[] = [];

  constructor() {
    super({ key: 'GymPaintVeinCardScene' });
  }

  create(): void {
    this.input.mouse?.disableContextMenu();
    const host = lockGymPhaserHost();
    host?.classList.add(CARD_STAGE_CLASS);
    const camera = this.cameras.main;
    camera.setBackgroundColor(GAME_CONSTANTS.VISIBILITY.VOID_COLOR);
    camera.setBounds(0, 0, 960, 640);
    camera.setZoom(1);
    camera.centerOn(480, 320);
    this.cameraHandle = bindGymCamera(this, { panHost: host, zoomMin: 0.5 });

    this.slots = CARDS.map((card, index) => {
      const x = CARD_XS[index % 3]!;
      const y = CARD_YS[Math.floor(index / 3)]!;
      this.add.rectangle(x, y, CARD_BOX, CARD_BOX, 0x0e1114, 1).setDepth(0);
      this.add
        .text(x, y - CARD_BOX / 2 - 6, card.label, {
          fontFamily: '"Courier New", Courier, monospace',
          fontSize: '14px',
          color: '#c8cdd4',
        })
        .setOrigin(0.5, 1)
        .setDepth(2);
      this.add
        .text(x, y + CARD_BOX / 2 - 4, card.model, {
          fontFamily: '"Courier New", Courier, monospace',
          fontSize: '10px',
          color: '#8a8f96',
        })
        .setOrigin(0.5, 1)
        .setDepth(2);
      const visual = attachBingPaintGenome({
        scene: this,
        form: OIL_FILM_REWRITE,
        seed: CARD_SEED,
        depth: 1,
        fragmentTypeId: LEXICON_DEFAULT_FRAGMENT,
        textureNamespace: `paint_vein_card_${card.variant}`,
        paintVeinVariant: card.variant,
        displayScale: CARD_DISPLAY_SCALE,
        pin: { kind: 'cluster', x, y },
      });
      poseSlot(visual, x, y);
      return { variant: card.variant, x, y, visual };
    });

    const title = document.getElementById('gym-title');
    if (title) title.textContent = '练习场 · 油膜脉络抽卡';
    const roster = document.getElementById('gym-roster');
    if (roster) {
      roster.textContent = [
        '六格同一颗种子 1000 · 覆盖 改写 · 基体 油膜 · 连续性 菌落',
        `第一轮 A/B/C 抽卡模型 ${ROUND_ONE_MODEL}`,
        `第二轮 D/E/F 抽卡模型 ${ROUND_TWO_MODEL}`,
        '打开即六格都在画面上。不要点生成，不要翻句法课侧栏。',
      ].join('\n');
    }
    const status = document.getElementById('gym-status');
    if (status) {
      status.textContent =
        '滚轮缩放抽卡区域，拖动画布平移。开发课，不是陈列馆，不是游戏内界面。人抽完才定默认。';
    }

    this.events.once(Phaser.Scenes.Events.SHUTDOWN, this.onShutdown, this);
    this.events.once(Phaser.Scenes.Events.DESTROY, this.onShutdown, this);
  }

  update(): void {
    for (const slot of this.slots) poseSlot(slot.visual, slot.x, slot.y);
  }

  private onShutdown(): void {
    this.cameraHandle?.destroy();
    this.cameraHandle = null;
    for (const slot of this.slots) slot.visual.destroy();
    this.slots = [];
    document.getElementById('game-container')?.classList.remove(CARD_STAGE_CLASS);
    unlockGymPhaserHost();
  }
}

function poseSlot(visual: FormVisual, x: number, y: number): void {
  visual.update({
    x,
    y,
    facing4: 'down',
    moving: false,
    visibility: 1,
    signal: 'idle',
    deltaMs: 0,
  });
}
