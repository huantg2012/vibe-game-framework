import { muteSuppressedMaterial } from '@/systems/tool-ground-vfx';
/**
 * 占漆拓扑挂载。烤拓扑静帧；检视 / 句法课 / 出击沿生长方向连续扩散收缩（DEC-070 5–20%）。
 * 油膜省略 `paintVeinVariant` 时按个体种子采样 3/4/5。陈列馆浏览 `deltaMs === 0` 只留静帧。
 * 禁止 import `d/genome`。禁止切预烤帧。
 */
import Phaser from 'phaser';
import { GAME_CONSTANTS } from '@/config/constants';
import {
  bakePaintGenome,
  collectPaintGenomeFloorTiles,
  type PaintGrowthGuide,
} from '@/entities/form-renderers/d/paint-genome/bake';
import { resolvePaintVeinVariant } from '@/entities/form-renderers/d/paint-genome/topology';
import { paintSurfaceMaterial } from './material';
import { PaintSurfaceVisibility } from './visibility';
import { fitLegacyPaintPresentation, type LegacyPaintPresentationReport } from './legacy-presentation';
import { paintPaintGenomeLive } from '@/entities/form-renderers/d/paint-genome/live';
import { LEXICON_DEFAULT_FRAGMENT, type FragmentContamRamp } from '@/entities/form-renderers/d/fragment-ramp';
import { removeKeys } from '@/entities/form-renderers/d/jia-pixels';
import {
  applyFormVisibility,
  type FormAttachContext,
  type FormVisual,
  type FormVisualPose,
} from '@/entities/form-renderers/form-renderer';

function textureKey(ctx: FormAttachContext, vein: string, offsetX = 0, offsetY = 0): string {
  const fragment = ctx.fragmentTypeId ?? LEXICON_DEFAULT_FRAGMENT;
  const prefix = ctx.textureNamespace ? `${ctx.textureNamespace}_` : '';
  const sense = ctx.form.lexemes.sense;
  const rhythm = ctx.form.lexemes.rhythm;
  return `${prefix}d_paint_genome_${fragment}_${ctx.form.substrate}_${ctx.form.coverage}_${ctx.form.continuity}_${sense}_${rhythm}_display2_mechanics${ctx.paintGeometryVersion ?? 2}_fit${offsetX}_${offsetY}_v${vein}_${(ctx.seed >>> 0).toString(16)}`;
}

function makeTexture(scene: Phaser.Scene, key: string, w: number, h: number): Phaser.Textures.CanvasTexture {
  if (scene.textures.exists(key)) scene.textures.remove(key);
  const tex = scene.textures.createCanvas(key, w, h);
  if (!tex) throw new Error(`[paint-genome] could not create canvas '${key}'`);
  tex.setFilter(Phaser.Textures.FilterMode.NEAREST);
  return tex;
}

class BingPaintGenomeVisual implements FormVisual {
  readonly stepFloors: readonly { readonly col: number; readonly row: number }[];
  readonly legacyPresentationReport?: LegacyPaintPresentationReport & { readonly ok: boolean; readonly reason?: string };
  private readonly scene: Phaser.Scene;
  private readonly image: Phaser.GameObjects.Image;
  private readonly texture: Phaser.Textures.CanvasTexture;
  private readonly canvasCtx: CanvasRenderingContext2D;
  private readonly pixels: ImageData;
  private readonly rest: Float32Array;
  private readonly scratch: Float32Array;
  private readonly growth: PaintGrowthGuide;
  private readonly key: string;
  private readonly w: number;
  private readonly h: number;
  private readonly ramp: FragmentContamRamp;
  private clock = 0;
  private readonly substrate: string;
  private readonly coverage: FormAttachContext['form']['coverage'];
  private readonly seed: number;
  private readonly subjectId?: string;
  private readonly footprint: Phaser.GameObjects.Graphics;
  private readonly dangerMask: Uint8Array;
  private readonly terrainMask: Uint8Array;
  private readonly legacyContactMask?: Uint8Array;
  private readonly isWalkableFloor?: FormAttachContext['isWalkableFloor'];
  private readonly surfaceFloorAt?: FormAttachContext['surfaceFloorAt'];
  private readonly surfaceFloorPoint = { x: 0, y: 0 };
  private readonly surfaceOrigin?: {readonly x:number;readonly y:number};
  private readonly surfaceVisibility?: PaintSurfaceVisibility;
  private readonly surfaceVisibilityRevision?: () => number;
  private readonly surfaceIntersectsSight?: FormAttachContext['surfaceIntersectsSight'];
  private readonly surfaceBounds = { left: 0, top: 0, right: 0, bottom: 0 };
  private readonly boundsOffsets = { left: 0, top: 0, right: 0, bottom: 0 };

  constructor(ctx: FormAttachContext) {
    this.scene = ctx.scene;
    this.surfaceVisibilityRevision = ctx.surfaceVisibilityRevision;
    this.surfaceIntersectsSight = ctx.surfaceIntersectsSight;
    this.isWalkableFloor=ctx.isWalkableFloor;
    this.surfaceFloorAt=ctx.surfaceFloorAt;
    this.surfaceOrigin=ctx.pin?{x:ctx.pin.x,y:ctx.pin.y}:undefined;
    this.substrate=ctx.form.substrate; this.coverage=ctx.form.coverage; this.seed=ctx.seed; this.subjectId=ctx.subjectId;
    this.footprint=ctx.scene.add.graphics().setDepth(ctx.depth-.01);
    const veinVariant = resolvePaintVeinVariant(ctx.form.substrate, ctx.seed, ctx.paintVeinVariant);
    const recipe = {
      substrate: ctx.form.substrate,
      coverage: ctx.form.coverage,
      seed: ctx.seed,
      continuity: ctx.form.continuity,
      sense: ctx.form.lexemes.sense,
      rhythm: ctx.form.lexemes.rhythm,
      fragmentTypeId: ctx.fragmentTypeId,
      veinVariant,
    };
    // Saved worlds retain their exact contact cells/nucleus seats. They do not
    // need to retain a broken, truncated texture: presentation always has the
    // complete geometry, independently of that frozen gameplay contract.
    let baked = bakePaintGenome({ ...recipe, geometryVersion: 2 });
    const contact = ctx.paintGeometryVersion === 1
      ? bakePaintGenome({ ...recipe, geometryVersion: 1 }) : baked;
    if (ctx.paintGeometryVersion === 1 && ctx.pin && ctx.surfaceFloorAt) {
      const fit = fitLegacyPaintPresentation(baked, { originX: ctx.pin.x, originY: ctx.pin.y,
        tileSize: ctx.surfaceFloorTileSize ?? GAME_CONSTANTS.TILE_SIZE,
        surfaceFloorAt: ctx.surfaceFloorAt, maxOffset: 96 });
      this.legacyPresentationReport = Object.freeze({ ...fit.report, ok: fit.ok, ...(!fit.ok ? { reason: fit.reason } : {}) });
      if (fit.ok) baked = fit.baked;
      // An exceptional old narrow map may not fit the complete presentation
      // locally. Keep the full canvas and real VOID occlusion in that case;
      // expose the failed fit rather than rewriting saved gameplay or terrain.
    }
    this.w = baked.canvasW;
    this.h = baked.canvasH;
    const tile = GAME_CONSTANTS.TILE_SIZE;
    const maskSize = (Math.ceil(this.w / tile) + 2) * (Math.ceil(this.h / tile) + 2);
    this.dangerMask = new Uint8Array(maskSize);
    this.terrainMask = new Uint8Array(maskSize);
    if (ctx.paintGeometryVersion === 1) this.legacyContactMask = new Uint8Array(maskSize);
    if (ctx.surfaceVisibilityAt) this.surfaceVisibility = new PaintSurfaceVisibility(this.w, this.h, ctx.surfaceVisibilityAt);
    this.rest = baked.field;
    this.scratch = new Float32Array(baked.field.length);
    this.growth = baked.growth;
    this.ramp = baked.ramp;
    this.stepFloors = ctx.pin
      ? collectPaintGenomeFloorTiles(
          contact.field,
          contact.canvasW,
          contact.canvasH,
          ctx.pin.x,
          ctx.pin.y,
          GAME_CONSTANTS.TILE_SIZE,
        ).filter(cell=>!this.isWalkableFloor||this.isWalkableFloor(cell.col,cell.row))
      : [];
    Object.assign(this.boundsOffsets, { left: -this.w * .5, top: -this.h * .5, right: this.w * .5, bottom: this.h * .5 });
    if (ctx.pin) for (const cell of this.stepFloors) {
      this.boundsOffsets.left = Math.min(this.boundsOffsets.left, cell.col * tile - ctx.pin.x);
      this.boundsOffsets.top = Math.min(this.boundsOffsets.top, cell.row * tile - ctx.pin.y);
      this.boundsOffsets.right = Math.max(this.boundsOffsets.right, (cell.col + 1) * tile - ctx.pin.x);
      this.boundsOffsets.bottom = Math.max(this.boundsOffsets.bottom, (cell.row + 1) * tile - ctx.pin.y);
    }
    this.key = textureKey(ctx, veinVariant === undefined ? 'x' : String(veinVariant),
      this.legacyPresentationReport?.offsetX, this.legacyPresentationReport?.offsetY);
    this.texture = makeTexture(ctx.scene, this.key, this.w, this.h);
    this.canvasCtx = this.texture.getContext();
    this.pixels = this.canvasCtx.createImageData(this.w, this.h);
    paintSurfaceMaterial(this.pixels.data,this.rest,this.w,this.h,this.substrate,this.coverage,this.seed);
    if(ctx.pin&&(this.isWalkableFloor||this.surfaceFloorAt))this.applyDangerSurface({x:ctx.pin.x,y:ctx.pin.y,facing4:'down',moving:false,visibility:1,signal:'idle',deltaMs:0},false);
    this.canvasCtx.putImageData(this.pixels, 0, 0);
    this.texture.refresh();
    this.image = ctx.scene.add.image(0, 0, this.key);
    this.image.setDepth(ctx.depth);
    this.image.setOrigin(0.5, 0.5);
    this.image.setRotation(0);
    if (ctx.displayScale !== undefined) this.image.setScale(ctx.displayScale);
    this.image.setVisible(false);
  }

  update(pose: FormVisualPose): void {
    // A nucleus may be re-seated after the footprint is registered. Its core
    // position is not the origin of this fixed surface, so keep the same pin
    // for rendering, terrain clipping and the originally registered cells.
    if(this.surfaceOrigin)pose={...pose,...this.surfaceOrigin};
    this.clock += pose.deltaMs;
    this.image.setPosition(pose.x, pose.y);
    this.image.setRotation(0);
    this.surfaceBounds.left = pose.x + this.boundsOffsets.left;
    this.surfaceBounds.top = pose.y + this.boundsOffsets.top;
    this.surfaceBounds.right = pose.x + this.boundsOffsets.right;
    this.surfaceBounds.bottom = pose.y + this.boundsOffsets.bottom;
    if (this.surfaceVisibility && this.surfaceIntersectsSight && !this.surfaceIntersectsSight(this.surfaceBounds)) {
      applyFormVisibility(this.image, 0);
      applyFormVisibility(this.footprint, 0);
      this.footprint.clear();
      return;
    }
    // The core can be outside the cone while part of this surface is inside.
    // Local samples own surface alpha; the core scalar remains for inspectors
    // without a world sight provider and for the independently drawn nuclei.
    const visibility = this.surfaceVisibility ? 1 : pose.visibility;
    applyFormVisibility(this.image, visibility);
    applyFormVisibility(this.footprint, visibility);
    if (visibility <= 0) return;
    this.surfaceVisibility?.begin(pose.x - this.w * .5, pose.y - this.h * .5, this.surfaceVisibilityRevision?.());
    paintPaintGenomeLive({
      rest: this.rest,
      scratch: this.scratch,
      out: this.pixels.data,
      w: this.w,
      h: this.h,
      elapsedMs: pose.activity?.phase==='rest'?0:this.clock,
      inflated: pose.signal === 'inflated',
      ramp: this.ramp,
      growth: this.growth,
    });
    paintSurfaceMaterial(this.pixels.data,this.scratch,this.w,this.h,this.substrate,this.coverage,this.seed,this.clock,pose);
    this.applyDangerSurface(pose);
    if (this.surfaceVisibility) {
      const visible = this.surfaceVisibility.clip(this.pixels.data, this.w, this.h, pose.x - this.w * .5, pose.y - this.h * .5);
      applyFormVisibility(this.image, visible ? 1 : 0);
    }
    if (pose.toolControl === 'suppressed') muteSuppressedMaterial(this.pixels.data);
    this.canvasCtx.putImageData(this.pixels, 0, 0);
    this.texture.refresh();
  }

  private applyDangerSurface(pose: FormVisualPose, drawFootprint = true): void {
    const host=(this.scene as unknown as {hosts?:{isPaintFloorActive(id:string,col:number,row:number):boolean}}).hosts;
    this.footprint.clear();
    const liveHost=host?.isPaintFloorActive&&this.subjectId?host:null;
    if(!liveHost&&!this.isWalkableFloor&&!this.surfaceFloorAt) return;
    const tile=GAME_CONSTANTS.TILE_SIZE;
    const left=pose.x-this.w*.5,top=pose.y-this.h*.5;
    const c0=Math.floor(left/tile),r0=Math.floor(top/tile),stride=Math.ceil(this.w/tile)+2;
    this.dangerMask.fill(0);
    this.terrainMask.fill(1);
    this.legacyContactMask?.fill(0);
    if(this.isWalkableFloor) {
      const lastCol=Math.floor((left+this.w-0.5)/tile),lastRow=Math.floor((top+this.h-0.5)/tile);
      for(let row=r0;row<=lastRow;row++)for(let col=c0;col<=lastCol;col++)
        this.terrainMask[(row-r0)*stride+col-c0]=this.isWalkableFloor(col,row)?1:0;
    }
    let hasActivePaint = false;
    for(const cell of this.stepFloors) {
      const index=(cell.row-r0)*stride+cell.col-c0;
      if(this.legacyContactMask&&index>=0&&index<this.legacyContactMask.length)this.legacyContactMask[index]=1;
      if(!liveHost||!liveHost.isPaintFloorActive(this.subjectId!,cell.col,cell.row)) continue;
      if(index>=0&&index<this.dangerMask.length&&this.terrainMask[index]) {
        this.dangerMask[index]=1;
        hasActivePaint=true;
      }
    }
    for(const cell of this.stepFloors) {
      if(!drawFootprint)break;
      const index=(cell.row-r0)*stride+cell.col-c0;
      if(!this.dangerMask[index])continue;
      const hasLeft=cell.col>c0&&!!this.dangerMask[index-1];
      const hasRight=!!this.dangerMask[index+1];
      const hasUp=!!this.dangerMask[index-stride],hasDown=!!this.dangerMask[index+stride];
      // Connected deposits share their internal edges. Only exposed perimeter
      // frays into 2–3px clusters; no isolated rectangular tile highlight.
      const ink=this.substrate==='oil_film'?0x293b32:this.substrate==='ash_veil'?0x4b5044:0x435548;
      for(let y=0;y<tile;y+=2)for(let x=0;x<tile;x+=2) {
        const edge=Math.min(hasLeft?tile:x+1,hasRight?tile:tile-x,hasUp?tile:y+1,hasDown?tile:tile-y);
        const wx=cell.col*tile+x,wy=cell.row*tile+y;
        const pattern=(Math.imul(Math.floor(wx/3)+this.seed,17)^Math.imul(Math.floor(wy/2),29))>>>0;
        if(edge<5&&pattern%6>=edge)continue;
        const visibility=this.surfaceVisibility?.at(wx+1,wy+1)??1;
        if(visibility<=0)continue;
        this.footprint.fillStyle(ink,(pose.signal==='inflated'?.32:.24)*(pattern%3===0?.65:1)*visibility);
        this.footprint.fillRect(wx,wy,2,2);
      }
    }
    for(let y=0;y<this.h;y++) for(let x=0;x<this.w;x++) {
      const i=(y*this.w+x)*4;
      if(this.pixels.data[i+3]===0) continue;
      const index=(Math.floor((top+y+.5)/tile)-r0)*stride+Math.floor((left+x+.5)/tile)-c0;
      this.surfaceFloorPoint.x=left+x+.5;
      this.surfaceFloorPoint.y=top+y+.5;
      // Physical 8px ground can exist in a cell that the conservative 32px
      // Host grid rejects. It may show harmless material, never new danger.
      const supported=this.surfaceFloorAt?this.surfaceFloorAt(this.surfaceFloorPoint):!!this.terrainMask[index];
      if(!supported) { this.pixels.data[i+3]=0; continue; }
      // Restored legacy silhouettes may extend beyond their frozen contact
      // cells. Keep that body continuous while its host lives, with danger
      // still communicated by the original active deposits. Killed registered
      // regions and an entirely inactive host retain their residual material.
      const livingLegacyExtension=!!this.legacyContactMask&&!this.legacyContactMask[index]&&hasActivePaint;
      if(liveHost&&!this.dangerMask[index]&&!livingLegacyExtension) {
        this.pixels.data[i]=30;this.pixels.data[i+1]=39;this.pixels.data[i+2]=35;this.pixels.data[i+3]=100;
      }
    }
  }

  destroy(): void {
    this.image.destroy();
    this.footprint.destroy();
    removeKeys(this.scene, [this.key]);
  }
}

export function attachBingPaintGenome(ctx: FormAttachContext): FormVisual {
  return new BingPaintGenomeVisual(ctx);
}
