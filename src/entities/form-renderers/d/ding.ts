/**
 * 方案 D 丁：缓慢形变的体积云 + 三类概念基体（生产；句法课对照同一份）。
 *
 * 云罩住 R2-C2 当前盒（dingLiveRect）。软边是翘曲椭圆的密度衰减，
 * 不是方案 B paintVolume 的逐像素 hash + 棋盘跳采样。
 *
 * 字段 → 画面：
 * - substrate → 余响=错相 1px 回声带；散光=折裂亮脉；间距=错位/收窄暗体积
 * - coverage → 外沿更实、核更亮
 * - continuity → 单核一小朵仍罩住当前盒；场=沿走廊盒拉长
 * - occupancy → 只画体积云，不改碰撞
 * - motion → 位移跟当前盒；固着只形变
 * - sense / 成句走廊在看你 → 反视核：扫到前暗、扫到后亮，同色
 * - rhythm → 2–4s 外沿呼吸（休息大小的 8–15%）
 * - contact → 脚底 2–4 个浊点（depth 31–39）
 *
 * 配色：deriveFragmentContamRamp；亮核钳回 #1aad96 / #2ae6c8 / #3cffd4。
 */
import Phaser from 'phaser';
import { GAME_CONSTANTS } from '@/config/constants';
import type { CorridorAabb } from '@/generation/types';
import { dingLiveRect, DING_MORPH_PX, type PixelRect } from '@/systems/contamination-host-live';
import type {
  FormAttachContext,
  FormVisual,
  FormVisualPose,
} from '@/entities/form-renderers/form-renderer';
import { breathScale, type CloudPose } from '@/entities/form-renderers/d/ding-cloud';
import { paintDingFrame } from '@/entities/form-renderers/d/ding-paint';
import { dingRecipeFromForm, type DingRecipe } from '@/entities/form-renderers/d/ding-recipe';
import { LEXICON_DEFAULT_FRAGMENT } from '@/entities/form-renderers/d/fragment-ramp';

const TILE = GAME_CONSTANTS.TILE_SIZE;
const BODY = GAME_CONSTANTS.PLAYER.BODY_SIZE;
const STAIN_DEPTH = 35;
const PAD = 40;

/** Reuse key: occupancy × substrate × coverage × seed (+ fragment / continuity). Facing does not flip 丁. */
function textureKey(ctx: FormAttachContext): string {
  const fragment = ctx.fragmentTypeId ?? LEXICON_DEFAULT_FRAGMENT;
  return `d_volume_${fragment}_${ctx.form.substrate}_${ctx.form.coverage}_${ctx.form.continuity}_${(ctx.seed >>> 0).toString(16)}`;
}

function makeTexture(scene: Phaser.Scene, key: string, w: number, h: number): Phaser.Textures.CanvasTexture {
  if (scene.textures.exists(key)) scene.textures.remove(key);
  const tex = scene.textures.createCanvas(key, w, h);
  if (!tex) throw new Error(`[scheme-d ding] could not create canvas '${key}'`);
  tex.setFilter(Phaser.Textures.FilterMode.NEAREST);
  return tex;
}

function homeFromPin(pin: FormAttachContext['pin']): CorridorAabb {
  const x = pin?.x ?? 0;
  const y = pin?.y ?? 0;
  const w = Math.max(TILE * 2, pin?.width ?? TILE * 6);
  const h = Math.max(TILE * 2, pin?.height ?? TILE * 6);
  return {
    minCol: Math.round(x / TILE),
    minRow: Math.round(y / TILE),
    maxCol: Math.round((x + w) / TILE) - 1,
    maxRow: Math.round((y + h) / TILE) - 1,
    coreCol: Math.round((x + w * 0.5) / TILE),
    coreRow: Math.round((y + h * 0.5) / TILE),
  };
}

interface HostQuery {
  getVisualPin(id: string): {
    x: number;
    y: number;
    width?: number;
    height?: number;
  } | null;
  getSubjects(): readonly { id: string; position: { x: number; y: number } }[];
}

function hostsOn(scene: Phaser.Scene): HostQuery | null {
  const hosts = (scene as unknown as { hosts?: HostQuery }).hosts;
  if (!hosts || typeof hosts.getVisualPin !== 'function') return null;
  return hosts;
}

function hostIdAtPin(ctx: FormAttachContext): string | null {
  const hosts = hostsOn(ctx.scene);
  const pin = ctx.pin;
  if (!hosts || !pin) return null;
  let best: string | null = null;
  let bestD = 40;
  for (const row of hosts.getSubjects()) {
    const d = Math.hypot(row.position.x - pin.x, row.position.y - pin.y);
    if (d < bestD) {
      bestD = d;
      best = row.id;
    }
  }
  return best;
}

function liveFromPin(
  pin: { x: number; y: number; width?: number; height?: number } | null | undefined,
  fallback: PixelRect,
): PixelRect {
  if (!pin || pin.width == null || pin.height == null) return fallback;
  return { x: pin.x, y: pin.y, w: pin.width, h: pin.height };
}

function canvasSize(pin: FormAttachContext['pin']): number {
  const w = Math.max(TILE * 2, pin?.width ?? TILE * 6);
  const h = Math.max(TILE * 2, pin?.height ?? TILE * 6);
  const side = Math.max(w, h) + DING_MORPH_PX * 2 + Math.ceil(Math.max(w, h) * 0.16) + PAD * 2;
  return Math.max(160, Math.min(384, Math.ceil(side / 16) * 16));
}

function followPos(scene: Phaser.Scene): { x: number; y: number } | null {
  const mid = scene.cameras.main.midPoint;
  if (!mid) return null;
  return { x: mid.x, y: mid.y };
}

function aabbHits(px: number, py: number, box: PixelRect): boolean {
  const half = BODY * 0.5;
  const left = px - half;
  const right = px + half;
  const top = py - half;
  const bottom = py + half;
  return left < box.x + box.w && right > box.x && top < box.y + box.h && bottom > box.y;
}

function cloudForLive(
  recipe: DingRecipe,
  live: PixelRect,
  canvasW: number,
  canvasH: number,
  elapsedMs: number,
): CloudPose {
  const breath = breathScale(elapsedMs, recipe.breathPeriodMs, recipe.breathAmp);
  const field = recipe.continuity === 'field';
  let cx = canvasW * 0.5;
  let cy = canvasH * 0.5;
  let rx = Math.max(12, live.w * 0.5 * (field ? 1.08 : 1.06));
  let ry = Math.max(12, live.h * 0.5 * (field ? 1.08 : 1.04));
  if (recipe.family === 'space_interval') {
    if (recipe.squeeze === 'narrow') {
      if (live.w >= live.h) rx = Math.max(10, rx - recipe.squeezePx * 0.5);
      else ry = Math.max(10, ry - recipe.squeezePx * 0.5);
    } else if (live.w >= live.h) cx += recipe.squeezePx;
    else cy += recipe.squeezePx;
  }
  return { cx, cy, rx, ry, breath, morphMs: elapsedMs };
}

interface DingState {
  scene: Phaser.Scene;
  image: Phaser.GameObjects.Image;
  stains: Phaser.GameObjects.Graphics;
  texture: Phaser.Textures.CanvasTexture;
  pixels: ImageData;
  key: string;
  recipe: DingRecipe;
  home: CorridorAabb;
  motion: string;
  elapsedMs: number;
  canvasW: number;
  canvasH: number;
  hostId: string | null;
}

export function attachDingD(ctx: FormAttachContext): FormVisual {
  const recipe = dingRecipeFromForm(ctx.form, ctx);
  const key = textureKey(ctx);
  const canvasW = canvasSize(ctx.pin);
  const canvasH = canvasW;
  const texture = makeTexture(ctx.scene, key, canvasW, canvasH);
  const canvasCtx = texture.getContext();
  const pixels = canvasCtx.createImageData(canvasW, canvasH);
  const image = ctx.scene.add.image(0, 0, key);
  image.setDepth(ctx.depth);
  image.setRotation(0);
  image.setVisible(false);
  image.setOrigin(0.5, 0.5);
  const stains = ctx.scene.add.graphics();
  stains.setDepth(STAIN_DEPTH);
  const home = homeFromPin(ctx.pin);
  const state: DingState = {
    scene: ctx.scene,
    image,
    stains,
    texture,
    pixels,
    key,
    recipe,
    home,
    motion: ctx.form.lexemes.motion,
    elapsedMs: 0,
    canvasW,
    canvasH,
    hostId: hostIdAtPin(ctx),
  };

  return {
    update(pose: FormVisualPose): void {
      state.elapsedMs += pose.deltaMs;
      const pin = state.hostId ? hostsOn(state.scene)?.getVisualPin(state.hostId) : null;
      const live = liveFromPin(pin, dingLiveRect(state.home, state.motion, state.elapsedMs, TILE));
      image.setPosition(pose.x, pose.y);
      image.setRotation(0);
      if (pose.visibility <= 0) {
        image.setVisible(false);
        image.setAlpha(0);
        state.stains.clear();
        return;
      }
      const cloud = cloudForLive(recipe, live, canvasW, canvasH, state.elapsedMs);
      paintDingFrame(state.pixels.data, canvasW, canvasH, recipe, pose, state.elapsedMs, cloud);
      canvasCtx.putImageData(state.pixels, 0, 0);
      texture.refresh();
      image.setVisible(true);
      image.setAlpha(pose.visibility);
      paintStains(state, pose, live);
    },
    destroy(): void {
      image.destroy();
      stains.destroy();
      if (state.scene.textures.exists(key)) state.scene.textures.remove(key);
    },
  };
}

function paintStains(state: DingState, pose: FormVisualPose, live: PixelRect): void {
  const gfx = state.stains;
  gfx.clear();
  if (pose.visibility <= 0) return;
  const player = followPos(state.scene);
  if (!player || !aabbHits(player.x, player.y, live)) return;
  const mid = state.recipe.mid;
  const core = state.recipe.core;
  const footY = player.y + BODY * 0.5 - 2;
  const n = 2 + (Math.abs(Math.round(player.x) + Math.round(player.y)) % 3);
  for (let i = 0; i < n; i++) {
    const ox = ((i * 7 + Math.round(player.x)) % 7) - 3;
    const oy = ((i * 5 + Math.round(player.y)) % 5) - 2;
    const rgb = i % 2 === 0 ? mid : core;
    gfx.fillStyle((rgb[0] << 16) | (rgb[1] << 8) | rgb[2], 1);
    gfx.fillRect(Math.round(player.x + ox), Math.round(footY + oy), 1, 1);
  }
}
