/** Shared, world-space maintenance works. No inventory identity or game mutation.
 * Ground is recessed and walkable; device additions retain their existing feet.
 * Palette, structure and state contract: docs/art/purification-renewal.md.
 */
import type Phaser from 'phaser';
import type { BoundaryShape } from '@/systems/boundary-shape';
import {
  PURIFICATION_DEVICE_ANCHORS as ANCHORS,
  type PurificationDeviceAnchors,
} from '@/systems/purification-collision';

export const PURIFICATION_WORKS_COLORS = {
  void: 0x080a0c, recess: 0x151a1e, shadow: 0x1e2228,
  concrete: 0x2c2e33, repair: 0x3a3d42, metal: 0x4a4e55,
  edge: 0x5a5f66, medium: 0x1a6b5c, deep: 0x0e4a3f,
} as const;

type Point = readonly [number, number];

/** Hard pixel scan fill; no Canvas stroke/antialias, all final pixels in palette. */
export function paintPurificationWorks(
  image: ImageData,
  shape: BoundaryShape,
  anchors: PurificationDeviceAnchors = ANCHORS,
): void {
  const { width, height, data } = image;
  const C = PURIFICATION_WORKS_COLORS;
  const origin = anchors.core;
  const pixel = (x: number, y: number, color: number): void => {
    if (x < 0 || y < 0 || x >= width || y >= height) return;
    const distance = shape.normalizedDist(x, y);
    if (distance > .91) return;
    // Embedded works disappear into the existing membrane, never extend it.
    if (distance > .83) color = color === C.recess ? C.recess : C.concrete;
    const i = (y * width + x) * 4;
    data[i] = color >> 16; data[i + 1] = (color >> 8) & 255;
    data[i + 2] = color & 255; data[i + 3] = 255;
  };
  const poly = (points: readonly Point[], color: number): void => {
    const pts = points.map(([x, y]) => [Math.round(origin.x + x), Math.round(origin.y + y)] as const);
    const minY = Math.min(...pts.map(p => p[1])), maxY = Math.max(...pts.map(p => p[1]));
    for (let y = minY; y < maxY; y++) {
      const xs: number[] = [];
      for (let i = 0; i < pts.length; i++) {
        const a = pts[i]!, b = pts[(i + 1) % pts.length]!;
        if ((a[1] > y + .5) === (b[1] > y + .5)) continue;
        xs.push(a[0] + (y + .5 - a[1]) * (b[0] - a[0]) / (b[1] - a[1]));
      }
      xs.sort((a, b) => a - b);
      for (let i = 0; i + 1 < xs.length; i += 2) {
        for (let x = Math.ceil(xs[i]!); x < xs[i + 1]!; x++) pixel(x, y, color);
      }
    }
  };
  const rect = (x: number, y: number, w: number, h: number, color: number): void =>
    poly([[x,y],[x+w,y],[x+w,y+h],[x,y+h]], color);

  // Three construction campaigns, deliberately unequal in width and direction.
  // The central work seat and south filter share one broad, off-axis foundation.
  poly([[-42,-20],[26,-25],[49,-9],[48,24],[12,29],[-39,20]], C.repair);
  poly([[20,-14],[43,-12],[47,59],[37,100],[36,125],[-29,127],[-34,115],[-22,97],[20,95]], C.repair);
  poly([[24,-17],[25,-52],[12,-64],[17,-101],[18,-120],[31,-128],[42,-121],[38,-106],[36,-62],[45,-47],[44,-10]], C.concrete);
  // West work bay: old slab with a broad replacement end, not a radial spoke.
  poly([[-132,-10],[-112,-25],[-83,-16],[-78,8],[-38,6],[-38,20],[-91,27],[-130,14]], C.repair);
  poly([[-120,18],[-87,19],[-82,60],[-74,81],[-91,93],[-119,88],[-124,66]], C.concrete);
  // East receiving apron leaves the vessel's front wall as the primary block.
  poly([[48,-4],[91,-11],[128,-7],[133,11],[112,24],[81,19],[48,12]], C.repair);

  // Lower cut faces are short interrupted sections, never a dark outline.
  poly([[-38,20],[12,29],[45,24],[43,28],[12,33],[-36,23]], C.shadow);
  poly([[-29,127],[36,125],[32,128],[-24,131]], C.shadow);
  poly([[-130,14],[-91,27],[-66,24],[-66,27],[-92,31],[-128,18]], C.shadow);
  poly([[81,19],[112,24],[130,13],[128,17],[111,28],[83,23]], C.concrete);

  // Skimmed concrete is laid in courses. Large, unequal planes break up the
  // fresh slabs; these are construction joints, not higher grain density.
  poly([[-38,-16],[-9,-17],[-10,3],[-37,8]], C.concrete);
  poly([[5,-20],[24,-21],[41,-9],[27,-5],[4,-8]], C.concrete);
  poly([[-27,10],[-2,12],[2,24],[-25,18]], C.concrete);
  poly([[14,14],[42,8],[43,21],[14,25]], C.concrete);
  poly([[22,28],[43,27],[43,59],[36,70],[23,65]], C.concrete);
  poly([[22,75],[36,80],[32,103],[20,102]], C.concrete);
  poly([[-28,111],[-15,100],[14,101],[22,109],[-2,123],[-27,123]], C.concrete);
  poly([[-127,-7],[-113,-20],[-95,-17],[-105,4],[-126,7]], C.concrete);
  poly([[-100,8],[-83,5],[-81,13],[-49,12],[-49,17],[-92,23]], C.concrete);
  poly([[57,0],[90,-7],[107,-5],[104,8],[80,15],[58,10]], C.concrete);
  poly([[114,-4],[127,-3],[129,9],[116,17],[110,15]], C.concrete);
  // Exposed strips along a few joints are long enough to read as cut material.
  rect(-23,-16,13,1,C.metal); rect(4,-10,15,1,C.metal);
  rect(-125,8,12,1,C.metal); rect(61,10,16,1,C.metal);
  rect(21,69,13,2,C.shadow); rect(23,73,10,1,C.metal);
  poly([[31,-128],[41,-121],[37,-119],[28,-123]], C.metal);

  // An open inspection cut, partly covered by reclaimed metal. Wide shaded
  // recesses plus lids read as material construction, not drawn circuit wires.
  poly([[26,-119],[30,-123],[34,-118],[31,-99],[29,-78],[27,-64],[36,-48],[37,12],[33,42],[37,67],[30,104],[22,107],[27,66],[23,41],[27,12],[27,-47],[21,-64],[24,-101]], C.recess);
  poly([[28,-118],[30,-117],[27,-78],[25,-64],[33,-47],[33,12],[29,41],[33,66],[27,102],[24,103],[29,66],[26,41],[29,12],[29,-46],[23,-64]], C.shadow);
  // Filter outlet is open toward the same buried channel and northern wound.
  poly([[-11,109],[23,105],[29,110],[21,116],[-12,118]], C.shadow);
  poly([[-9,109],[22,107],[25,109],[-10,114]], C.metal);
  // Core bearing cheeks join the channel; broad planes anchor the locked frame.
  poly([[-26,-3],[-16,-9],[-9,-5],[-11,9],[-26,7]], C.concrete);
  poly([[11,-4],[21,-9],[32,-4],[29,10],[14,13]], C.concrete);
  poly([[-25,-3],[-17,-7],[-12,-4],[-15,-1]], C.metal);
  poly([[14,-3],[23,-7],[29,-4],[22,0]], C.metal);
  // Covers occur where someone needed a crossing, not at regular intervals.
  for (const [x,y,w,h] of [[22,-80,15,14],[24,-27,16,16],[23,30,16,21],[25,77,14,12]] as const) {
    rect(x,y,w,h,C.concrete); rect(x,y,w,2,C.metal);
    rect(x+2,y+3,w-4,h-5,C.repair); rect(x+3,y+h-2,w-5,1,C.shadow);
    rect(x+2,y+5,w-5,2,C.concrete);
    rect(x+w-5,y+3,2,h-6,C.metal);
  }
  // Two tied-in west pipes sink into the existing work slab at either end.
  poly([[-106,9],[-69,13],[-62,8],[-32,9],[-30,12],[-60,12],[-69,17],[-106,13]], C.shadow);
  poly([[-103,9],[-69,13],[-61,8],[-34,9],[-35,10],[-61,10],[-69,15],[-104,11]], C.metal);
  rect(-79,10,7,8,C.concrete); rect(-78,10,5,2,C.repair);
  // The exposed offering seat remains quiet: transverse anchoring slots only.
  rect(-107,76,22,4,C.shadow); rect(-108,74,9,2,C.metal); rect(-92,74,8,2,C.metal);
  // Vessel front lip is one mass, never little inventory-coloured fragments.
  poly([[97,5],[114,10],[127,3],[127,7],[114,15],[97,10]], C.concrete);
  poly([[97,5],[114,10],[127,3],[126,5],[114,12],[98,7]], C.metal);

  // Mismatched patches bridge joins. Quiet blank centres make their edges read.
  poly([[-17,16],[-2,17],[4,22],[-14,23]], C.concrete);
  poly([[1,18],[7,19],[10,24],[5,25]], C.metal);
  poly([[-100,-15],[-89,-12],[-89,-6],[-99,-8]], C.concrete);
  // One east apron shoe meets the near membrane; north is the shared duct's
  // physical terminal. No unconnected decorative posts around the perimeter.
  for (const angle of [.12]) {
    const r = shape.radiusAt(angle);
    const endX = Math.round(shape.centerX + Math.cos(angle)*r*.87 - origin.x);
    const endY = Math.round(shape.centerY + Math.sin(angle)*r*.87 - origin.y);
    const startX = endX-Math.round(Math.cos(angle)*19), startY = endY-Math.round(Math.sin(angle)*19);
    const nx = Math.round(-Math.sin(angle)*4), ny = Math.round(Math.cos(angle)*4);
    poly([[startX-nx,startY-ny],[endX-nx,endY-ny],[endX+nx,endY+ny],[startX+nx,startY+ny]],C.concrete);
    rect(startX-3,startY-2,8,3,C.repair);
  }
}

export interface PurificationRenewalState {
  /** Public hp/maxHp fractions. This layer does not calculate any effect. */
  moduleHealth: Readonly<{ core: number; purifier: number; storage: number }>;
  thickenLevel: number;
}

/** Sparse state on existing seams, plus permanent bearing plates at the feet. */
export class PurificationRenewalVisual {
  private readonly ground: Phaser.GameObjects.Graphics;
  private readonly storageFace: Phaser.GameObjects.Graphics;
  private signature = '';
  constructor(scene: Phaser.Scene, private readonly anchors: PurificationDeviceAnchors = ANCHORS) {
    this.ground = scene.add.graphics().setDepth(.8);
    const storage = anchors.storage;
    this.storageFace = scene.add.graphics({ x: storage.x, y: storage.y }).setDepth(20.08);
  }

  setState(state: PurificationRenewalState): void {
    this.storageFace.setAlpha(.45 + .5*Math.max(0,Math.min(1,state.moduleHealth.storage)));
    const levels = Math.max(0, Math.min(3, Math.floor(state.thickenLevel)));
    const bucket = (health: number): number => health <= 0 ? 0 : health < .3 ? 1 : health <= .6 ? 2 : 3;
    const signature = `${levels}:${bucket(state.moduleHealth.core)}:${bucket(state.moduleHealth.purifier)}:${bucket(state.moduleHealth.storage)}`;
    if (signature === this.signature) return;
    this.signature = signature;
    const g = this.ground, C = PURIFICATION_WORKS_COLORS;
    g.clear();
    // Consolidate only the existing vessel opening and wall: the old mixed
    // contents stay anonymous and the original outside silhouette is retained.
    const face = this.storageFace;
    face.clear();
    face.fillStyle(C.shadow).fillRect(-4,-20,7,3).fillRect(-2,-17,6,1);
    face.fillStyle(C.concrete).fillRect(-7,-12,5,7).fillRect(-5,-5,3,2);
    face.fillStyle(C.repair).fillRect(-7,-13,5,1).fillRect(-2,-11,1,7);
    for (const id of ['core','purifier','storage'] as const) {
      const p = this.anchors[id], health = bucket(state.moduleHealth[id]);
      // Additions stay underneath each physical bearing, readable after reload.
      for (let tier = 0; tier < levels; tier++) {
        const y = p.y + 4 + tier*3, width = 27 + tier*6;
        const left = p.x-Math.floor(width/2);
        g.fillStyle(C.concrete).fillRect(left,y,width,3);
        g.fillStyle(C.metal).fillRect(left,y,width-4,1);
        g.fillStyle(C.shadow).fillRect(left+width-4,y+1,4,2);
      }
      // No light at zero, only medium/deep colour recessed beside the bearing.
      if (health > 0) {
        g.fillStyle(C.deep).fillRect(p.x+15,p.y+1,3,4);
        if (health === 3) g.fillStyle(C.medium).fillRect(p.x+16,p.y+2,1,2);
      }
      if (health < 2) {
        g.fillStyle(C.recess).fillRect(p.x-13,p.y+5,8,1).fillRect(p.x-7,p.y+6,6,1);
      }
    }
  }

  /** Called with the existing storage entity's ground-sort depth. */
  setStorageDepth(depth: number): void { this.storageFace.setDepth(depth + .08); }

  destroy(): void { this.ground.destroy(); this.storageFace.destroy(); }
}
