/** Synthetic unit fixtures only, always confined to OS temporary storage. */
import assert from 'node:assert/strict';
import fs from 'node:fs';
import {createHash} from 'node:crypto';
import os from 'node:os';
import path from 'node:path';
import {collectEvidence,renderGallery} from './build-gallery.mjs';
const root=fs.mkdtempSync(path.join(os.tmpdir(),'coh-gallery-unit-'));
try{
 const catalog=[{id:'cinder-ridge',label:'<test>'},{id:'unrun',label:'Unrun'}];
 const dir=path.join(root,'synthetic-batch'),images=path.join(dir,'sample');fs.mkdirSync(images,{recursive:true});
 for(const file of ['material.png','material-points.png','silhouette.png'])fs.writeFileSync(path.join(images,file),'unit placeholder, not production image');
 fs.writeFileSync(path.join(images,'geometry.json'),JSON.stringify({searchSites:[{sourceKind:'detached'}]}));
 const r={status:'passed',worlds:['cinder-ridge'],grades:['medium'],seeds:[1],cases:[{worldId:'cinder-ridge',grade:'medium',seed:1,images:'sample',searchSites:[{}]}],failures:[]};
 const save=()=>fs.writeFileSync(path.join(dir,'report.json'),JSON.stringify(r));save();
 let d=collectEvidence(root,catalog);assert.equal(d.verifiedGradeCells,1);assert(!d.complete);assert.equal(d.coverage[1].grades.medium.status,'unverified');assert.equal(d.cases[0].sourceKinds.detached,1);assert(renderGallery(d).includes('&lt;test&gt;'));
 r.cases.push({...r.cases[0]});save();assert.equal(collectEvidence(root,catalog).duplicates.length,1);r.cases.pop();
 r.failures.push({worldId:'cinder-ridge',grade:'medium',seed:2,error:'synthetic failure'});save();d=collectEvidence(root,catalog);assert.equal(d.coverage[0].grades.medium.status,'failed');assert(renderGallery(d).includes('synthetic failure'));r.failures=[];
 r.seeds.push(3);save();assert(collectEvidence(root,catalog).issues.some(i=>i.error.includes('no result')));r.seeds.pop();
 fs.unlinkSync(path.join(images,'material.png'));save();d=collectEvidence(root,catalog);assert.equal(d.verifiedGradeCells,0);assert(d.issues.some(i=>i.error.includes('Missing')));
 r.cases[0].images='../../../escape';save();assert(collectEvidence(root,catalog).issues.some(i=>i.error.includes('escapes')));
 r.cases[0].images='sample';fs.writeFileSync(path.join(images,'material.png'),'unit placeholder');save();
 const oldDir=path.join(root,'old');fs.mkdirSync(oldDir);const old={...r,status:'failed',cases:[],failures:[{worldId:'cinder-ridge',grade:'medium',seed:1,error:'original failure'}]};fs.writeFileSync(path.join(oldDir,'report.json'),JSON.stringify(old));
 const sha=file=>createHash('sha256').update(fs.readFileSync(file)).digest('hex');
 const resolution={worldId:'cinder-ridge',grade:'medium',seed:1,activeReport:'synthetic-batch/report.json',activeSha256:sha(path.join(dir,'report.json')),previous:[{report:'old/report.json',sha256:sha(path.join(oldDir,'report.json')),reason:'Same seed correction verified'}]};
 const resolve=()=>fs.writeFileSync(path.join(root,'resolutions.json'),JSON.stringify([resolution]));resolve();d=collectEvidence(root,catalog);assert.equal(d.currentFailures.length,0);assert.equal(d.failures.length,1);assert(renderGallery(d).includes('original failure'));assert.equal(d.verifiedGradeCells,1);
 resolution.seed=2;resolve();assert.throws(()=>collectEvidence(root,catalog),/same-world/);resolution.seed=1;resolution.activeSha256='bad';resolve();assert.throws(()=>collectEvidence(root,catalog),/exact hash/);
 console.log('PASS gallery: unverified coverage, escaping, source totals, duplicate, failure retention, missing cases/assets, path containment');
}finally{fs.rmSync(root,{recursive:true,force:true});}
