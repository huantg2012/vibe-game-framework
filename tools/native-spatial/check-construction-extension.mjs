/** Finite pure construction fixtures; never compiles fragment/terrain or renders. */
import assert from 'node:assert/strict';
import fs from 'node:fs';
import {createHash} from 'node:crypto';
import {constructNativeConstructionExtensions as construct,parseNativeConstructionExtensionPolicy as parse} from '../../src/generation/world-study/native-spatial-construction-extension.ts';
import {parseNativeSpatialConstructionReference,constructNativeSpatialReference} from '../../src/generation/world-study/native-spatial-construction-reference.ts';
import {createR100NativeSpatialDevelopmentRecipe} from '../../src/generation/world-study/r100-package.ts';
const sha=text=>createHash('sha256').update(text).digest('hex');
const csv=fs.readFileSync('data/rift-native-construction-extension.csv','utf8'),policy=parse(csv,sha(csv));
const recipe=createR100NativeSpatialDevelopmentRecipe('gel-rafts',20261012,'medium');
const profile=recipe.nativeSpatial.subordinateProfiles[0];
const template={id:100,role:'solid',family:profile.family,constructionVersion:profile.constructionVersion,shapeProfile:profile.shapeProfile,x:0,y:0,length:profile.minLengthPx,width:profile.minWidthPx,height:profile.maxHeightPx,rotation:recipe.nativeSpatial.world.materialAxisRad+profile.rotationOffsetRad,thickness:profile.thicknessPx,fold:profile.fold,branches:profile.branches,opening:profile.opening,distortion:profile.distortion};
const input={land:[[32,32,1920,1920]],holes:[{holeId:'base-h0',profileId:'offset-cut-small',rects:[[832,832,80,112],[840,896,80,56]]},{holeId:'base-h1',profileId:'offset-cut-small',rects:[[1160,832,80,112],[1168,896,80,56]]}],instances:[{...template,x:1104,y:1200}],solidTemplates:[{id:'template',instances:[template]}],family:recipe.nativeDefinition.family,spawn:{x:960,y:1360},protectedRects:[],frame:[1984,1984],seed:20261012,spatialPolicy:recipe.nativeSpatial.policy};
const original=structuredClone(input),first=construct(input,policy),again=construct(input,policy);
assert.deepEqual(input,original);assert.deepEqual(first,again,'deterministic finite construction');
assert(first.additions.length>0,JSON.stringify(first.trials));
assert.equal(first.holes.length,first.additions.length*2);assert.equal(first.solids.length,first.additions.length);
assert(first.trials.length<=policy.candidateBudget);assert(first.additions.length<=policy.maxAddedSolids);
assert.equal(new Set(first.trials.filter(t=>t.accepted).map(t=>t.direction)).size,first.additions.length);
assert(first.addedLandAreaPx2<=1920*1920*policy.maxGrowthRatio);
for(const trial of first.trials)assert(trial.rect.every(value=>value%8===0),'all proposed land coordinates on 8px grid');
for(const hole of first.holes)for(const rect of hole.rects)assert(rect.every(value=>value%8===0));
for(const solid of first.solids){assert(solid.instances.every(instance=>instance.length===template.length&&instance.width===template.width));assert(solid.instances.every(instance=>instance.id!==template.id));}
for(const r of [...input.land,...first.additions.map(a=>a.rect)]){const x=r[0]+first.translation.x,y=r[1]+first.translation.y;assert(x>=policy.frameMarginPx&&y>=policy.frameMarginPx);assert(x+r[2]<=first.frameAfter[0]-policy.frameMarginPx&&y+r[3]<=first.frameAfter[1]-policy.frameMarginPx);}
assert(first.translation.x>0||first.translation.y>0||first.frameAfter.some((v,i)=>v>input.frame[i]),'frame reserves space instead of clipping');
const guarded=construct({...input,protectedRects:[[-2048,-2048,8192,8192]]},policy);assert.equal(guarded.additions.length,0);assert(guarded.trials.some(t=>t.reasons.includes('protected-reference-region')));
const areaLimited=construct(input,{...policy,maxGrowthRatio:.0001});assert.equal(areaLimited.additions.length,0);assert(areaLimited.trials.some(t=>t.reasons.includes('area-budget')));
assert.throws(()=>parse(csv,'bad'),/source/);assert.throws(()=>parse(csv.replace('coherent-extension-v1','wrong'),sha(csv)),/row/);
const source=fs.readFileSync('data/rift-native-construction-gel-rafts.csv','utf8'),reference=parseNativeSpatialConstructionReference(source,sha(source));let shape;
const stop=new Error('stop before the only compile');assert.throws(()=>constructNativeSpatialReference(recipe,reference,s=>{shape=s;throw stop;}),e=>e===stop);
assert.deepEqual(shape.layout.landRects,reference.rows.filter(r=>r.kind==='land').map(r=>[r.x_px,r.y_px,r.width_px,r.height_px].map(v=>Number(v)/2)));
assert.deepEqual(shape.layout.voidRects,reference.rows.filter(r=>r.kind==='hole').flatMap(r=>r.rects.split('|').map(rect=>rect.split(':').map(v=>Number(v)/2))));
assert.equal(shape.sourceHash,reference.sourceHash);assert.equal(shape.edgeSeed,reference.seed+reference.seedSalt);
const sampleCounts=[];
for(const file of ['data/rift-native-construction-reference.csv','data/rift-native-construction-gel-rafts.csv','data/rift-native-construction-ash-strata.csv']){
  const text=fs.readFileSync(file,'utf8'),ref=parseNativeSpatialConstructionReference(text,sha(text)),sampleRecipe=createR100NativeSpatialDevelopmentRecipe(ref.worldId,ref.seed,ref.grade);let beforeCompile;
  assert.throws(()=>constructNativeSpatialReference(sampleRecipe,ref,s=>{beforeCompile=s;throw stop;},undefined,{policy,moduleSourceHash:sha(fs.readFileSync('src/generation/world-study/native-spatial-construction-extension.ts')),combinedSourceHash:sha(text+csv)}),error=>error===stop);
  const baseLand=ref.rows.filter(row=>row.kind==='land').length,accepted=beforeCompile.layout.landRects.length-baseLand;
  sampleCounts.push({worldId:ref.worldId,accepted,frame:beforeCompile.layout.authoringFrame.map(n=>n*2)});
}
console.log(JSON.stringify({scope:'three frozen references stopped before fragment compiler',sampleCounts}));
assert(sampleCounts.every(sample=>sample.accepted>0),'all three references must receive a joint extension');
console.log(JSON.stringify({passed:true,scope:'pure complete-object construction; no fragment/terrain/render',checks:['deterministic','input-immutable','2H1S-per-accepted-module','shared-budget','direction-diversity','8px-grid','whole-source-dimensions','frame-translation-no-clipping','protected-region','area-budget','strict-policy','no-extension-compatibility'],sampleCounts,accepted:first.additions.length,trials:first.trials.length,additions:first.additions,translation:first.translation,frameAfter:first.frameAfter},null,2));
