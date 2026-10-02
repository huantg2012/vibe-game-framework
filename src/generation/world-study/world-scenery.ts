/** World-process landmarks: low relief, seated on the same support as the player. */
import type { LandmarkDef } from '@/types/map-types';
import { mix32 } from '@/generation/seed-fork';
import { materialHash } from './material-noise';
import type { WorldSample, WorldScenery } from './types';
import type { ResolvedWorldConditions } from './world-conditions';

type Point = readonly [number, number];

export function attachWorldScenery(sample: WorldSample, conditions: ResolvedWorldConditions,
  landmarks: readonly LandmarkDef[], tileSize: number): WorldSample {
  const scenery = landmarks.map((landmark, i): WorldScenery => {
    const x = (landmark.col + .5) * tileSize, y = (landmark.row + .5) * tileSize;
    const cell = Math.min(sample.land.length - 1, Math.floor(y / sample.tileSize) * sample.cols + Math.floor(x / sample.tileSize));
    return { id: landmark.id, x, y, angle: sample.flowAngle[cell] ?? 0,
      radius: conditions.scenery.radiusPx * (i === 0 ? 1 : .94),
      kind: conditions.scenery.kind, density: conditions.scenery.density,
      seed: mix32(conditions.streams.material, `landmark:${landmark.id}`), motion: conditions.scenery.motion };
  });
  return { ...sample, scenery };
}

/** The large landmark owns a quiet surround instead of fighting ordinary scatter. */
export function sceneryQuietAt(sample: WorldSample, x: number, y: number): number {
  let quiet = 0;
  for (const seat of sample.scenery ?? []) {
    const d = Math.hypot(x - seat.x, y - seat.y) / seat.radius;
    quiet = Math.max(quiet, Math.max(0, 1 - Math.max(0, d - .65) / .65));
  }
  return quiet;
}

function local(seat: WorldScenery, x: number, y: number): Point {
  const nx = Math.cos(seat.angle), ny = Math.sin(seat.angle);
  return [seat.x + (x * nx - y * ny) * seat.radius, seat.y + (x * ny + y * nx) * seat.radius];
}

/** Reflected grains/lamellae only. The native surface applies support and LOS. */
export function paintSceneryMotion(ctx: CanvasRenderingContext2D, sample: WorldSample,
  timeSeconds: number, playerX: number, playerY: number): void {
  const alpha=ctx.globalAlpha, color=sample.profile.palette.materialLight;
  ctx.fillStyle=`#${color.toString(16).padStart(6,'0')}`;
  for (const seat of sample.scenery ?? []) {
    if (Math.hypot(seat.x-playerX,seat.y-playerY)>260+seat.radius) continue;
    const phase=timeSeconds/seat.motion.periodSeconds+materialHash(1,1,seat.seed);
    const count=Math.round(11*seat.density);
    for(let i=0;i<count;i++) {
      const offset=materialHash(i,7,seat.seed), t=(phase+offset)%1;
      const a=materialHash(i,11,seat.seed)*Math.PI*2;
      const radius=.35+materialHash(i,19,seat.seed)*.42;
      const base=local(seat,Math.cos(a)*radius,Math.sin(a)*radius*.62);
      const travel=seat.motion.amplitude*(seat.motion.kind==='settle'?t*3:Math.sin(t*Math.PI*2));
      const x=base[0]+Math.cos(seat.angle)*travel, y=base[1]+Math.sin(seat.angle)*travel;
      const distance=Math.hypot(playerX-x,playerY-y);
      if(distance>250) continue;
      ctx.globalAlpha=alpha*.24*Math.sin(Math.PI*t)**2*(1-distance/260);
      ctx.fillRect(Math.round(x),Math.round(y),i%4===0?3:2,1);
    }
  }
  ctx.globalAlpha=alpha;
}
