import assert from 'node:assert/strict';
import { RiftStagedEntry } from '../../src/systems/rift-staged-entry';
function fixture(failAt = -1) {
 const pending = new Set<() => void>(), calls: string[] = [];
 let owner: RiftStagedEntry;
 function* steps() { try { for(let i=0;i<4;i++){ calls.push(`stage${i}`); if(i===failAt)throw Error('stage failed'); yield; } } finally { calls.push('finally'); } }
 owner = new RiftStagedEntry(steps(),()=>calls.push('complete'),()=>calls.push('failed'),{schedule(fn){pending.add(fn);return()=>{pending.delete(fn);};}});
 const tick=()=>{const fn=[...pending][0];if(fn){pending.delete(fn);fn();}};
 return {owner,calls,pending,tick};
}
const normal=fixture();normal.owner.start();assert.deepEqual(normal.calls,['stage0']);
for(let i=1;i<=4;i++){assert.equal(normal.pending.size,1);normal.tick();}
assert.deepEqual(normal.calls,['stage0','stage1','stage2','stage3','finally','complete']);assert(!normal.owner.isActive());
for(let phase=0;phase<4;phase++){
 const h=fixture();h.owner.start();for(let i=0;i<phase;i++)h.tick();const stale=[...h.pending][0]!;
 h.owner.destroy();h.owner.destroy();stale();assert(!h.owner.isActive());assert.equal(h.pending.size,0);
 assert.deepEqual(h.calls,[...Array.from({length:phase+1},(_,i)=>`stage${i}`),'finally']);
}
for(let phase=0;phase<4;phase++){
 const h=fixture(phase);h.owner.start();for(let i=0;i<phase;i++)h.tick();assert(!h.owner.isActive());assert.equal(h.pending.size,0);
 assert.deepEqual(h.calls,[...Array.from({length:phase+1},(_,i)=>`stage${i}`),'finally','failed']);
}
let reentrant:RiftStagedEntry;let completed=false;
function* cancelInside(){reentrant.destroy();yield;throw Error('unreachable');}
reentrant=new RiftStagedEntry(cancelInside(),()=>{completed=true;},()=>{throw Error('unexpected failure');});reentrant.start();assert(!completed&&!reentrant.isActive());
console.log('PASS staged entry: bounded tasks, every partial cancellation/failure, stale callback and reentrant shutdown.');
