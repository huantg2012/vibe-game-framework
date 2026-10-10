/** Deterministic presentation-history and CSV contract regression. */
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import {fileURLToPath} from 'node:url';
import {NarrationMemory,NARRATION_STORAGE_KEY} from '../../src/narrative/narration-memory.ts';
import {atmosphereSource,atmosphereSources,generateAtmosphereCopy,PRODUCTION_ATMOSPHERE_POOLS} from './generate.mjs';
import {PREPARATION_NARRATION_POOLS} from '../../src/generated/preparation-narration-data.ts';

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
  assert.deepEqual(PRODUCTION_ATMOSPHERE_POOLS,expectedPools,'The precise production allowlist must not expand with prepared content');
  const expectedPreparationPools=[
    'prepare.baseline.low','prepare.baseline.medium','prepare.baseline.severe',
    'prepare.new_weapon.low','prepare.new_weapon.medium','prepare.new_weapon.severe',
    'prepare.ready_item','prepare.body_growth','prepare.return_gain','prepare.return_loss','prepare.loss_new_weapon','prepare.worn_weapon',
  ];
  assert.deepEqual(Object.keys(PREPARATION_NARRATION_POOLS).sort(),[...expectedPreparationPools].sort());
  for(const name of expectedPools)assert(pools.has(name),`Missing hooked narrative pool ${name}`);
  for(const name of expectedPreparationPools)assert(pools.has(name),`Missing prepared narrative pool ${name}`);
  for(const name of pools)assert(expectedPools.includes(name)||expectedPreparationPools.includes(name),`Unknown/unregistered narrative pool ${name}`);
  const metadata=fs.readFileSync(path.join(root,'data/preparation-narration-pools.csv'),'utf8');
  const sources=atmosphereSources(real,metadata);
  const productionCsv=real.trim().split(/\r?\n/).filter((line,index)=>index===0||expectedPools.includes(line.split(',')[1])).join('\n');
  assert.equal(sources.atmosphere,atmosphereSource(productionCsv),'Prepared rows must never enter production AtmospherePool or ATMOSPHERE_LINES');
  checks.push('CSV schema, stable IDs, 40-character limit and parity; exact 32 production pools remain isolated from 12 prepared pools');

  const replaceMetadata=(pool,transform)=>metadata.trim().split(/\r?\n/).map(line=>line.startsWith(`${pool},`)?transform(line.split(',')).join(','):line).join('\n');
  const baseline='prepare.baseline.low',ready='prepare.ready_item';
  const badMetadata=[
    ['metadata header',metadata.replace('pool,grades,context,status','pool,context,grades,status'),/header/],
    ['missing metadata',metadata.trim().split(/\r?\n/).filter(line=>!line.startsWith(`${ready},`)).join('\n'),/Missing preparation metadata/],
    ['duplicate metadata',metadata+'\n'+metadata.trim().split(/\r?\n/)[1],/Duplicate preparation pool/],
    ['unknown prefix',metadata.replaceAll(baseline,'prepare.baseline.unknown'),/Unknown preparation pool/],
    ['production collision',metadata.replaceAll(baseline,'haven.rest'),/Unknown preparation pool/],
    ['empty grades',replaceMetadata(ready,row=>[row[0],'',row[2],row[3]]),/grades must/],
    ['unknown grade',replaceMetadata(ready,row=>[row[0],'extreme',row[2],row[3]]),/grades must/],
    ['duplicate grade',replaceMetadata(ready,row=>[row[0],'low|low',row[2],row[3]]),/grades must/],
    ['wrong grade context',replaceMetadata(baseline,row=>[row[0],'medium',row[2],row[3]]),/grade does not match/],
    ['multi-grade baseline',replaceMetadata(baseline,row=>[row[0],'low|medium',row[2],row[3]]),/grade does not match/],
    ['wrong known context',replaceMetadata(ready,row=>[row[0],row[1],'body_growth',row[3]]),/context does not match/],
    ['unknown context',replaceMetadata(ready,row=>[row[0],row[1],'anything',row[3]]),/context does not match/],
    ['unearned production status',replaceMetadata(ready,row=>[row[0],row[1],row[2],'hooked']),/must remain prepared-only/],
  ];
  for(const [label,bad,error] of badMetadata)assert.throws(()=>atmosphereSources(real,bad),error,label);
  const rows=real.trim().split(/\r?\n/),preparedRows=rows.filter(line=>line.split(',')[1]===baseline);
  const setFirstText=text=>rows.map(line=>line===preparedRows[0]?[...line.split(',').slice(0,2),text].join(','):line).join('\n');
  const badContent=[
    ['orphan metadata',rows.filter(line=>line.split(',')[1]!==baseline).join('\n'),/Empty\/orphan preparation pool/],
    ['short pool',rows.filter(line=>line.split(',')[1]!==baseline||preparedRows.slice(0,5).includes(line)).join('\n'),/at least six/],
    ['unregistered pool',real+'\nextra_test,prepare.unregistered,我还站在这里。',/Unknown\/unregistered narrative pool/],
    ['missing production pool',rows.filter(line=>line.split(',')[1]!=='haven.rest').join('\n'),/Missing hooked narrative pool/],
    ['non-first-person text',setFirstText('灯照着鞋尖。'),/first person/],
    ['exclamation',setFirstText('我还站在这里！'),/not allowed/],
    ['question',setFirstText('我还站在这里？'),/not allowed/],
    ['ellipsis',setFirstText('我还站在这里……'),/not allowed/],
    ['ASCII ellipsis',setFirstText('我还站在这里...'),/not allowed/],
    ['punctuation-only variation',setFirstText(preparedRows[1].split(',')[2].replace(/[\p{P}\p{S}\s]/gu,'')+'。'),/duplicate preparation text/],
    ['overlong preparation text',setFirstText('我'+'甲'.repeat(40)),/1–40 characters/],
  ];
  for(const [label,bad,error] of badContent)assert.throws(()=>atmosphereSources(bad,metadata),error,label);
  checks.push(`${badMetadata.length+badContent.length} negative fixtures reject semantic metadata mismatch, orphan/short/unknown pools and invalid self-talk`);
}
{
  for(const [name,definition] of Object.entries(PREPARATION_NARRATION_POOLS)){
    assert.equal(definition.status,'prepared-only');
    const rows=definition.lines,storage=new MemoryStorage(),out=[];
    let memory=new NarrationMemory(storage,()=>0);
    for(let n=0;n<rows.length*3;n++){
      out.push(memory.choose(`prepared-check:${name}`,rows));
      if(n===2)memory=new NarrationMemory(storage,()=>0);
    }
    for(let start=0;start<out.length;start+=rows.length)assert.equal(new Set(out.slice(start,start+rows.length).map(row=>row.id)).size,rows.length,`${name}: repeated before exhaustion or reload lost history`);
    for(const boundary of [rows.length,rows.length*2])assert.notEqual(out[boundary].text,out[boundary-1].text,`${name}: repeated at cycle boundary`);
    assert.equal(storage.values.get('coh.save'),'unchanged-game-record');
    assert.equal(storage.reads,2);
  }
  checks.push('all prepared pools run three no-replacement cycles through existing NarrationMemory, including reload and cycle-boundary avoidance; pure data test only');
}
{
  const scan=directory=>{
    for(const entry of fs.readdirSync(directory,{withFileTypes:true})){
      const file=path.join(directory,entry.name);
      if(entry.isDirectory())scan(file);
      else if(/\.[cm]?[jt]sx?$/.test(entry.name)&&entry.name!=='preparation-narration-data.ts'){
        assert(!fs.readFileSync(file,'utf8').includes('preparation-narration-data'),`Prepared content unexpectedly consumed by ${path.relative(root,file)}`);
      }
    }
  };
  scan(path.join(root,'src'));
  scan(path.join(root,'docs/art/demos/preparation-threat-sample'));
  checks.push('prepared registry has no game or sample consumer; no runtime integration is claimed');
}
console.log(JSON.stringify({status:'PASS',checks:checks.length,details:checks},null,2));
