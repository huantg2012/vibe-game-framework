/** Baked native surfaces, not screenshots of actual fogged gameplay. */
import assert from 'node:assert/strict';
import { mkdirSync, writeFileSync } from 'node:fs';
import sharp from 'sharp';
import { WORLD_PROFILES } from '../../src/generation/world-study/profiles';
import { SPACE_PROFILES } from '../../src/generation/world-study/space-profile';
import { compileWorldConditions } from '../../src/generation/world-study/world-conditions';
import { createWorldProductionMap } from '../../src/generation/world-study/production-map';
import { renderWorldSurface } from '../../src/generation/world-study/surface';
import { worldSupportAt } from '../../src/generation/world-study/support';
import { paintSceneryMotion } from '../../src/generation/world-study/world-scenery';

const out='docs/qa/artifacts/rift-conditions-2026-10-02';
mkdirSync(out,{recursive:true});
const records=[];
for(const [index,profile] of WORLD_PROFILES.entries()) {
  const space=SPACE_PROFILES[index%2]!, seed=1002007+index;
  const conditions=compileWorldConditions(seed,profile,space);
  const map=createWorldProductionMap(profile,space,seed,{contentFragmentTypeId:'frag-library',paintGeometryVersion:2,generationVersion:2,conditions});
  const surface=renderWorldSurface(map.sample);
  const without=renderWorldSurface({...map.sample,scenery:undefined});
  let changed=0,voidPixels=0;
  assert.equal(map.sample.scenery?.length,3);
  const achromatic=Object.values(profile.palette).every(c=>(c>>16&255)===(c>>8&255)&&(c>>8&255)===(c&255));
  for(let y=0;y<surface.height;y++)for(let x=0;x<surface.width;x++) {
    const i=(y*surface.width+x)*4,a=surface.rgba;
    if(!worldSupportAt(map.sample,x,y)) {
      assert.equal(a[i]!|a[i+1]!|a[i+2]!,0,'scenery must not paint missing space');voidPixels++;
    }
    if(achromatic)assert(a[i]===a[i+1]&&a[i+1]===a[i+2],'achromatic world gains no decorative hue');
    if(a[i]!==without.rgba[i]||a[i+1]!==without.rgba[i+1]||a[i+2]!==without.rgba[i+2])changed++;
  }
  assert(changed>1500,'three landmarks must produce material-scale change, not tiny decals');
  const seat=map.sample.scenery![0]!, frames:number[][]=[];
  for(const time of [0,3.7]) {
    const points:number[]=[];
    const ctx={globalAlpha:1,fillStyle:'',fillRect(x:number,y:number,w:number,h:number){points.push(x,y,w,h,this.globalAlpha);}};
    paintSceneryMotion(ctx as unknown as CanvasRenderingContext2D,map.sample,time,seat.x,seat.y);
    assert.equal(ctx.globalAlpha,1,'compositor state restored'); frames.push(points);
  }
  assert.notDeepEqual(frames[0],frames[1],'scenery motion responds to scene time');
  const file=`${profile.id}-v2.png`;
  await sharp(surface.rgba,{raw:{width:surface.width,height:surface.height,channels:4}}).png().toFile(`${out}/${file}`);
  const record={world:profile.id,space:space.id,seed,effectiveSeed:map.metadata.effectiveSeed,conditions,file,changed,voidPixels,semantic:map.metadata.semantic};
  records.push(record);console.log(JSON.stringify({world:profile.id,changed,voidPixels,program:conditions.programId,attempt:map.metadata.attempt}));
}
writeFileSync(`${out}/scenery.json`,JSON.stringify({status:'PASS',scope:'5 native v2 baked surfaces; black unsupported space, grayscale identity, visible material-scale difference and motion clock. Not full gameplay/art approval.',records},null,2)+'\n');
