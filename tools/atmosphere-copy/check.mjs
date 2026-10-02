/** Deterministic presentation-history and CSV contract regression. */
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import {fileURLToPath} from 'node:url';
import {NarrationMemory,NARRATION_STORAGE_KEY} from '../../src/narrative/narration-memory.ts';
import {atmosphereSource,generateAtmosphereCopy} from './generate.mjs';

const root=path.resolve(path.dirname(fileURLToPath(import.meta.url)),'../..');
const pool=[{id:'a',text:'甲。'},{id:'b',text:'乙。'},{id:'c',text:'丙。'},{id:'d',text:'丁。'}];
class MemoryStorage{
  values=new Map([['coh.save','unchanged-game-record']]);reads=0;writes=0;
  getItem(key){this.reads++;return this.values.get(key)??null;}
  setItem(key,value){this.writes++;assert.equal(key,NARRATION_STORAGE_KEY);this.values.set(key,value);}
}
const checks=[];
{
  const previous = Math.random;
  try {
    Math.random = () => { throw Error('Gameplay random stream consumed by narration'); };
    assert(pool.includes(new NarrationMemory().choose('isolated', pool)));
  } finally { Math.random = previous; }
  checks.push('default cosmetic random never consumes even the legacy Math.random stream');
}
{
  const storage=new MemoryStorage(),memory=new NarrationMemory(storage,()=>0),out=[];
  assert.equal(storage.writes,0,'Loading history must not consume a line');
  for(let n=0;n<16;n++)out.push(memory.choose('rest',pool));
  for(let start=0;start<16;start+=4)assert.equal(new Set(out.slice(start,start+4).map(row=>row.id)).size,4,'Pool repeated before exhaustion');
  for(const n of [4,8,12])assert.notEqual(out[n].text,out[n-1].text,'Cycle repeated across its boundary');
  assert.equal(storage.reads,1,'History must not read localStorage per call/frame');
  assert.equal(storage.values.get('coh.save'),'unchanged-game-record');
  checks.push('complete no-repeat cycles; one storage read; gameplay record untouched');
}
{
  const storage=new MemoryStorage(),first=new NarrationMemory(storage,()=>0);
  first.choose('rest',pool);first.choose('rest',pool);
  const afterReload=new NarrationMemory(storage,()=>0);
  assert.equal(afterReload.choose('rest',pool).id,'c');
  assert.equal(afterReload.choose('rest',pool).id,'d');
  checks.push('reload continues the partially consumed pool');
}
{
  const memory=new NarrationMemory(null,()=>0);
  memory.choose('first',[{id:'x',text:'同一句。'}]);
  assert.equal(memory.choose('second',[{id:'x',text:'同一句。'},{id:'y',text:'换一句。'}]).id,'y');
  assert.equal(memory.choose('second',[{id:'x',text:'同一句。'},{id:'y',text:'换一句。'}]).id,'x');
  assert.equal(memory.choose('only',[{id:'z',text:'同一句。'}]).id,'z');
  checks.push('cross-pool text collision avoided where possible; single-row pool remains usable');
}
{
  const memory=new NarrationMemory(null,()=>0);
  memory.choose('evolving',pool.slice(0,3));
  const changed=[pool[0],pool[2],pool[3]];
  assert.equal(memory.choose('evolving',changed).id,'c');
  assert.equal(memory.choose('evolving',changed).id,'d');
  assert.throws(()=>memory.choose('empty',[]));
  assert.throws(()=>memory.choose('duplicate',[pool[0],pool[0]]));
  checks.push('removed/new rows preserve surviving history; invalid pools fail explicitly');
}
{
  for(const corrupt of ['broken','null','[]','{"version":2}','{"version":1,"scopes":{"rest":{"used":[7],"lastText":"x"}},"lastText":""}']){
    const storage=new MemoryStorage();storage.values.set(NARRATION_STORAGE_KEY,corrupt);
    const memory=new NarrationMemory(storage,()=>0);
    assert.equal(memory.choose('rest',pool).id,'a');assert.equal(memory.choose('rest',pool).id,'b');
  }
  const denied={getItem(){throw Error('denied');},setItem(){throw Error('denied');}};
  const memory=new NarrationMemory(denied,()=>0);
  assert.equal(memory.choose('rest',pool).id,'a');assert.equal(memory.choose('rest',pool).id,'b');
  const storage=new MemoryStorage();storage.setItem=()=>{throw Error('quota');};
  const quota=new NarrationMemory(storage,()=>0);
  assert.equal(quota.choose('rest',pool).id,'a');assert.equal(quota.choose('rest',pool).id,'b');
  checks.push('malformed/denied/quota storage degrades to session history without presentation failure');
}
{
  const csv='id,pool,text\na,haven.rest,石头还是冷的。\nb,chaos.1,脚边有一层细灰。\n';
  const generated=atmosphereSource(csv);
  assert(generated.includes('"haven.rest" | "chaos.1"'));
  for(const bad of [
    'id,pool,text\n',
    'id,pool,text\na,haven.rest,甲\na,chaos.1,乙',
    'id,pool,text\na,haven.rest,',
    'id,pool,text\na,haven.rest, 甲',
    'id,pool,text\na,haven.rest,'+'甲'.repeat(41),
    'id,pool,text\na,haven..rest,甲',
    'id,pool,text\na,haven.rest,甲,乙',
  ])assert.throws(()=>atmosphereSource(bad));
  generateAtmosphereCopy(root,path.join(root,'src/generated'),true);
  const real=fs.readFileSync(path.join(root,'data/atmosphere-lines.csv'),'utf8');
  const pools=new Set(real.trim().split(/\r?\n/).slice(1).map(line=>line.split(',')[1]));
  const expectedPools=[
    'haven.rest','haven.core','haven.storage','haven.purifier','haven.defense','haven.growth','haven.rift','haven.arrival','haven.return','haven.return-lost',
    'rift.entry.generic','rift.quiet.generic','chaos.1','chaos.2','chaos.3','result.return','result.empty','result.death','result.abandon','impact.held','impact.damaged','impact.broken',
    ...['ash-strata','crystal-fibre','ivory-basin','carmine-lacquer','cobalt-gold'].flatMap(world=>[`rift.entry.${world}`,`rift.quiet.${world}`]),
  ];
  for(const name of expectedPools)assert(pools.has(name),`Missing hooked narrative pool ${name}`);
  for(const name of pools)assert(expectedPools.includes(name),`Unknown/unhooked narrative pool ${name}`);
  checks.push('CSV schema, stable unique IDs, 40-character limit, generated parity and every declared presentation pool');
}
console.log(JSON.stringify({status:'PASS',checks:checks.length,details:checks},null,2));
