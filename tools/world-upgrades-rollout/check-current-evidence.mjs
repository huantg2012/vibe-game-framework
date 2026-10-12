/** Reconcile a <=5-world historical receipt batch against the current author/runtime inputs.
 * Runs production generation again; reuses baked image evidence only when all bake code hashes match. */
import fs from 'node:fs';import path from 'node:path';import assert from 'node:assert/strict';import {createHash} from 'node:crypto';
import {collectEvidence} from './build-gallery.mjs';
import {createR100ProductionRecipe} from '../../src/generation/world-study/r100-package.ts';
import {createR100ProductionMap} from '../../src/generation/world-study/r100-production-map.ts';
import {footprintWitness} from './check-footprints.mjs';
const root=process.env.QA_EVIDENCE_ROOT??'docs/qa/artifacts/world-upgrades-rollout-2026-10-12',out=process.env.QA_OUTPUT_FILE;
const worlds=process.env.QA_WORLDS?.split(',');assert(worlds?.length&&worlds.length<=5&&new Set(worlds).size===worlds.length);assert(out&&!fs.existsSync(out));
const evidence=collectEvidence(root),results=[];const digest=p=>createHash('sha256').update(fs.readFileSync(p)).digest('hex');
const materialProof=JSON.parse(fs.readFileSync(path.join(root,'material-input-provenance.json')));
assert.equal(materialProof.status,'passed');
const receipts=new Map(evidence.reports.map(r=>[r.file,r]));
const same=(a,b,message)=>assert.deepEqual(JSON.parse(JSON.stringify(a)),JSON.parse(JSON.stringify(b)),message);
const catalogHashPaths=['spatialPolicy.sourceHash','spatialPolicy.fragmentShape.sourceHash','spatialPolicy.deployment.sourceHash','searchSitePolicy.sourceHash','package.dependencyHash'];
function normalizedRecipe(recipe){const copy=structuredClone(recipe);for(const p of catalogHashPaths){const parts=p.split('.'),key=parts.pop();let owner=copy;for(const k of parts)owner=owner?.[k];if(owner)delete owner[key];}return copy;}
function changedIdentityHashes(a,b){return catalogHashPaths.filter(p=>{const get=v=>p.split('.').reduce((o,k)=>o?.[k],v);return get(a)!==get(b);});}

for(const id of worlds)for(const grade of ['low','medium','severe']){
 const row=evidence.cases.find(c=>c.worldId===id&&c.grade===grade&&!c.supersededBy&&c.seed===20261012);assert(row,`No active receipt ${id}/${grade}`);
 try{
  const receipt=receipts.get(row.batch),g=JSON.parse(fs.readFileSync(path.join(root,row.images,'geometry.json')));
  const bakeSources=Object.entries(receipt.sourceHashes).filter(([p])=>p.startsWith('src/systems/r100-world/')||/native-volume-(geometry|raster)/.test(p));
  for(const[p,h]of Object.entries(materialProof.definitionHashes)){assert.equal(receipt.sourceHashes[p],h,`Receipt material definition differs: ${p}`);assert.equal(digest(p),h,`Current material definition changed: ${p}`);}
  for(const[p,h]of Object.entries(row.materialHashes??materialProof.materialHashes))assert.equal(digest(p),h,`Decoded material bytes changed: ${p}`);
  assert(bakeSources.length>=5,'Missing original bake source provenance');for(const[p,h]of bakeSources)assert.equal(digest(p),h,`Bake source changed; rebake required: ${p}`);
  const recipe=createR100ProductionRecipe(id,row.seed,grade),map=createR100ProductionMap(recipe);
  const savedRecipePath=path.join(root,row.images,'recipe.json');let identityComparison='receipt predates recipe capture; fixed definition/source provenance used';
  if(fs.existsSync(savedRecipePath)){const prior=JSON.parse(fs.readFileSync(savedRecipePath));same(recipe.appearance,prior.appearance,'Appearance changed');same(recipe.package.materials,prior.package.materials,'Material identity changed');same(recipe.nativeDefinition,prior.nativeDefinition,'Native source changed');same(normalizedRecipe(recipe),normalizedRecipe(prior),'Frozen recipe semantics changed beyond catalog provenance hashes');identityComparison=recipe.package.dependencyHash===prior.package.dependencyHash?'identical dependencyHash':{status:'catalog provenance hashes differ; semantic recipe is identical, not identity equivalence',changedPaths:changedIdentityHashes(recipe,prior)};}
  same(map.native.definition,g.definition,'Current original geometry changed');same(map.layout.spawnPoint,g.spawn,'Current spawn changed');same(map.layout.extractionPoint.position,g.extraction,'Current exit changed');same(map.native.searchSites,g.searchSites,'Current search provenance changed');
  assert.equal(map.native.diagnostics.geometryFingerprint,row.geometryFingerprint);assert.equal(map.metadata.effectiveSeed,row.effectiveSeed);
  const footprints=footprintWitness(map.native.definition);
  const originalSix=['cinder-ridge','ash-strata','splayed-fibres','shell-chain','pale-sail','gel-fibre'];if(!originalSix.includes(id))assert(footprints.every(o=>!o.clipped),'Native object cropped');
  results.push({worldId:id,grade,seed:row.seed,status:'passed',receipt:row.batch,receiptSha256:receipt.hash,geometryFingerprint:row.geometryFingerprint,bakeSourceCount:bakeSources.length,identityComparison,materialByteSource:row.materialHashes?'direct batch capture':'fixed-Git additive proof',footprints});
  console.log(`CURRENT ${id}/${grade}`);
 }catch(e){results.push({worldId:id,grade,seed:row.seed,status:'failed',error:e.stack});console.error(`STALE ${id}/${grade}: ${e.message}`);}
 global.gc?.();
}
fs.mkdirSync(path.dirname(out),{recursive:true});fs.writeFileSync(out,JSON.stringify({status:results.every(r=>r.status==='passed')?'passed':'failed',scope:'Current production generation equals active frozen geometry, spawn, exit, source placements and geometry fingerprint; all native bake source hashes equal the baked evidence. Finite requested seed, not all-seed or aesthetic qualification.',results},null,2));if(results.some(r=>r.status==='failed'))process.exitCode=1;
