/** Reuse existing r10 maps; compare current lightweight baseline extraction only. */
import assert from 'node:assert/strict';
import fs from 'node:fs';
import {createHash} from 'node:crypto';
import {deserialize} from 'node:v8';
import {gunzipSync} from 'node:zlib';
import {createR100SpatialBaselineTerrain} from '../../src/generation/world-study/r100-spatial-world.ts';
import {compileNativeTerrain} from '../../src/generation/world-study/native-terrain.ts';
import {NativeBodyCollision} from '../../src/generation/world-study/native-body-collision.ts';
import {TileType} from '../../src/types/game-types.ts';

const output=process.argv[2]??'docs/qa/artifacts/spatial-augmentation-2026-10-13/qa/baseline-extraction.json';
assert(!fs.existsSync(output),'Do not overwrite prior evidence');
const files=['src/generation/world-study/r100-spatial-world.ts','src/generation/world-study/native-terrain.ts','src/generation/world-study/native-body-collision.ts'];
const hash=bytes=>createHash('sha256').update(bytes).digest('hex');
const hashSources=()=>Object.fromEntries(files.map(file=>[file,hash(fs.readFileSync(file))]));
const sources=hashSources(),results=[];
for(const worldId of ['split-rib-causeway','gel-rafts','sloughed-court']) {
  const started=performance.now(),stem=`${worldId}-medium-20261012`;
  const recipePath=`docs/qa/artifacts/spatial-augmentation-2026-10-13/qa/r10-current/${stem}.recipe.json`;
  const mapPath=`docs/qa/artifacts/stealth-obstacles-2026-10-13/code/after-final/${stem}/map.v8.gz`;
  try {
    const recipe=JSON.parse(fs.readFileSync(recipePath,'utf8')),compressed=fs.readFileSync(mapPath),map=deserialize(gunzipSync(compressed));
    const seed=map.metadata.effectiveSeed,{definition}=createR100SpatialBaselineTerrain(recipe.nativeDefinition,recipe.spatialPolicy,seed),current=compileNativeTerrain(definition,seed);
    const oldTile=map.layout.tileMap;
    assert.equal(current.tileMap.cols,oldTile.cols);assert.equal(current.tileMap.rows,oldTile.rows);assert.equal(current.tileMap.tileSize,oldTile.tileSize);
    let tileDifferences=0,bodyDifferences=0,matterDifferences=0;
    const oldBody=new NativeBodyCollision(map.native,oldTile),newBody=new NativeBodyCollision(current,current.tileMap);
    for(let y=0;y<oldTile.rows;y++)for(let x=0;x<oldTile.cols;x++) {
      tileDifferences+=Number(oldTile.tiles[y][x]!==current.tileMap.tiles[y][x]);
      const q={x:x*8+4,y:y*8+4};
      matterDifferences+=Number(Number(oldTile.tiles[y][x]!==TileType.VOID)!==current.matter[y*oldTile.cols+x]);
      bodyDifferences+=Number(oldBody.supports(q,10,10)!==newBody.supports(q,10,10));
    }
    let meshDifferences=0;
    for(const mesh of current.meshes) {
      const original=map.native.meshes.find(item=>item.spec.id===mesh.spec.id);assert(original);
      for(const channel of ['positions','indices'])meshDifferences+=Number(hash(new Uint8Array(mesh[channel].buffer,mesh[channel].byteOffset,mesh[channel].byteLength))!==hash(new Uint8Array(original[channel].buffer,original[channel].byteOffset,original[channel].byteLength)));
    }
    const observation={worldId,seed,comparedCells:oldTile.cols*oldTile.rows,tileDifferences,matterDifferences,bodyDifferences,meshDifferences,
      compressedOldMapHash:hash(compressed),recipeHash:hash(fs.readFileSync(recipePath)),mapPath,recipePath};
    assert.equal(tileDifferences,0,JSON.stringify(observation));assert.equal(matterDifferences,0,JSON.stringify(observation));assert.equal(bodyDifferences,0,JSON.stringify(observation));assert.equal(meshDifferences,0,JSON.stringify(observation));
    results.push({...observation,passed:true,elapsedMs:Math.round(performance.now()-started)});
  }catch(error){results.push({worldId,passed:false,error:error.message,elapsedMs:Math.round(performance.now()-started)});}
  console.log(JSON.stringify(results.at(-1)));global.gc?.();
}
const stable=JSON.stringify(sources)===JSON.stringify(hashSources());
const report={scope:'Current lightweight baseline terrain against pre-existing r10 maps, not another complete r10 replay or material bake',sources,sourceStable:stable,passed:results.filter(row=>row.passed).length,failed:results.filter(row=>!row.passed).length+Number(!stable),results};
fs.writeFileSync(output,JSON.stringify(report,null,2)+'\n');console.log(JSON.stringify({output,passed:report.passed,failed:report.failed}));if(report.failed)process.exitCode=1;
