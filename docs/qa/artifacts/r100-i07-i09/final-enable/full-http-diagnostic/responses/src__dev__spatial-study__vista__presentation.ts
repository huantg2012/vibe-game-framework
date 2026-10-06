import Phaser from 'phaser';
import type { RiftDevRuntimeContext } from '@/scenes/rift-scene';
import { TileType } from '@/types/game-types';
import { grain, makeSeabed } from '../ground';
import { makeDatumReef } from '../datum-reef';
import { SpatialSliceWorld, type SlicePresentation } from '../slice-world';
import { VoidRegions } from '../void-regions';
import { WaterFlowCycle, createFallingWaterFlow } from '../water-flow';

const STEP = 2;
const FIELD_STEP = 8;
const clamp = (v: number, lo = 0, hi = 1) => Math.max(lo, Math.min(hi, v));
let sequence = 0;

/** The external vista belongs beyond the map's edge. Enclosed missing regions
 * remain unknowable: neither a lower world nor an upper sea is drawn in them. */
export class VistaPresentation implements SlicePresentation {
  private readonly id = `slice-vista-${sequence++}`;
  private readonly images: Phaser.GameObjects.Image[] = [];
  private readonly keys: string[] = [];
  private readonly ceiling: Phaser.Textures.CanvasTexture;
  private readonly abyss: Phaser.Textures.CanvasTexture;
  private readonly light: Phaser.Textures.CanvasTexture;
  private readonly reef: Phaser.GameObjects.Image;
  private readonly pixels: ImageData;
  private readonly abyssPixels: ImageData;
  private readonly waterPixels: Uint8ClampedArray;
  private readonly textureW: number;
  private readonly textureH: number;
  private readonly pw: number;
  private readonly ph: number;
  private readonly fw: number;
  private readonly fh: number;
  private readonly field: Float32Array;
  private readonly vision: Float32Array;
  private readonly nearest: Int32Array;
  private readonly voidComponent: Int16Array;
  private readonly windowRims: number[][] = [];
  private readonly windowAwareness: number[] = [];
  private readonly isGround: Uint8Array;
  private readonly isAbsence: Uint8Array;
  private readonly absenceIndices: number[] = [];
  private readonly regions: VoidRegions;
  private readonly flowCycle: WaterFlowCycle;
  private readonly flow = createFallingWaterFlow();
  private readonly grain: Float32Array;
  private readonly samplePoint = { x: 0, y: 0 };
  private lastField = -Infinity;
  private lastPaint = -Infinity;
  private giantX = 0;
  private visibleVoidPixels = 0;
  private seaCoverage = 0;
  private viewerX = 0;
  private viewerY = 0;
  private disposed = false;

  constructor(private readonly context: RiftDevRuntimeContext, private readonly world: SpatialSliceWorld) {
    this.pw = Math.ceil(world.width / STEP); this.ph = Math.ceil(world.height / STEP);
    this.fw = Math.ceil(world.width / FIELD_STEP) + 1; this.fh = Math.ceil(world.height / FIELD_STEP) + 1;
    this.field = new Float32Array(this.fw * this.fh);
    this.vision = new Float32Array(this.fw * this.fh);
    this.nearest = new Int32Array(this.fw * this.fh).fill(-1);
    this.voidComponent = new Int16Array(this.fw * this.fh).fill(-1);
    this.isGround = new Uint8Array(this.pw * this.ph);
    this.isAbsence = new Uint8Array(this.pw * this.ph);
    this.regions = new VoidRegions(world.layout.tileMap);
    this.flowCycle = new WaterFlowCycle(world.waterDefinition);
    this.grain = new Float32Array(this.pw * this.ph);
    const scene = context.scene;
    const bed = makeSeabed(world.layout.tileMap, world.seed, 0);
    // A strict overhead floor has no side-view skirt below its southern edge.
    const bedCtx = bed.getContext('2d')!;
    for (let y = 0; y < bed.height; y += 32) for (let x = 0; x < bed.width; x += 32) {
      const tile = world.layout.tileMap.tiles[Math.floor(y / 32)]?.[Math.floor(x / 32)];
      if (tile === undefined || tile === TileType.VOID) bedCtx.clearRect(x, y, 32, 32);
    }
    const bedKey = `${this.id}-bed`; scene.textures.addCanvas(bedKey, bed); this.keys.push(bedKey);
    this.images.push(scene.add.image(0, 0, bedKey).setOrigin(0).setDepth(.45));
    this.abyss = this.layer('lower-world', 50.2);
    this.light = this.layer('bed-light', 4);
    this.ceiling = this.layer('upper-sea', 51);
    this.pixels = this.ceiling.getContext().createImageData(this.pw, this.ph);
    this.abyssPixels = this.abyss.getContext().createImageData(this.pw, this.ph);
    const topReef = makeDatumReef(0, 1, world.reef), reefKey = `${this.id}-reef`;
    scene.textures.addCanvas(reefKey, topReef.canvas); this.keys.push(reefKey);
    this.reef = scene.add.image(topReef.footX - topReef.originX, topReef.footY - topReef.originY, reefKey).setOrigin(0);
    this.images.push(this.reef);
    const source = scene.textures.get('spatial-sea-material').getSourceImage() as HTMLImageElement;
    const sampler = document.createElement('canvas');
    this.textureW = sampler.width = 512; this.textureH = sampler.height = 342;
    const samplerCtx = sampler.getContext('2d', { willReadFrequently: true })!;
    samplerCtx.imageSmoothingEnabled = false;
    samplerCtx.drawImage(source, 0, 0, this.textureW, this.textureH);
    this.waterPixels = samplerCtx.getImageData(0, 0, this.textureW, this.textureH).data;
    this.bakeQueries();
    // Opaque absence is the final WORLD surface, below the production HUD. It
    // also prevents another effect layer from accidentally revealing this area.
    const absence = this.layer('unreachable-absence', 52), absenceCtx = absence.getContext();
    const absentAt = (x:number,y:number):boolean => x>=0 && y>=0 && x<this.pw && y<this.ph
      && this.isAbsence[y*this.pw+x]===1;
    absenceCtx.fillStyle = '#06090a';
    for (let y = 0; y < this.ph; y++) for (let x = 0; x < this.pw; x++) {
      if (this.isAbsence[y * this.pw + x]) {
        absenceCtx.globalAlpha = 1; absenceCtx.fillRect(x, y, 1, 1); continue;
      }
      // The void stays fully opaque. Only its OUTSIDE lip loses light into
      // fine irregular pixels, rather than ending as a hard UI-like rectangle.
      const reach = 6;
      if (![-reach,0,reach].some(dx => [-reach,0,reach].some(dy =>
        absentAt(x + dx,y + dy)))) continue;
      let distance = reach + 1;
      for (let dy = -reach; dy <= reach; dy++) for (let dx = -reach; dx <= reach; dx++) {
        if (absentAt(x + dx,y + dy)) distance = Math.min(distance, Math.hypot(dx,dy));
      }
      const fringe = 3 + grain(Math.floor(x / 3), Math.floor(y / 2), world.seed) * 3;
      absenceCtx.globalAlpha = Math.pow(clamp(1 - distance / fringe), .7) * .91;
      absenceCtx.fillRect(x, y, 1, 1);
    }
    absenceCtx.globalAlpha = 1;
    absence.refresh();
  }

  private layer(name: string, depth: number): Phaser.Textures.CanvasTexture {
    const key = `${this.id}-${name}`, scene = this.context.scene;
    const texture = scene.textures.createCanvas(key, this.pw, this.ph);
    if (!texture) throw new Error(`Unable to create ${name}`);
    texture.setFilter(Phaser.Textures.FilterMode.NEAREST);
    this.images.push(scene.add.image(0, 0, key).setOrigin(0).setScale(STEP).setDepth(depth));
    this.keys.push(key); return texture;
  }

  private bakeQueries(): void {
    const queue = new Int32Array(this.nearest.length); let tail = 0;
    for (let row = 0; row < this.fh; row++) for (let col = 0; col < this.fw; col++) {
      const key = row * this.fw + col;
      if (this.world.isFloor(col * FIELD_STEP, row * FIELD_STEP)) { this.nearest[key] = key; queue[tail++] = key; }
    }
    for (let head = 0; head < tail; head++) {
      const key = queue[head]!, col = key % this.fw, row = Math.floor(key / this.fw);
      for (const next of [col > 0 ? key - 1 : -1, col + 1 < this.fw ? key + 1 : -1,
        row > 0 ? key - this.fw : -1, row + 1 < this.fh ? key + this.fw : -1]) {
        if (next < 0 || this.nearest[next] !== -1) continue;
        this.nearest[next] = this.nearest[key]!; queue[tail++] = next;
      }
    }
    const map = this.world.layout.tileMap;
    const voidAt = (key: number): boolean => this.regions.isExterior(
      (key % this.fw) * FIELD_STEP, Math.floor(key / this.fw) * FIELD_STEP);
    // Only the boundary-connected outside is allowed to show remote scenery.
    for (let start = 0; start < this.voidComponent.length; start++) {
      if (!voidAt(start) || this.voidComponent[start] !== -1) continue;
      const component = this.windowRims.length, rim = new Set<number>();
      queue[0] = start; this.voidComponent[start] = component; let length = 1;
      for (let head = 0; head < length; head++) {
        const key = queue[head]!, col = key % this.fw, row = Math.floor(key / this.fw);
        for (const next of [col > 0 ? key - 1 : -1, col + 1 < this.fw ? key + 1 : -1,
          row > 0 ? key - this.fw : -1, row + 1 < this.fh ? key + this.fw : -1]) {
          if (next < 0) continue;
          if (!voidAt(next)) { rim.add(next); continue; }
          if (this.voidComponent[next] !== -1) continue;
          this.voidComponent[next] = component; queue[length++] = next;
        }
      }
      this.windowRims.push([...rim]); this.windowAwareness.push(0);
    }
    for (let row = 0; row < this.ph; row++) for (let col = 0; col < this.pw; col++) {
      const i = row * this.pw + col;
      this.isGround[i] = map.tiles[Math.floor(row * STEP / 32)]?.[Math.floor(col * STEP / 32)] !== TileType.VOID ? 1 : 0;
      this.isAbsence[i] = this.regions.isInterior(col * STEP, row * STEP) ? 1 : 0;
      if (this.isAbsence[i]) this.absenceIndices.push(i);
      this.grain[i] = grain(col, row, this.world.seed);
    }
  }

  private updateField(elapsedMs: number): void {
    if (elapsedMs - this.lastField < 45) return;
    this.lastField = elapsedMs;
    for (let row = 0; row < this.fh; row++) for (let col = 0; col < this.fw; col++) {
      const key = row * this.fw + col;
      this.field[key] = this.world.seaField(col * FIELD_STEP, row * FIELD_STEP, elapsedMs);
      this.samplePoint.x = col * FIELD_STEP; this.samplePoint.y = row * FIELD_STEP;
      this.vision[key] = this.context.visibilityAt(this.samplePoint);
    }
    for (let i = 0; i < this.windowRims.length; i++) {
      this.windowAwareness[i] = this.windowRims[i]!.reduce((max, key) => Math.max(max, this.vision[key]!), 0);
    }
  }

  private windowVisibility(key: number, x: number, y: number): number {
    const component = this.voidComponent[key]!;
    if (component < 0) return 0;
    return this.windowAwareness[component]! * clamp((520 - Math.hypot(x - this.viewerX, y - this.viewerY)) / 170);
  }

  update(elapsedMs: number): void {
    if (this.disposed || elapsedMs - this.lastPaint < 15) return;
    this.lastPaint = elapsedMs; this.updateField(elapsedMs);
    this.flowCycle.sample(elapsedMs, this.flow);
    const viewer = this.context.player.getPosition(); this.viewerX = viewer.x; this.viewerY = viewer.y;
    this.reef.setDepth(this.context.getGroundVisualDepth(this.world.reef.y));
    this.paintSea(elapsedMs); this.paintLowerWorld(elapsedMs); this.paintGroundResponse(elapsedMs);
  }

  private paintSea(elapsedMs: number): void {
    const t = elapsedMs / 1000, data = this.pixels.data, tex = this.waterPixels;
    let floorCount = 0, covered = 0;
    for (let row = 0; row < this.ph; row++) {
      const y = row * STEP, gy = y / FIELD_STEP, iy = Math.floor(gy), fy = gy - iy;
      const drift = Math.sin(y / 112 - t * .15) * 15;
      for (let col = 0; col < this.pw; col++) {
        const i = row * this.pw + col, p = i * 4, x = col * STEP;
        if (this.isAbsence[i]) { data[p + 3] = 0; continue; }
        const gx = x / FIELD_STEP, ix = Math.floor(gx), fx = gx - ix, q = iy * this.fw + ix;
        const a = this.field[q]! * (1 - fx) + this.field[q + 1]! * fx;
        const b = this.field[q + this.fw]! * (1 - fx) + this.field[q + this.fw + 1]! * fx;
        const field = a * (1 - fy) + b * fy;
        if (this.isGround[i]) { floorCount++; if (field > 0) covered++; }
        if (field < -.11) { data[p + 3] = 0; continue; }
        const u = ((Math.floor(x * .69 + drift - t * 5.1) % this.textureW) + this.textureW) % this.textureW;
        const v = ((Math.floor(y * .74 + Math.sin(x / 131 + t * .18) * 13 + t * 2.3) % this.textureH) + this.textureH) % this.textureH;
        const at = (v * this.textureW + u) * 4;
        const rim = clamp(1 - Math.abs(field - .035) * 15);
        const pulse = .76 + .24 * Math.sin(t * .69 + x / 117 + y / 91);
        const ownVision = this.vision[q]! * (1 - fx) * (1 - fy)
          + this.vision[q + 1]! * fx * (1 - fy)
          + this.vision[q + this.fw]! * (1 - fx) * fy
          + this.vision[q + this.fw + 1]! * fx * fy;
        // Outer scenery is established by the visible shoreline; internal
        // absence was excluded before sampling either water or illumination.
        const visible = clamp(this.isGround[i] ? ownVision
          : Math.max(ownVision, this.windowVisibility(q, x, y)));
        const currentA = Math.max(0, 1 - Math.abs(y - (280 + Math.sin(x / 280 - t * .07) * 115)) / 78);
        const currentB = Math.max(0, 1 - Math.abs(y - (605 + Math.sin(x / 370 + t * .05) * 100)) / 105);
        const flow = Math.max(currentA, currentB * .83);
        const light = (.24 + flow * .52) + rim * .43 * pulse;
        const seam = rim * (8 + 9 * this.grain[i]!);
        data[p] = 4 + tex[at]! * light + seam * .50;
        data[p + 1] = 10 + tex[at + 1]! * light + seam * .83;
        data[p + 2] = 13 + tex[at + 2]! * light + seam * .94;
        // Known play-space remains legible through material; the natural holes
        // still exist independently. Never erase the actual tactical fog.
        const density = clamp(field * 7 + .55);
        data[p + 3] = 255 * density * (.88 - visible * (this.isGround[i] ? .59 : .74));
      }
    }
    this.seaCoverage = covered / Math.max(1, floorCount);
    this.ceiling.getContext().putImageData(this.pixels, 0, 0); this.ceiling.refresh();
  }

  private paintLowerWorld(elapsedMs: number): void {
    const t = elapsedMs / 1000, data = this.abyssPixels.data, tex = this.waterPixels;
    // One immense passing presence stays beyond the playable shelf. Its shadow
    // and reflected currents can reach the floor; its body cannot fill a void.
    this.giantX = 650 + Math.sin(t * .045 + .5) * 400;
    const giantY = 435 + Math.sin(t * .025) * 35;
    this.visibleVoidPixels = 0;
    for (let row = 0; row < this.ph; row++) {
      const y = row * STEP;
      for (let col = 0; col < this.pw; col++) {
        const i = row * this.pw + col, p = i * 4;
        if (this.isGround[i] || this.isAbsence[i]) { data[p + 3] = 0; continue; }
        const x = col * STEP, q = Math.floor(y / FIELD_STEP) * this.fw + Math.floor(x / FIELD_STEP);
        const nearest = this.nearest[q]!;
        // The abyss is visible through known rims, not through unexplored
        // ground. No entity or loot is ever painted into this remote surface.
        const gate = this.windowVisibility(q, x, y);
        if (gate <= .015) { data[p + 3] = 0; continue; }
        const u = ((Math.floor(x * .28 + t * 1.7) % this.textureW) + this.textureW) % this.textureW;
        const v = ((Math.floor(y * .31 - t * 1.1) % this.textureH) + this.textureH) % this.textureH;
        const at = (v * this.textureW + u) * 4;
        // Only fragments of this body fit beyond the coastline. Its full span is
        // larger than the playable shelf, never a small complete sea creature.
        const dx = (x - this.giantX) / (this.world.width * .67);
        const axis = giantY + Math.sin(dx * 2.8 + t * .11) * 38 - dx * 62;
        const breadth = Math.max(0, 1 - dx * dx) * (104 + 18 * Math.sin(dx * 6.4 + .9)
          + 11 * Math.sin(dx * 13.7));
        const dy = Math.abs(y - axis);
        const body = clamp((breadth - dy) / 12);
        const core = Math.floor(clamp(1 - dy / Math.max(1, breadth)) * 4) / 4;
        const crest = Math.max(0, 1 - Math.abs(dy - breadth * .45) / 8) * body;
        const ridge = Math.max(0, Math.sin((x - this.giantX) / 36
          + Math.sin((x - this.giantX) / 143) * 1.7 + dy / 29)) > .86 ? 1 : 0;
        const lowerLight = .08 + .03 * Math.sin(x / 177 + y / 139 + t * .13);
        data[p] = (5 + tex[at]! * lowerLight) * (1 - body) + body * (17 + core * 12 + ridge * 8) + crest * 8;
        data[p + 1] = (12 + tex[at + 1]! * lowerLight) * (1 - body) + body * (31 + core * 22 + ridge * 14) + crest * 16;
        data[p + 2] = (18 + tex[at + 2]! * lowerLight) * (1 - body) + body * (34 + core * 21 + ridge * 13) + crest * 16;
        // A broken lip and a lower rim establish depth without a vertical
        // curtain pasted below a strict overhead shoreline.
        const nx = (nearest % this.fw) * FIELD_STEP, ny = Math.floor(nearest / this.fw) * FIELD_STEP;
        const distance = Math.hypot(x - nx, y - ny);
        const lipWidth = 10 + grain(Math.floor(x / 9), Math.floor(y / 11), this.world.seed) * 9;
        const rim = clamp(1 - distance / lipWidth);
        const fracture = this.grain[i]! > .55 ? 1 : .62;
        // This mineral lip belongs only to the OUTER shore.
        data[p] = data[p]! * (1 - rim) + rim * 61 * fracture;
        data[p + 1] = data[p + 1]! * (1 - rim) + rim * 65 * fracture;
        data[p + 2] = data[p + 2]! * (1 - rim) + rim * 59 * fracture;
        data[p + 3] = gate * 245;
        this.visibleVoidPixels++;
      }
    }
    this.abyss.getContext().putImageData(this.abyssPixels, 0, 0); this.abyss.refresh();
  }

  private paintGroundResponse(elapsedMs: number): void {
    const ctx = this.light.getContext(), t = elapsedMs / 1000, water = this.world.water;
    ctx.setTransform(1, 0, 0, 1, 0, 0); ctx.clearRect(0, 0, this.pw, this.ph);
    ctx.imageSmoothingEnabled = false; ctx.scale(1 / STEP, 1 / STEP);
    // The same remote presence changes pressure and light across the floor.
    for (let strand = 0; strand < 105; strand++) {
      const baseX = grain(strand, 27, this.world.seed) * this.world.width;
      const baseY = grain(strand, 31, this.world.seed) * this.world.height;
      const proximity = Math.max(0, 1 - Math.abs(baseX - this.giantX) / 330);
      const x = Math.floor((baseX + Math.sin(t * .37 + strand) * (5 + proximity * 8)) / 2) * 2;
      const y = Math.floor((baseY + Math.sin(strand * 1.7 + t * .3) * 4) / 2) * 2;
      if (!this.world.isFloor(x, y)) continue;
      ctx.fillStyle = `rgba(95,140,139,${.04 + proximity * .22})`;
      ctx.fillRect(x, y, 10 + strand % 17, 2);
      ctx.fillStyle = `rgba(152,143,116,${.09 + proximity * .27})`;
      ctx.fillRect(x + 8, y + 4, 3, 2);
    }
    const polygon = this.world.waterOutline;
    const path = () => { ctx.beginPath(); polygon.forEach((p, i) => i ? ctx.lineTo(p.x, p.y) : ctx.moveTo(p.x, p.y)); ctx.closePath(); };
    const impact = water.active ? 1 : this.flow.residue * .4;
    path(); ctx.fillStyle = `rgba(0,13,18,${.12 + this.flow.swell * .3 + impact * .13})`; ctx.fill();
    if (water.phase !== 'quiet') {
      // The overhead column is read by converging streams, changing cross
      // section and an irregular impact, not by a side-view long waterfall.
      ctx.save(); path(); ctx.clip();
      ctx.fillStyle = `rgba(22,58,65,${impact * .46 + this.flow.swell * .10})`;
      ctx.fillRect(this.world.waterDefinition.x - 90, this.world.waterDefinition.y - 60, 180, 120);
      for (let i = 0; i < 47; i++) {
        const x = this.world.waterDefinition.x - 90 + grain(i, 37, this.world.seed) * 180;
        const y = this.world.waterDefinition.y - 60 + ((grain(i, 21, this.world.seed) * 120 + t * (17 + i % 11)) % 120);
        const speed = Math.max(impact, this.flow.sourceFeed * .55);
        ctx.fillStyle = `rgba(128,175,173,${speed * (.15 + grain(i, 19, this.world.seed) * .3)})`;
        ctx.fillRect(Math.floor(x / 2) * 2, Math.floor(y / 2) * 2, 4 + i % 7, 2);
        if (i % 3 === 0) ctx.fillRect(Math.floor(x / 2) * 2 + 4, Math.floor(y / 2) * 2 + 2, 4, 2);
      }
      ctx.restore();
    }
    this.light.refresh();
  }

  snapshot(): Record<string, unknown> {
    const leakedPixels = this.absenceIndices.reduce((sum, i) => sum
      + (this.pixels.data[i * 4 + 3]! > 0 || this.abyssPixels.data[i * 4 + 3]! > 0 ? 1 : 0), 0);
    return { mode: 'vista', seaFloorCoverage: this.seaCoverage, visibleVoidPixels: this.visibleVoidPixels,
      visibleExteriorPixels: this.visibleVoidPixels, interiorVoidPixelsRevealed: leakedPixels,
      interiorAbsencePixels: this.absenceIndices.length,
      giantX: this.giantX, naturalOpeningCount: this.world.openings.length,
      layers: ['known-ground', 'exterior-vista', 'upper-sea', 'independent-natural-openings', 'opaque-internal-absence'],
      fallingWater: { ...this.flow },
      waterFootprint: 'shared-deforming-polygon', renderStep: STEP };
  }

  destroy(): void {
    if (this.disposed) return; this.disposed = true;
    for (const image of this.images) image.destroy();
    for (const key of this.keys) if (this.context.scene.textures.exists(key)) this.context.scene.textures.remove(key);
  }
}
