/** R3 production surface contract. No obsolete requirement that ash be a hollow ring.
 * Structural distinctions are measured against occupied area, not mostly-empty canvas.
 * These checks catch lost geometry/animation/footprints; they do not certify aesthetics.
 */
import assert from 'node:assert/strict';
import { bakePaintGenome,collectPaintGenomeFloorTiles,occupancyMaskOf } from '../../src/entities/form-renderers/d/paint-genome/bake';
import { paintSurfaceMaterial } from '../../src/entities/form-renderers/d/paint-genome/material';
import { PAINT_BREATH,paintPaintGenomeLive } from '../../src/entities/form-renderers/d/paint-genome/live';
import { resolvePaintVeinVariant,oilFilmProductionVeinVariant } from '../../src/entities/form-renderers/d/paint-genome/topology';
import type { CoverageId,ContinuityId } from '../../src/generated/contamination-lexicon-data';
const tiers:CoverageId[]=['infiltrate','rewrite','overwrite'];
const families=['fungal_mat','oil_film','ash_veil'];
const seeds=Array.from({length:8},(_,i)=>1000+i*977);
type Bake=ReturnType<typeof bakePaintGenome>;
function bake(substrate:string,coverage:CoverageId,seed:number,continuity:ContinuityId='colony',variant?:3|4|5):Bake {
 return bakePaintGenome({substrate,coverage,seed,continuity,sense:'sense_touch',rhythm:'rhythm_open',veinVariant:resolvePaintVeinVariant(substrate,seed,variant)});
}
function shapeDifference(a:Uint8Array,b:Uint8Array):number {
 let changed=0,occupied=0;for(let i=0;i<a.length;i++){if(a[i]||b[i])occupied++;if(a[i]!==b[i])changed++;}return changed/Math.max(1,occupied);
}
function pixelDifference(a:Uint8ClampedArray,b:Uint8ClampedArray):number {
 let changed=0;for(let i=0;i<a.length;i+=4)if(a[i]!==b[i]||a[i+1]!==b[i+1]||a[i+2]!==b[i+2]||a[i+3]!==b[i+3])changed++;return changed;
}
function live(row:Bake,substrate:string,coverage:CoverageId,seed:number,time:number){
 const scratch=new Float32Array(row.field.length),pixels=new Uint8ClampedArray(row.buf.data.length);
 paintPaintGenomeLive({rest:row.field,scratch,out:pixels,w:row.canvasW,h:row.canvasH,elapsedMs:time,inflated:true,ramp:row.ramp,growth:row.growth});
 paintSurfaceMaterial(pixels,scratch,row.canvasW,row.canvasH,substrate,coverage,seed,time);
 return {scratch,pixels};
}
let combinations=0,minTierChange=1,minFamilyChange=1,minVariantChange=1,minMotion=Infinity;
for(const family of families)for(const seed of seeds)for(const continuity of ['colony','field'] as const){
 const rows=tiers.map(tier=>bake(family,tier,seed,continuity));
 for(let t=0;t<tiers.length;t++){
  combinations++;const row=rows[t]!,tier=tiers[t]!;
  assert.deepEqual(row.buf.data,bake(family,tier,seed,continuity).buf.data,'same generated enemy must reproduce');
  const mask=occupancyMaskOf(row.buf),mass=mask.reduce((a,b)=>a+b,0);
  assert(mass>30,`${family}/${tier} has a substantial body`);
  const colors=new Set<string>();
  for(let y=0;y<row.canvasH;y++)for(let x=0;x<row.canvasW;x++){
   const i=y*row.canvasW+x,alpha=row.buf.data[i*4+3]!;
   if(!alpha)continue;
   assert(x>0&&y>0&&x<row.canvasW-1&&y<row.canvasH-1,'native body does not clip canvas');
   assert(row.field[i]!>=.1,'no visible invented core or surface outside the registered field');
   assert.equal(alpha,255,'material pixels have hard opacity; scene fog supplies visibility');
   colors.add(`${row.buf.data[i*4]},${row.buf.data[i*4+1]},${row.buf.data[i*4+2]}`);
  }
  assert(colors.size>=3&&colors.size<=12,'bounded material ramp; no smooth normal-shaded gradient');
  // Independently translate occupied pixel centres to world tiles. Tests both
  // sub-tile placement and negative origins; no centre-tile fallback allowed.
  for(const [ox,oy]of [[80,80],[83.25,67.75],[-17,11]]){
   const expected=new Set<string>();
   for(let y=0;y<row.canvasH;y++)for(let x=0;x<row.canvasW;x++)if(row.field[y*row.canvasW+x]!>=.1)
    expected.add(`${Math.floor((ox!-row.canvasW/2+x+.5)/32)},${Math.floor((oy!-row.canvasH/2+y+.5)/32)}`);
   const actual=collectPaintGenomeFloorTiles(row.field,row.canvasW,row.canvasH,ox!,oy!,32);
   assert.deepEqual(new Set(actual.map(p=>`${p.col},${p.row}`)),expected,'danger surface uses the actual transformed footprint');
   assert.equal(actual.length,expected.size,'no duplicate billing tiles');
  }
  assert.deepEqual(live(row,family,tier,seed,0).pixels,row.buf.data,'first live paint has no static-to-live texture pop');
  const peak=live(row,family,tier,seed,Math.PI/(2*PAINT_BREATH));
  const trough=live(row,family,tier,seed,3*Math.PI/(2*PAINT_BREATH));
  const changed=pixelDifference(peak.pixels,trough.pixels);minMotion=Math.min(minMotion,changed);
  assert(changed>=12,`${family} has visible material/shape motion across the cycle`);
  assert(!Buffer.from(peak.scratch.buffer).equals(Buffer.from(trough.scratch.buffer)),`${family} deforms geometry, not merely colour`);
 }
 for(let a=0;a<3;a++)for(let b=a+1;b<3;b++){
  const delta=shapeDifference(occupancyMaskOf(rows[a]!.buf),occupancyMaskOf(rows[b]!.buf));minTierChange=Math.min(minTierChange,delta);
  assert(delta>.06,`${family} coverage ${a}/${b} must change occupied structure, not only RGB`);
 }
}
for(const seed of seeds)for(const tier of tiers){
 const rows=families.map(f=>bake(f,tier,seed));
 for(let a=0;a<3;a++)for(let b=a+1;b<3;b++){
  const delta=shapeDifference(occupancyMaskOf(rows[a]!.buf),occupancyMaskOf(rows[b]!.buf));minFamilyChange=Math.min(minFamilyChange,delta);
  assert(delta>.2,'families retain separate footprint anatomy');
 }
 const variants=([3,4,5]as const).map(v=>bake('oil_film',tier,seed,'colony',v));
 for(let a=0;a<3;a++)for(let b=a+1;b<3;b++){
  const delta=shapeDifference(occupancyMaskOf(variants[a]!.buf),occupancyMaskOf(variants[b]!.buf));minVariantChange=Math.min(minVariantChange,delta);
  assert(delta>.2,'beads, smear and rim-pool remain distinct bodies');
 }
}
const samples=new Set(Array.from({length:96},(_,seed)=>oilFilmProductionVeinVariant(seed)));
assert.deepEqual([...samples].sort(),[3,4,5]);
assert.equal(resolvePaintVeinVariant('fungal_mat',7),undefined);assert.equal(resolvePaintVeinVariant('ash_veil',7),undefined);
assert.equal(resolvePaintVeinVariant('oil_film',7,4),4,'explicit inspector variant must override seed');
assert.deepEqual(collectPaintGenomeFloorTiles(new Float32Array(88*88),88,88,80,80,32),[],'empty visible field cannot regain legacy 3x3 hazard');
console.log(JSON.stringify({combinations,minTierChange,minFamilyChange,minVariantChange,minMotion,footprintOrigins:3,productionVariants:[...samples].sort()}));
console.log('check:paint-genome-topology OK (R3 production surface contract)');
