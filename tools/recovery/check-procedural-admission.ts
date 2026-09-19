/** Actual formal-2D frame boundary, including corrupt cross-owner references. */
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
Object.defineProperty(globalThis,'localStorage',{configurable:true,value:{getItem:()=>null}});
const {validateProceduralRiftAdmission}=await import('../../src/managers/rift-recovery');
const fixture=JSON.parse(readFileSync('tools/recovery/fixtures/formal-active.json','utf8'));
const record={riftCheckpoint:fixture.checkpoint,inventory:fixture.inventory}, original=record.riftCheckpoint;
const originalRecord=structuredClone(record);
assert(validateProceduralRiftAdmission(original,record.inventory),'actual recorded state must remain admissible');
const mutations:[string,(state:any)=>void][]=[
 ['foreign stunned enemy',s=>s.tools.extended.stuns.push({enemyId:'not-in-this-world',remainingMs:100,tag:'echo'})],
 ['foreign tracking episode',s=>s.tools.extended.tracking.push({enemyId:'not-in-this-world',sampledAt:0,lastVisiblePosition:{x:100,y:100},hasVisiblePosition:true,spent:true,echo:null})],
 ['foreign delay host',s=>{s.tools.controlSerial++;s.tools.extended.delays.push({hostId:'not-in-this-world',position:{x:100,y:100},remainingMs:100,source:`tool:${s.tools.controlSerial}`})}],
 ['search source relocation',s=>s.search.nodes[0].position.x+=32],
 ['search base yield corruption',s=>s.search.nodes[0].value+=100],
 ['missing host',s=>s.world.hosts.hosts.pop()],
 ['unknown host field',s=>s.world.hosts.hosts[0].state.extra='corrupt'],
 ['unbounded host timer',s=>s.world.hosts.hosts[0].activity.elapsedMs=Infinity],
 ['false body kill count',s=>s.result.killCount++],
 ['invalid player placement',s=>{s.player.position.x=-32;s.player.entity?.position&&(s.player.entity.position.x=-32)}],
];
const rejected=[];for(const[name,mutate]of mutations){const candidate=structuredClone(original);mutate(candidate.state);assert(!validateProceduralRiftAdmission(candidate,record.inventory),name+' must reject');rejected.push(name);}
assert.deepEqual(record,originalRecord,'admission and rejection leave the supplied frame and inventory untouched');
const coreOrder=JSON.parse(readFileSync('tools/recovery/fixtures/formal-host-core-order.json','utf8'));
const originalCoreOrder=structuredClone(coreOrder);
assert.equal(coreOrder.checkpoint.identity.seed,0);
assert.equal(coreOrder.checkpoint.state.combat.externalTargetIds[0],'core:ENM_DING_01:0');
assert(validateProceduralRiftAdmission(coreOrder.checkpoint,coreOrder.inventory),
  'actual hittable Ding preceding paint colony nuclei retains production target order');
const foreignCore=structuredClone(coreOrder.checkpoint);
foreignCore.state.combat.externalTargetIds[0]='core:not-in-this-world:0';
assert(!validateProceduralRiftAdmission(foreignCore,coreOrder.inventory),'saved names cannot invent a host core');
assert.deepEqual(coreOrder,originalCoreOrder,'actual Host-order record is read-only during admission');
console.log(`PASS formal admission: two actual Host compositions, authored core order + ${rejected.length+1} corrupt owner/identity/range counterexamples`);
