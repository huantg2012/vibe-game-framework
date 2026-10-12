/** Reconcile final evidence in author batches, never one opaque ALL execution. */
import fs from 'node:fs';import path from 'node:path';import assert from 'node:assert/strict';import {spawn} from 'node:child_process';import {createHash} from 'node:crypto';
import {R100_NATIVE_WORLDS} from '../../src/generated/r100-native-worlds.ts';
import {R100_FRAGMENT_AUTHORING} from '../../src/generated/r100-fragment-data.ts';
import {R100_SEARCH_SITE_POLICIES} from '../../src/generated/r100-search-sites.ts';
const root=process.env.QA_EVIDENCE_ROOT??'docs/qa/artifacts/world-upgrades-rollout-2026-10-12',out=process.env.QA_OUTPUT_DIR;assert(out&&!fs.existsSync(out),'Use a fresh final audit directory');
const sorted=xs=>xs.slice().sort(),catalog=R100_NATIVE_WORLDS.map(w=>w.id);
assert.equal(catalog.length,108);assert.deepEqual(sorted(R100_FRAGMENT_AUTHORING.map(w=>w.worldId)),sorted(catalog));assert.deepEqual(sorted(R100_SEARCH_SITE_POLICIES.map(w=>w.worldId)),sorted(catalog));
assert.equal(new Set(R100_FRAGMENT_AUTHORING.map(w=>w.layoutId??w.layout?.id)).size,108,'Every world requires an independent layout');
const text=fs.readFileSync('docs/design-notes/rift-fragment-rollout-batches.md','utf8');
const groups=[{id:'original-a',worlds:['cinder-ridge','ash-strata','splayed-fibres']},{id:'original-b',worlds:['shell-chain','pale-sail','gel-fibre']}];
for(const match of text.matchAll(/^### (B\d+) .*\n([\s\S]*?)(?=^### |^## |$(?![\s\S]))/gm)){if(match[1]==='B01')continue;const worlds=[...match[2].matchAll(/^- `([a-z0-9-]+)`/gm)].map(m=>m[1]);if(worlds.length)groups.push({id:match[1].toLowerCase(),worlds});}
assert.deepEqual(sorted(groups.flatMap(g=>g.worlds)),sorted(catalog));assert(groups.every(g=>g.worlds.length<=5));
const tracked=['src','data'];const sourceHashes={};function walk(dir){for(const e of fs.readdirSync(dir,{withFileTypes:true})){const p=path.join(dir,e.name);if(e.isDirectory())walk(p);else sourceHashes[p]=createHash('sha256').update(fs.readFileSync(p)).digest('hex');}}for(const p of tracked)walk(p);
fs.mkdirSync(out,{recursive:true});const results=[];
for(const g of groups){const report=path.join(out,`${g.id}.json`);const code=await new Promise(resolve=>{const child=spawn(process.execPath,['--expose-gc','--import','tsx','tools/world-upgrades-rollout/check-current-evidence.mjs'],{env:{...process.env,QA_WORLDS:g.worlds.join(','),QA_OUTPUT_FILE:report},stdio:'inherit'});child.on('exit',resolve);});results.push({...g,code,report});fs.writeFileSync(path.join(out,'summary.json'),JSON.stringify({status:'running',sourceHashes,results},null,2));}
const changed=Object.entries(sourceHashes).filter(([p,h])=>createHash('sha256').update(fs.readFileSync(p)).digest('hex')!==h).map(([p])=>p);
const status=results.every(g=>g.code===0)&&!changed.length?'passed':'failed';fs.writeFileSync(path.join(out,'summary.json'),JSON.stringify({status,sourceHashes,changed,worlds:108,cases:results.reduce((n,g)=>n+g.worlds.length*3,0),results},null,2));if(status!=='passed')process.exitCode=1;
