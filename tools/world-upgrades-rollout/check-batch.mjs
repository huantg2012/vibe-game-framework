/** Finite production-map batch gate and raw material evidence; never aesthetic approval. */
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import {createHash} from 'node:crypto';
import sharp from 'sharp';
import {footprintWitness} from './check-footprints.mjs';
import {R100_FRAGMENT_AUTHORING} from '../../src/generated/r100-fragment-data.ts';
import {R100_SEARCH_SITE_POLICIES} from '../../src/generated/r100-search-sites.ts';
import {PAINTED_MATERIALS} from '../../src/generated/r100-materials.ts';
import {ORGANIZATION_MATERIALS} from '../../src/generated/r100-material-organizations.ts';
import {createR100ProductionRecipe,validR100ProductionRecipe} from '../../src/generation/world-study/r100-package.ts';
import {createR100ProductionMap} from '../../src/generation/world-study/r100-production-map.ts';
import {hydrateR100MasterWorld} from '../../src/generation/world-study/r100-native-data.ts';
import {SearchSitePlanner,validateSearchSites} from '../../src/generation/world-study/search-site-placement.ts';
import {bakeMasterWorldSurface} from '../../src/systems/r100-world/surface-bake.ts';
import {bakeSearchSitePatches} from '../../src/systems/r100-world/search-site-bake.ts';
import {applySearchSitePatch,validateSearchSitePatches} from '../../src/systems/r100-world/search-site-patches.ts';
import {TileType} from '../../src/types/game-types.ts';
const worlds=(process.env.QA_WORLDS??'cinder-ridge,pale-sail').split(',');
const grades=(process.env.QA_GRADES??'low,medium,severe').split(',');
const tokens=(process.env.QA_SEEDS??'20261012').split(',');
assert(tokens.every(t=>/^\d+$/.test(t)));const seeds=tokens.map(Number);
assert(seeds.every(n=>Number.isSafeInteger(n)&&n>=0&&n<=0xffffffff)&&new Set(seeds).size===seeds.length);
assert(grades.every(g=>['low','medium','severe'].includes(g))&&new Set(grades).size===grades.length);
assert(worlds.length>0&&worlds.length<=5&&new Set(worlds).size===worlds.length,'Each batch must contain 1–5 unique worlds');
assert(worlds.every(id=>R100_FRAGMENT_AUTHORING.some(r=>r.worldId===id)&&R100_SEARCH_SITE_POLICIES.some(r=>r.worldId===id)),'World must have both registrations');
const output=process.env.QA_OUTPUT_DIR;assert(output,'QA_OUTPUT_DIR required');
assert(!fs.existsSync(output),'Never overwrite historical evidence');fs.mkdirSync(output,{recursive:true});
const hash=value=>createHash('sha256').update(typeof value==='string'?value:JSON.stringify(value)).digest('hex');
function exactHash(value){const h=createHash('sha256');function visit(v){if(ArrayBuffer.isView(v)){h.update(v.constructor.name).update(new Uint8Array(v.buffer,v.byteOffset,v.byteLength));return;}if(Array.isArray(v)){h.update('[');for(const c of v)visit(c);h.update(']');return;}if(v&&typeof v==='object'){h.update('{');for(const k of Object.keys(v)){visit(k);visit(v[k]);}h.update('}');return;}h.update(typeof v+':'+JSON.stringify(v));}visit(value);return h.digest('hex');}
const sourceHashes={};for(const root of ['src','data','tools/world-upgrades-rollout']){function walk(dir){for(const e of fs.readdirSync(dir,{withFileTypes:true})){const file=path.join(dir,e.name);if(e.isDirectory())walk(file);else if(e.isFile())sourceHashes[file]=createHash('sha256').update(fs.readFileSync(file)).digest('hex');}}walk(root);}
const inside = (ring, x, y) => {
  let found = false;
  for (let i = 0, j = ring.length - 1; i < ring.length; j = i++) {
    const a = ring[i], b = ring[j];
    if ((a.y > y) !== (b.y > y) && x < (b.x - a.x) * (y - a.y) / (b.y - a.y) + a.x) found = !found;
  }
  return found;
};
function enclosedVoids(map) {
  const {cols, rows, tiles} = map;
  const seen = new Uint8Array(cols * rows), queue = new Int32Array(cols * rows);
  let holes = 0;
  for (let start = 0; start < seen.length; start++) {
    if (seen[start] || tiles[Math.floor(start / cols)][start % cols] !== TileType.VOID) continue;
    let head = 0, tail = 1, outside = false; queue[0] = start; seen[start] = 1;
    while (head < tail) {
      const cell = queue[head++], x = cell % cols, y = Math.floor(cell / cols);
      if (x === 0 || y === 0 || x === cols - 1 || y === rows - 1) outside = true;
      for (const [dx, dy] of [[1, 0], [-1, 0], [0, 1], [0, -1]]) {
        const xx = x + dx, yy = y + dy, next = yy * cols + xx;
        if (xx < 0 || yy < 0 || xx >= cols || yy >= rows || seen[next] || tiles[yy][xx] !== TileType.VOID) continue;
        seen[next] = 1; queue[tail++] = next;
      }
    }
    if (!outside) holes++;
  }
  return holes;
}
async function painting(recipe, materialHashes) {
  const family = recipe.nativeDefinition.family;
  const decode = async definition => {
    const sourcePath=`public${definition.source}`, bytes=fs.readFileSync(sourcePath);
    materialHashes[sourcePath]=createHash('sha256').update(bytes).digest('hex');
    return {width:definition.logical_pixels,height:definition.logical_pixels,worldSize:definition.world_size,
      source:definition.source,regions:definition.regions,
      pixels:new Uint8ClampedArray(await sharp(bytes).resize(definition.logical_pixels,definition.logical_pixels).ensureAlpha().raw().toBuffer())};
  };
  const read = async definition => ({...await decode(definition), solid: {...await decode(definition.solid),
    skinRoughness: definition.solid.skinRoughness, cutRoughness: definition.solid.cutRoughness, gain: definition.solid.gain, cutGain: definition.solid.cutGain}});
  const primaryDefinition = recipe.appearance.materialOrganization ? ORGANIZATION_MATERIALS.find(row => row.organization === recipe.appearance.materialOrganization) : PAINTED_MATERIALS.find(row => row.family === family);
  const primary = await read(primaryDefinition), families = {};
  for (const name of new Set([family, ...recipe.nativeDefinition.instances.map(row => row.family ?? family)])) families[name] = name === family ? primary : await read(PAINTED_MATERIALS.find(row => row.family === name));
  return {...primary, families, appearance: recipe.appearance};
}
async function verifyCase(worldId, grade, seed) {
  const recipe = createR100ProductionRecipe(worldId, seed, grade);
  const started = performance.now(), result = createR100ProductionMap(recipe);
  const generatedMs = performance.now() - started;
  assert.equal(result.native.algorithmRevision, 10);
  assert(validR100ProductionRecipe(recipe));
  const replay=createR100ProductionMap(JSON.parse(JSON.stringify(recipe)));
  assert.equal(exactHash(replay),exactHash(result), "Frozen recipe full-map replay differs");
  assert.equal(result.native.definition.fragmentShapeVersion, 'rectilinear-fragment-v1');
  const native = structuredClone(result.native), layout = structuredClone(result.layout);
  const world = hydrateR100MasterWorld(native, layout);
  const {terrainOutline, erosion} = world.definition;
  assert.deepEqual(terrainOutline, recipe.spatialPolicy.terrainOutline);
  assert.deepEqual(erosion, recipe.spatialPolicy.erosion);
  const map = layout.tileMap, matter = new Uint8Array(map.cols * map.rows);
  let checkedSupportCells = 0, transparentSolidCells = 0, partialMaterialCells = 0;
  for (let row = 0; row < map.rows; row++) for (let col = 0; col < map.cols; col++) {
    const x = col * 8 + 4, y = row * 8 + 4;
    const expected = inside(terrainOutline, x, y) && !erosion.some(hole => inside(hole, x, y));
    assert.equal(map.tiles[row][col] !== TileType.VOID, expected, 'Final 8px map differs from frozen polygons');
    assert.equal(world.matterAt(x, y), expected, 'Hydrated matter differs');
    assert.equal(world.sight.isOpaque(col, row), !expected, 'VOID sight differs');
    matter[row * map.cols + col] = Number(expected);
    if (map.tiles[row][col] === TileType.WALL) {assert(!world.sight.isOpaque(col, row)); transparentSolidCells++;}
    checkedSupportCells++;
  }
  assert(transparentSolidCells > 0);
  for (let row = 0; row < world.sample.rows; row++) for (let col = 0; col < world.sample.cols; col++) {
    let count = 0;
    for (let y = 0; y < 4; y++) for (let x = 0; x < 4; x++) count += matter[(row * 4 + y) * map.cols + col * 4 + x];
    assert.equal(world.sample.land[row * world.sample.cols + col], Number(count > 0), '32px material sample cropped partial support');
    if (count && count < 16) partialMaterialCells++;
  }
  assert(partialMaterialCells > 0);
  const rasterHoles = enclosedVoids(map);
  assert.equal(rasterHoles, erosion.length, '8px raster merged/opened/lost a frozen hole');
  const surfaceStarted = performance.now();
  const materialHashes={};
  const materials=await painting(recipe, materialHashes);
  const surface = bakeMasterWorldSurface(world, materials);
  const patches=bakeSearchSitePatches(world,surface,materials);
  validateSearchSitePatches(world,patches);
  for(const patch of patches)applySearchSitePatch(surface,patch,patch.intact);
  verifySearch(recipe,result,world);
  const surfaceMs = performance.now() - surfaceStarted;
  let checkedSurfacePixels = 0;
  for (let y = 0; y < surface.height; y++) for (let x = 0; x < surface.width; x++) {
    const expected = Boolean(matter[Math.floor(y / 8) * map.cols + Math.floor(x / 8)]);
    assert.equal(surface.albedo[(y * surface.width + x) * 4 + 3] !== 0, expected, 'Surface alpha disagrees with authoritative terrain');
    checkedSurfacePixels++;
  }
  const spatial = result.native.diagnostics.spatial;
  const originalMeshFootprints = footprintWitness(world.definition);
  const images=await exportImages(worldId,grade,seed,world,surface,result,patches);
  fs.writeFileSync(path.join(output,images,'recipe.json'),JSON.stringify(recipe,null,2));
  // The accepted original six retain their authored contacts; new rollout geometry may not accidentally crop native bodies.
  const originalSix = new Set(['cinder-ridge','ash-strata','splayed-fibres','shell-chain','pale-sail','gel-fibre']);
  if (!originalSix.has(worldId)) assert(originalMeshFootprints.every(o=>!o.clipped), `Original native body cropped by terrain: ${JSON.stringify(originalMeshFootprints.filter(o=>o.clipped))}`);
  return {images,materialHashes,originalMeshFootprints,searchSites:world.searchSites,expedition:result.native.diagnostics.expedition,spatial,worldId, grade, seed, effectiveSeed: result.metadata.effectiveSeed, attempt: result.metadata.attempt, rejected: result.metadata.rejected,
    shapeHash: hash({terrainOutline, erosion}), supportHash: createHash('sha256').update(matter).digest('hex'),
    outlineVertices: terrainOutline.length, holes: erosion.length, rasterHoles, checkedSupportCells, transparentSolidCells, partialMaterialCells, checkedSurfacePixels,
    bodies: {bodySize: result.metadata.bodySize, reachableRatio: spatial.bodyReachableRatio, unreachableSeats: spatial.unreachableBodySeats},
    spawn: layout.spawnPoint, extraction: layout.extractionPoint.position, extractionRoutePx: result.metadata.extractionRoutePx,
    solidObjects: spatial.solidObjectCount, kindlingNodes: layout.kindlingNodes.length, contaminantNodes: layout.contaminantNodes.length, enemies: layout.enemySpawns.length,
    geometryFingerprint: result.native.diagnostics.geometryFingerprint, generatedMs, surfaceMs,
    rgbaHashes: Object.fromEntries(['albedo', 'normal', 'response', 'emission'].map(key => [key, createHash('sha256').update(surface[key]).digest('hex')]))};
}

/** Independent XY witness excludes appended shoreline triangles. */
function originalSurfaceContains(mesh,point){
 const p=mesh.positions,count=mesh.groundEdgeStart?.triangle??mesh.triangleCount;
 for(let face=0;face<count;face++){
  const a=mesh.indices[face*3]*3,b=mesh.indices[face*3+1]*3,c=mesh.indices[face*3+2]*3;
  const ax=p[a],ay=p[a+1],bx=p[b],by=p[b+1],cx=p[c],cy=p[c+1];
  const area=(bx-ax)*(cy-ay)-(by-ay)*(cx-ax);if(Math.abs(area)<1e-7)continue;
  const e=[(bx-ax)*(point.y-ay)-(by-ay)*(point.x-ax),(cx-bx)*(point.y-by)-(cy-by)*(point.x-bx),(ax-cx)*(point.y-cy)-(ay-cy)*(point.x-cx)];
  if(e.every(v=>v>=-1e-5)||e.every(v=>v<=1e-5))return true;
 }return false;
}
function verifySearch(recipe,map,world){
 validateSearchSites(world);const nodes=[...map.layout.kindlingNodes,...map.layout.contaminantNodes],sites=world.searchSites;
 assert.equal(sites.length,nodes.length);
 for(const site of sites)if(site.sourceDomain==='formation'){
  const mesh=world.meshes.find(m=>m.spec.id===site.sourceObjectId);assert(mesh);
  assert(originalSurfaceContains(mesh,site.sourceAnchor),`Formation source must belong to original mesh, never appended groundEdge: ${site.nodeId}`);
  if(site.sourceKind==='surface-peel'){assert.equal(world.definition.instances.find(instance=>instance.id===mesh.spec.id)?.role,'relief');assert(originalSurfaceContains(mesh,site.position),`Peel core is outside original relief: ${site.nodeId}`);}
 }
assert.equal(map.metadata.bodySize,20);assert.equal(map.metadata.supportTileSize,8);
 const spatial=map.native.diagnostics.spatial;assert(spatial.bodyReachableRatio>=.97);
 const ep=recipe.spatialPolicy.extraction;assert(spatial.extraction.interactionPathDistancePx>=ep.minPathDistancePx);assert(spatial.extraction.euclideanDistancePx>=ep.minEuclideanDistancePx);assert(spatial.extractionCandidateField.candidateCount>1);assert(spatial.extractionCandidateField.regionCount>1);assert(spatial.extractionCandidateField.distanceBandCount>1);
 const cd=recipe.contentDefinition;assert.equal(map.layout.enemySpawns.length,cd.enemy_count);
 for(const tier of ['safe','contested','deep']){assert.equal(map.layout.kindlingNodes.filter(n=>n.tier===tier).length,cd[`kindling_${tier}_count`]);assert.equal(map.layout.contaminantNodes.filter(n=>n.tier===tier).length,cd[`contaminant_${tier}_count`]);for(const node of map.layout.kindlingNodes.filter(n=>n.tier===tier))assert.equal(node.value,cd[`kindling_${tier}_value`]);}
 for(let i=0;i<nodes.length;i++)for(let j=0;j<i;j++)assert(Math.hypot(nodes[i].position.x-nodes[j].position.x,nodes[i].position.y-nodes[j].position.y)>=96);
 const d=map.native.diagnostics.expedition,p=world.spatialDeployment;assert(d.guaranteedSafeReturn);assert.equal(d.costBasis,'all-body-safe-48px-interaction-seats');assert.equal(d.patrolWindows.length,nodes.filter(n=>n.tier!=='safe').length);
 for(const n of d.nodes){const tier=n.id.split('/')[1];assert(n.interactionSeats>0&&n.pollutionDistancePx>=(tier==='safe'?34:16));assert(n.approachRoutePx<=(tier==='safe'?p.safe_max_approach_px:p.max_search_approach_px));assert(n.minimumExtraTravelPx>=(tier==='safe'?0:p[`${tier}_min_extra_travel_px`]));assert(n.minimumExtraTravelPx<=p[`${tier}_max_extra_travel_px`]);if(tier==='deep')assert(n.pollutionDistancePx<=100);}
 const altered={...world,layout:{...map.layout,kindlingNodes:map.layout.kindlingNodes.map(n=>({...n,value:99999,tier:'deep',lootPoolId:'changed'})),contaminantNodes:map.layout.contaminantNodes.map(n=>({...n,tier:'safe',lootPoolId:'changed'}))}};
 const planner=new SearchSitePlanner(altered,recipe.searchSitePolicy);assert.deepEqual(sites,nodes.map(n=>planner.placement(n.id,n.position)));
 const rules=recipe.spatialPolicy.organizationRules;
 if(rules.sourceMode==='source-once'){assert.equal(world.definition.instances.length,recipe.nativeDefinition.instances.length);for(const original of recipe.nativeDefinition.instances){const actual=world.definition.instances.find(i=>i.id===original.id);assert(actual);for(const key of ['family','role','height','thickness','fold','branches','opening','distortion','constructionVersion','shapeProfile','groundEdgeWidth'])assert.equal(actual[key],original[key],`source-once ${original.id}/${key}`);}}
}
async function exportImages(id,grade,seed,world,surface,map,patches){
 const dir=path.join(output,`${id}-${grade}-${seed}`);fs.mkdirSync(dir);const w=surface.width,h=surface.height;
 const material=sharp(Buffer.from(surface.albedo),{raw:{width:w,height:h,channels:4}}).flatten({background:'#000000'});
 await material.clone().png().toFile(path.join(dir,'material.png'));
 const silhouette=Buffer.alloc(w*h*3);for(let y=0;y<h;y++)for(let x=0;x<w;x++){const v=surface.albedo[(y*w+x)*4+3]?235:0,q=(y*w+x)*3;silhouette[q]=silhouette[q+1]=silhouette[q+2]=v;}
 await sharp(silhouette,{raw:{width:w,height:h,channels:3}}).png().toFile(path.join(dir,'silhouette.png'));
 for(let i=0;i<patches.length;i++){const patch=patches[i];for(const state of ['intact','searched'])await sharp(Buffer.from(patch[state].albedo),{raw:{width:patch.width,height:patch.height,channels:4}}).png().toFile(path.join(dir,`site-${i}-${state}.png`));}
 const s=map.layout.spawnPoint,e=map.layout.extractionPoint.position;
 const svg=Buffer.from(`<svg xmlns="http://www.w3.org/2000/svg" width="${w}" height="${h}"><g stroke-width="4"><circle cx="${s.x}" cy="${s.y}" r="15" fill="black" stroke="white"/><path d="M${e.x},${e.y-18}l18,18l-18,18l-18,-18Z" fill="black" stroke="#ffd36d"/></g><g fill="white" font-size="26" font-family="sans-serif" stroke="black" stroke-width="5" paint-order="stroke"><text x="${s.x+24}" y="${s.y}">SPAWN</text><text x="${e.x+24}" y="${e.y}">EXIT</text></g></svg>`);
 await material.clone().composite([{input:svg}]).png().toFile(path.join(dir,'material-points.png'));
 fs.writeFileSync(path.join(dir,'geometry.json'),JSON.stringify({definition:world.definition,spatialPolicy:map.native.spatialPolicy,spawn:s,extraction:e,searchSites:world.searchSites,diagnostics:map.native.diagnostics},null,2));
 return path.relative(output,dir);
}
const report={status:'running',worlds,grades,seeds,sourceHashes,cases:[],failures:[],limitations:['Raw albedo diagnostic uses the actual production four-channel bake and intact patches; no independent map drawing or invented lighting.','Not a normal-camera lighting, unknown-exit discovery, FPS or human aesthetic approval.','Requested seeds fixed; admitted generator retries are recorded, failed cases remain and no replacement seed is selected.','Old revision compatibility is verified by the separate fixed-Git baseline tool.']};
for(const worldId of worlds)for(const seed of seeds)for(const grade of grades){try{const item=await verifyCase(worldId,grade,seed);report.cases.push(item);console.log(`PASS ${worldId}/${grade}/${seed}`);}catch(error){report.failures.push({worldId,grade,seed,error:error.stack??String(error)});console.error(`FAIL ${worldId}/${grade}/${seed}: ${error.message}`);}finally{global.gc?.();fs.writeFileSync(path.join(output,'report.json'),JSON.stringify(report,null,2));}}
for(const id of worlds)for(const seed of seeds){const cases=report.cases.filter(r=>r.worldId===id&&r.seed===seed);if(cases.length===grades.length&&(new Set(cases.map(r=>r.shapeHash)).size!==1||new Set(cases.map(r=>r.supportHash)).size!==1))report.failures.push({worldId:id,seed,error:'Cross-grade terrain changed'});}
report.status=report.failures.length?'failed':'passed';fs.writeFileSync(path.join(output,'report.json'),JSON.stringify(report,null,2));console.log(JSON.stringify({status:report.status,cases:report.cases.length,failures:report.failures.length,output}));if(report.failures.length)process.exitCode=1;
