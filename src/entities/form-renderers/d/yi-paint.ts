/**
 * 方案 D 乙漆：钉在墙-地缝上的 1–3px 墙皮，核跟宿主走。
 * 不写 seamSlidePx，不把核画进墙格中央，不加碰撞。
 */
import type Phaser from 'phaser';
import { GAME_CONSTANTS } from '@/config/constants';
import type { FormVisualPose } from '@/entities/form-renderers/form-renderer';
import { faceNormal, yiPeriodMs, type YiRecipe } from '@/entities/form-renderers/d/yi-recipe';

const TILE = GAME_CONSTANTS.TILE_SIZE;

export interface StrikeFloor {
  readonly col: number;
  readonly row: number;
}

function local(nx: number, ny: number, alongNormal: number, alongTangent: number): { x: number; y: number } {
  return {
    x: nx * alongNormal - ny * alongTangent,
    y: ny * alongNormal + nx * alongTangent,
  };
}

function dot(g: Phaser.GameObjects.Graphics, x: number, y: number, hex: number): void {
  g.fillStyle(hex, 1);
  g.fillRect(x, y, 1, 1);
}

/** Local wall sculpture. Tangent is the seam; normal points into reachable floor. */
export function paintYiSkin(
  g: Phaser.GameObjects.Graphics, recipe: YiRecipe, pose: FormVisualPose,
  elapsedMs: number, nx: number, ny: number, recoilAmount = 0,
): void {
  g.clear();
  const stage = recipe.coverage === 'infiltrate' ? 0 : recipe.coverage === 'rewrite' ? 1 : 2;
  const activity = pose.activity?.phase === 'rest' ? 0 : pose.activity?.phase === 'waking' ? pose.activity.progress : 1;
  const phase = pose.attack?.phase ?? (pose.signal === 'strike' ? 'strike' : 'idle');
  const wind = phase === 'windup' ? pose.attack?.progress ?? 0 : 0;
  const actualHit = phase === 'strike' ? 1 : phase === 'recover' ? 1-(pose.attack?.progress ?? 0) : 0;
  const hit = Math.max(actualHit,Math.max(0,Math.min(1,recoilAmount)));
  const breath = Math.sin(elapsedMs / yiPeriodMs(recipe.rhythm) * Math.PI * 2);
  const inks = [0x202b29,0x394a43,0x596e5e,0x889481];
  // Project the visible wall-facing skin onto the adjacent floor pixels.
  // Fog/occlusion still owns the wall; physics and the hittable seam do not move.
  let surfaceProjection=10;
  const dab = (t: number,n: number,ink: number,size=1): void => {
    for(let a=0;a<size;a++) for(let b=0;b<size;b++) {
      const p=local(nx,ny,n+a+surfaceProjection,t+b); dot(g,p.x,p.y,ink);
    }
  };
  if(recipe.family === 'doorframe') {
    // Two scarred jambs remain legible at low coverage. Deeper stages multiply
    // interleaved shutters inside the opening rather than growing a standing box.
    const gap = Math.round(3 + activity*3 + breath*.6 - wind*3 - hit*5);
    for(let side=-1;side<=1;side+=2) {
      for(let t=8;t<=13;t++) for(let n=-9;n<=3;n++) {
        if((t===13&&n<-6)||(t===12&&n===-9)) continue;
        const edge=n===3||t===13;
        const joint=(n+12)%5===0&&t<12;
        dab(t*side,n,joint?inks[0]!:edge?inks[1]!:n<-6?0x71766a:0x50594e);
      }
      for(let n=-7;n<=5+Math.round(hit*7);n++) {
        const tooth = Math.floor((n+7)/3)%2;
        const start = Math.max(0,gap + (stage>0?tooth*2:0));
        for(let t=start;t<9;t++) {
          const fold=(t+Math.floor((n+7)/3)+stage)%5;
          dab(t*side,n,fold===0?inks[0]!:fold===1?inks[2]!:inks[1]!);
        }
        if(n%4===0) dab((start+1)*side,n,activity>.4?0x498a72:inks[1]!);
      }
    }
    for(let t=-12;t<=12;t++) {
      if(stage===2&&t%7>3) continue;
      dab(t,-9,0x727d6b); dab(t,-8,inks[1]!);
    }
    if(stage>0) for(let k=0;k<stage+1;k++) {
      const t=-7+k*6, bend=Math.round(breath*activity);
      for(let n=-6;n<=2;n++) dab(t+Math.floor((n+6)/3)+bend,n,inks[2]!);
    }
  } else {
    // Mineral lamellae lift off the wall in overlapping shelves; their hinges
    // remain attached to the seam, and open toward the actual attack side.
    const count=4+stage*2;
    for(let k=0;k<count;k++) {
      const t0=-12+k*24/Math.max(1,count-1), rise=(k%2)*2;
      const reach=3+stage+Math.round(activity*(1+breath*.6)+hit*8-wind*2);
      for(let n=-8+rise;n<=reach;n++) {
        const width=3+Math.floor((n+8-rise)/4);
        for(let t=-width;t<=width;t++) {
          if(Math.abs(t)===width&&(n+k)%3===0) continue;
          const rim=n===-8+rise||t===-width;
          const fold=(n+k*2)%5===0;
          dab(Math.round(t0+t),n,fold?inks[0]!:rim?(stage===0?0x8b8068:inks[3]!):n>reach-2?inks[1]!:stage===0?0x665a47:inks[2]!);
        }
      }
      if(activity>.3) for(let n=0;n<reach;n++) if(n%4<2) dab(Math.round(t0),n,0x498a72);
    }
  }
  if(recipe.continuity==='shards') { dab(-7,-2,0x182220,2); dab(8,-4,0x182220,2); }
  surfaceProjection=0;
  // Hittable core is always on the reachable seam, never buried in wall art.
  const coreInk = phase==='strike'||wind>.65 ? 0x93d7b8 : activity>.25?0x47ac8d:0x486b59;
  for(let t=-2;t<=2;t++) for(let n=0;n<3;n++) dab(t,n,Math.abs(t)===2?0x192e29:coreInk);
}

/** 抽打格地心 1px 量化青点。钉地板，不钉墙格心，不加全息圈。 */
export function paintYiStrikeFloors(
  g: Phaser.GameObjects.Graphics,
  floors: readonly StrikeFloor[],
  hex: number,
  pose?: FormVisualPose,
): void {
  g.clear();
  const striking = pose?.attack?.phase === 'strike' || (!pose?.attack && pose?.signal === 'strike');
  const progress = striking ? 1 : pose?.attack?.progress ?? 0;
  const { nx, ny } = faceNormal(pose?.facing4 ?? 'down');
  g.fillStyle(hex, striking ? .9 : .25 + progress * .45);
  for (const cell of floors) {
    // Scrapes grow out of the wall-facing edge of the actual dangerous cell.
    // Their lengths follow the damage clock, not a decorative breathing loop.
    const cx = cell.col * TILE + TILE / 2, cy = cell.row * TILE + TILE / 2;
    for (const lane of [-1, 0, 1]) {
      const length = Math.round(4 + progress * (lane === 0 ? 22 : 16));
      for (let d = 0; d < length; d++) {
        const bend = lane * (4 + Math.floor(d / 6));
        const x = cx + nx * (d - 13) - ny * bend;
        const y = cy + ny * (d - 13) + nx * bend;
        if (x < cell.col*TILE+1 || x >= (cell.col+1)*TILE-1 || y < cell.row*TILE+1 || y >= (cell.row+1)*TILE-1) continue;
        g.fillRect(Math.round(x), Math.round(y), striking ? 2 : 1, striking ? 2 : 1);
      }
    }
  }
}

export function strikeFloorsFromPose(pose: FormVisualPose): StrikeFloor[] {
  const { nx, ny } = faceNormal(pose.facing4);
  const fx = pose.x + nx * (TILE / 2);
  const fy = pose.y + ny * (TILE / 2);
  return [{ col: Math.floor(fx / TILE), row: Math.floor(fy / TILE) }];
}
