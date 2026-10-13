/** Exact r10 recovery against independent pre-change receipts, without duplicating images. */
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import {createHash} from 'node:crypto';
import sharp from 'sharp';
import {PAINTED_MATERIALS} from '../../src/generated/r100-materials.ts';
import {ORGANIZATION_MATERIALS} from '../../src/generated/r100-material-organizations.ts';
import {applySearchSitePatch} from '../../src/systems/r100-world/search-site-patches.ts';
const frozen = process.argv.includes('--frozen');
const executor = frozen ? await import('../../src/generation/legacy-r100-v10/executor-recovery.js') : {
  ...await import('../../src/generation/world-study/r100-package.ts'),
  ...await import('../../src/generation/world-study/r100-production-map.ts'),
  ...await import('../../src/generation/world-study/r100-native-data.ts'),
  ...await import('../../src/systems/r100-world/surface-bake.ts'),
  ...await import('../../src/systems/r100-world/search-site-bake.ts'),
};
const directory = 'docs/qa/artifacts/spatial-augmentation-2026-10-13';
const reportPath = process.env.QA_REPORT ?? `${directory}/code/r10-${frozen ? 'closure' : 'public'}-recovery.json`;
assert(!fs.existsSync(reportPath), 'Refusing to overwrite prior evidence');
const hash = bytes => createHash('sha256').update(bytes).digest('hex');
function exactHash(value) {
  const digest = createHash('sha256');
  function visit(item) {
    if (ArrayBuffer.isView(item)) {digest.update(`typed:${item.constructor.name}:${item.byteLength}:`).update(new Uint8Array(item.buffer,item.byteOffset,item.byteLength));return;}
    if (Array.isArray(item)) {digest.update(`array:${item.length}[`);for(const child of item)visit(child);digest.update(']');return;}
    if(item&&typeof item==='object'){digest.update('{');for(const key of Object.keys(item)){visit(key);visit(item[key]);}digest.update('}');return;}
    assert.notEqual(typeof item,'function');const text=item===undefined?'undefined':JSON.stringify(item);digest.update(`${typeof item}:${text.length}:${text}`);
  }
  visit(value);return digest.digest('hex');
}
const baselinePath = `${directory}/qa/r10-current/baseline.json`;
const baseline=JSON.parse(fs.readFileSync(baselinePath,'utf8'));
const earlierPath=`${directory}/qa/earlier-r10-references.json`;
const earlier=JSON.parse(fs.readFileSync(earlierPath,'utf8'));
assert.equal(baseline.status,'passed');
assert.equal(hash(fs.readFileSync(earlier.baselineReceipt)),earlier.baselineReceiptSha256);
const rows=[...baseline.cases.map(row=>({...row,recipePath:path.join(path.dirname(baselinePath),row.recipeFile)})),...earlier.cases];
const report={status:'running',startedAt:new Date().toISOString(),mode:frozen?'frozen-closure':'public-routing',sourceCommit:'99998703743895da7486fdee552f7bed019e64b8',baselineHashes:{[baselinePath]:hash(fs.readFileSync(baselinePath)),[earlierPath]:hash(fs.readFileSync(earlierPath))},node:process.version,cases:[],failures:[],materialHashes:{},limits:['12 frozen r10 identities; six medium-grade identities include four RGBA channels and full intact/searched patch bytes.','Hash-only evidence; no image data copied. Not a visual or runtime performance verdict.']};
async function painting(recipe) {
  async function decode(definition){const file=`public${definition.source}`,input=fs.readFileSync(file);report.materialHashes[file]=hash(input);return {width:definition.logical_pixels,height:definition.logical_pixels,worldSize:definition.world_size,source:definition.source,regions:definition.regions,pixels:new Uint8ClampedArray(await sharp(input).resize(definition.logical_pixels,definition.logical_pixels).ensureAlpha().raw().toBuffer())};}
  const read=async d=>({...await decode(d),solid:{...await decode(d.solid),skinRoughness:d.solid.skinRoughness,cutRoughness:d.solid.cutRoughness,gain:d.solid.gain,cutGain:d.solid.cutGain}});
  const family=recipe.nativeDefinition.family,definition=recipe.appearance.materialOrganization?ORGANIZATION_MATERIALS.find(row=>row.organization===recipe.appearance.materialOrganization):PAINTED_MATERIALS.find(row=>row.family===family);
  const primary=await read(definition),families={};for(const name of new Set([family,...recipe.nativeDefinition.instances.map(row=>row.family??family)]))families[name]=name===family?primary:await read(PAINTED_MATERIALS.find(row=>row.family===name));
  return {...primary,families,appearance:recipe.appearance};
}
for(const [index,row] of rows.entries()) {
  const id=`${row.worldId}-${row.grade}-${row.seed}`;
  try {
    const bytes=fs.readFileSync(row.recipePath);assert.equal(hash(bytes),row.recipeSha256);
    const recipe=JSON.parse(bytes);assert.equal(recipe.package.algorithmRevision,10);assert(executor.validR100ProductionRecipe(recipe));assert.equal(exactHash(recipe),row.recipeHash);
    const map=executor.createR100ProductionMap(recipe),mapHash=exactHash(map);assert.equal(mapHash,row.mapHash,`${id}: full map differs`);
    const result={id,recipePath:row.recipePath,mapHash,material:null};
    if(row.material){const world=executor.hydrateR100MasterWorld(map.native,map.layout),material=await painting(recipe),surface=executor.bakeMasterWorldSurface(world,material),patches=executor.bakeSearchSitePatches(world,surface,material);const receipt={patchHash:exactHash(patches),states:{}};
      for(const state of ['intact','searched']){for(const patch of patches)applySearchSitePatch(surface,patch,patch[state]);receipt.states[state]=Object.fromEntries(['albedo','normal','response','emission'].map(channel=>[channel,hash(surface[channel])]));}
      assert.deepEqual(receipt,row.material,`${id}: RGBA or two-state patches differ`);result.material=receipt;
    }
    report.cases.push(result);console.log(`PASS ${index+1}/${rows.length} ${id}`);
  }catch(error){report.failures.push({id,error:error.stack??String(error)});console.error(error);}
  fs.mkdirSync(path.dirname(reportPath),{recursive:true});fs.writeFileSync(reportPath,JSON.stringify(report,null,2)+'\n');global.gc?.();
}
report.status=report.failures.length?'failed':'passed';report.completedAt=new Date().toISOString();fs.writeFileSync(reportPath,JSON.stringify(report,null,2)+'\n');console.log(JSON.stringify({status:report.status,cases:report.cases.length,failures:report.failures.length,reportPath}));if(report.failures.length)process.exitCode=1;
