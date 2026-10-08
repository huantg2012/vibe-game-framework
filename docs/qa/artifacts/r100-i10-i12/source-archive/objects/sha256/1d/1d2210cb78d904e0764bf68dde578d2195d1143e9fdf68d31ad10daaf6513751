import { muteSuppressedMaterial } from '@/systems/tool-ground-vfx';
/** Occupied space: R4 materials share authoritative presence; echo retains its original field. */
import Phaser from 'phaser';
import { createVolumePresenceFrame,updateVolumePresenceFrame,isVolumeDangerousAt,type VolumePresenceFrame } from '@/systems/volume-presence';
import { isMaterialVolume,paintVolumePresence } from './volume-paint';
import { GAME_CONSTANTS } from '@/config/constants';
import type { CorridorAabb } from '@/generation/types';
import { dingLiveRect, DING_MORPH_PX, type PixelRect } from '@/systems/contamination-host-live';
import type {
  FormAttachContext,
  FormVisual,
  FormVisualPose,
} from '@/entities/form-renderers/form-renderer';
import { type CloudPose } from '@/entities/form-renderers/d/ding-cloud';
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
  const stem = `d_volume_${fragment}_${ctx.form.substrate}_${ctx.form.coverage}_${ctx.form.continuity}_${(ctx.seed >>> 0).toString(16)}_${ctx.subjectId??'standalone'}`;
  return ctx.textureNamespace ? `${ctx.textureNamespace}_${stem}` : stem;
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
  getVolumePresenceFrame?(id:string):Readonly<VolumePresenceFrame>|undefined;
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
  if (ctx.subjectId) return ctx.subjectId;
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

function followPos(
  scene: Phaser.Scene,
  stainWorldPoint?: { x: number; y: number },
): { x: number; y: number } | null {
  if (stainWorldPoint) return stainWorldPoint;
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
  _recipe: DingRecipe,
  live: PixelRect,
  canvasW: number,
  canvasH: number,
  elapsedMs: number,
): CloudPose {
  // Exact live hazard dimensions; animation lives inside this box.
  return { cx:canvasW*.5,cy:canvasH*.5,rx:live.w*.5,ry:live.h*.5,breath:1,morphMs:elapsedMs };

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
  fixedRect:{x:number;y:number;w:number;h:number};
  pinned:boolean;
  motion: string;
  elapsedMs: number;
  canvasW: number;
  canvasH: number;
  hostId: string | null;
  stainWorldPoint?: { x: number; y: number };
  lastPaintKey?: string;
  presence:VolumePresenceFrame;
  isWalkableFloor?:FormAttachContext['isWalkableFloor'];
  seed:number;
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
    fixedRect:{x:ctx.pin?.x??0,y:ctx.pin?.y??0,w:ctx.pin?.width??TILE*6,h:ctx.pin?.height??TILE*6},
    pinned:ctx.pin!==undefined,
    motion: ctx.form.lexemes.motion,
    elapsedMs: 0,
    canvasW,
    canvasH,
    hostId: hostIdAtPin(ctx),
    stainWorldPoint: ctx.stainWorldPoint,
    presence:createVolumePresenceFrame(),isWalkableFloor:ctx.isWalkableFloor,seed:ctx.seed,
  };

  return {
    update(pose: FormVisualPose): void {
      state.elapsedMs += pose.deltaMs;
      const explicitTime=pose.volumeTimeMs;
      if(explicitTime!==undefined)state.elapsedMs=explicitTime;
      const hostPresence=state.hostId?hostsOn(state.scene)?.getVolumePresenceFrame?.(state.hostId):undefined;
      const pin = state.hostId ? hostsOn(state.scene)?.getVisualPin(state.hostId) : null;
      if(!state.pinned){state.fixedRect.x=pose.x-state.fixedRect.w*.5;state.fixedRect.y=pose.y-state.fixedRect.h*.5;}
      const live = liveFromPin(pin, isMaterialVolume(recipe.family)?state.fixedRect:dingLiveRect(state.home, state.motion, state.elapsedMs, TILE));
      const presence=isMaterialVolume(recipe.family)?hostPresence??updateVolumePresenceFrame(state.presence,{
        substrate:recipe.family,coverage:recipe.coverage,elapsedMs:state.elapsedMs,rect:live,
        active:pose.activity?.phase!=='rest',isWalkableFloor:state.isWalkableFloor,
      }):undefined;
      image.setPosition(presence?presence.rect.x+presence.rect.w*.5:pose.x,presence?presence.rect.y+presence.rect.h*.5:pose.y);
      image.setRotation(0);
      if (pose.visibility <= 0) {
        image.setVisible(false);
        image.setAlpha(0);
        state.stains.clear();
        return;
      }
      const paintKey = `${Math.floor((presence?.elapsedMs??state.elapsedMs) / (1000/60))}:${pose.signal}:${pose.toolControl}:${pose.activity?.phase}:${pose.activity?.progress}:${presence?.active}:${presence?.rect.x}:${presence?.rect.y}:${presence?.rect.w}:${presence?.rect.h}:${presence?.phase}:${presence?.progress}:${explicitTime}:${presence?.coreX}:${presence?.coreY}`;
      if (state.lastPaintKey !== paintKey) {
        const cloud = cloudForLive(recipe, live, canvasW, canvasH, state.elapsedMs);
        if(presence)paintVolumePresence(state.pixels.data,canvasW,canvasH,presence,state.seed,recipe.paintStrikeCore?recipe.strikeCorePx:0,pose.activity?.phase==='rest'?.5:pose.activity?.phase==='waking'?.5+.5*pose.activity.progress:1);
        else paintDingFrame(state.pixels.data, canvasW, canvasH, recipe, pose, state.elapsedMs, cloud);
        if (pose.toolControl === 'suppressed') muteSuppressedMaterial(state.pixels.data);
        canvasCtx.putImageData(state.pixels, 0, 0);
        texture.refresh();
        state.lastPaintKey = paintKey;
      }
      image.setVisible(true);
      image.setAlpha(pose.visibility);
      paintStains(state, pose, live,presence);
    },
    destroy(): void {
      image.destroy();
      stains.destroy();
      if (state.scene.textures.exists(key)) state.scene.textures.remove(key);
    },
  };
}

function paintStains(state: DingState, pose: FormVisualPose, live: PixelRect,presence?:Readonly<VolumePresenceFrame>): void {
  const gfx = state.stains;
  gfx.clear();
  if (pose.visibility <= 0) return;
  const activity = pose.activity?.phase === 'rest' ? 0 : pose.activity?.phase === 'waking' ? pose.activity.progress : 1;
  if (activity <= 0) return;
  const player = followPos(state.scene, state.stainWorldPoint);
  if (!player || (presence?!isVolumeDangerousAt(presence,player.x,player.y):!aabbHits(player.x, player.y, live))) return;
  const mid = state.recipe.mid;
  const core = state.recipe.core;
  const footY = player.y + BODY * 0.5 - 2;
  const n = 2 + (Math.abs(Math.round(player.x) + Math.round(player.y)) % 3);
  for (let i = 0; i < n; i++) {
    const ox = ((i * 7 + Math.round(player.x)) % 7) - 3;
    const oy = ((i * 5 + Math.round(player.y)) % 5) - 2;
    const rgb = i % 2 === 0 ? mid : core;
    gfx.fillStyle((rgb[0] << 16) | (rgb[1] << 8) | rgb[2], activity);
    gfx.fillRect(Math.round(player.x + ox), Math.round(footY + oy), 1, 1);
  }
}
