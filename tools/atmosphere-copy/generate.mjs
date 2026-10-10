/** CSV → typed presentation copy. No game state or gameplay random input. */
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import {fileURLToPath} from 'node:url';

const root=path.resolve(path.dirname(fileURLToPath(import.meta.url)),'../..');
export const PRODUCTION_ATMOSPHERE_POOLS=Object.freeze([
  'haven.rest','haven.core','haven.storage','haven.purifier','haven.defense','haven.growth','haven.rift','haven.arrival','haven.return','haven.return-lost',
  'rift.entry.generic','rift.quiet.generic','chaos.1','chaos.2','chaos.3','result.return','result.empty','result.death','result.abandon','impact.held','impact.damaged','impact.broken',
  ...['ash-strata','crystal-fibre','ivory-basin','carmine-lacquer','cobalt-gold'].flatMap(world=>[`rift.entry.${world}`,`rift.quiet.${world}`]),
]);
const preparationGrades=['low','medium','severe'];
const preparationContexts=['baseline','new_weapon','ready_item','body_growth','return_gain','return_loss','loss_new_weapon','worn_weapon'];
// These are semantic contracts, not defaults inferred from an arbitrary prefix.
const preparationContracts=Object.fromEntries([
  ...['baseline','new_weapon'].flatMap(context=>preparationGrades.map(grade=>[`prepare.${context}.${grade}`,{context,grade}])),
  ...preparationContexts.slice(2).map(context=>[`prepare.${context}`,{context}]),
]);

function readAtmospherePools(csv){
  const lines=csv.replace(/^\uFEFF/,'').split(/\r?\n/).filter(line=>line.trim());
  assert.equal(lines.shift(),'id,pool,text','atmosphere-lines.csv header must be id,pool,text');
  assert(lines.length,'atmosphere-lines.csv must not be empty');
  const ids=new Set(),pools=Object.create(null);
  for(const [index,line] of lines.entries()){
    const columns=line.split(',');assert.equal(columns.length,3,`atmosphere-lines.csv:${index+2}: use Chinese punctuation, not ASCII commas`);
    const [id,pool,text]=columns;
    assert(/^[a-z][a-z0-9_-]*$/.test(id)&&!ids.has(id),`Duplicate or invalid atmosphere id ${id}`);ids.add(id);
    assert(/^[a-z][a-z0-9_-]*(?:\.[a-z0-9][a-z0-9_-]*)*$/.test(pool),`Invalid atmosphere pool ${pool}`);
    assert(text===text.trim()&&text.length>0&&[...text].length<=40,`${id}: text must be 1–40 characters with no outside whitespace`);
    assert(!/[\u0000-\u001f\u007f]/.test(text),`${id}: control character in text`);
    (pools[pool]??=[]).push({id,text});
  }
  return pools;
}

function productionSource(pools){
  const poolNames=Object.keys(pools);
  return '// AUTO-GENERATED from data/atmosphere-lines.csv — DO NOT EDIT\n'
    + 'export interface AtmosphereLine { readonly id: string; readonly text: string }\n'
    + `export type AtmospherePool = ${poolNames.map(name=>JSON.stringify(name)).join(' | ')};\n`
    + `export const ATMOSPHERE_LINES: Readonly<Record<AtmospherePool, readonly AtmosphereLine[]>> = ${JSON.stringify(pools,null,2)};\n`;
}

/** Preserve the standalone CSV formatter for small schema fixtures. */
export function atmosphereSource(csv){
  return productionSource(readAtmospherePools(csv));
}

function readPreparationRegistry(csv){
  const lines=csv.replace(/^\uFEFF/,'').split(/\r?\n/).filter(line=>line.trim());
  assert.equal(lines.shift(),'pool,grades,context,status','preparation-narration-pools.csv header must be pool,grades,context,status');
  const registry=Object.create(null);
  for(const [index,line] of lines.entries()){
    const columns=line.split(',');
    assert.equal(columns.length,4,`preparation-narration-pools.csv:${index+2}: expected four columns`);
    const [pool,rawGrades,context,status]=columns;
    assert(Object.hasOwn(preparationContracts,pool),`Unknown preparation pool ${pool}`);
    assert(!Object.hasOwn(registry,pool),`Duplicate preparation pool ${pool}`);
    assert.equal(status,'prepared-only',`${pool}: content must remain prepared-only`);
    const grades=rawGrades.split('|');
    assert(grades.length&&grades.every(grade=>preparationGrades.includes(grade))&&new Set(grades).size===grades.length,`${pool}: grades must be a nonempty unique low|medium|severe subset`);
    const contract=preparationContracts[pool];
    assert.equal(context,contract.context,`${pool}: context does not match its semantic pool`);
    if(contract.grade)assert.deepEqual(grades,[contract.grade],`${pool}: grade does not match its semantic pool`);
    registry[pool]={grades,context,status};
  }
  for(const pool of Object.keys(preparationContracts))assert(Object.hasOwn(registry,pool),`Missing preparation metadata ${pool}`);
  return registry;
}

function preparationSource(registry){
  return '// AUTO-GENERATED from data/atmosphere-lines.csv + data/preparation-narration-pools.csv — DO NOT EDIT\n'
    + '// Prepared content only: no production selector or presentation hook imports this registry.\n'
    + `export type PreparationNarrationGrade = ${preparationGrades.map(value=>JSON.stringify(value)).join(' | ')};\n`
    + `export type PreparationNarrationContext = ${preparationContexts.map(value=>JSON.stringify(value)).join(' | ')};\n`
    + `export type PreparationNarrationPool = ${Object.keys(registry).map(value=>JSON.stringify(value)).join(' | ')};\n`
    + 'export interface PreparationNarrationLine { readonly id: string; readonly text: string }\n'
    + 'export interface PreparationNarrationPoolDefinition { readonly grades: readonly PreparationNarrationGrade[]; readonly context: PreparationNarrationContext; readonly status: "prepared-only"; readonly lines: readonly PreparationNarrationLine[] }\n'
    + `export const PREPARATION_NARRATION_POOLS: Readonly<Record<PreparationNarrationPool, PreparationNarrationPoolDefinition>> = ${JSON.stringify(registry,null,2)};\n`;
}

/** Validate both sources before writing either generated file. */
export function atmosphereSources(csv,preparationCsv){
  const pools=readAtmospherePools(csv),metadata=readPreparationRegistry(preparationCsv);
  const production=Object.create(null),prepared=Object.create(null),texts=new Map();
  for(const pool of PRODUCTION_ATMOSPHERE_POOLS)assert(Object.hasOwn(pools,pool),`Missing hooked narrative pool ${pool}`);
  for(const [pool,rows] of Object.entries(pools)){
    const isPrepared=Object.hasOwn(metadata,pool);
    assert(isPrepared||PRODUCTION_ATMOSPHERE_POOLS.includes(pool),`Unknown/unregistered narrative pool ${pool}`);
    if(!isPrepared){production[pool]=rows;continue;}
    assert(rows.length>=6,`${pool}: preparation pools need at least six complete lines`);
    for(const {id,text} of rows){
      assert(text.includes('我'),`${id}: preparation self-talk must be first person`);
      assert(!/[!?！？…]|\.{2,}/.test(text),`${id}: questions, exclamations and ellipses are not allowed`);
      const normalized=text.replace(/[\p{P}\p{S}\s]/gu,'');
      assert(!texts.has(normalized),`${id}: duplicate preparation text after punctuation removal (${texts.get(normalized)})`);
      texts.set(normalized,id);
    }
    prepared[pool]={...metadata[pool],lines:rows};
  }
  for(const pool of Object.keys(metadata))assert(Object.hasOwn(prepared,pool),`Empty/orphan preparation pool ${pool}`);
  return {atmosphere:productionSource(production),preparation:preparationSource(prepared)};
}

export function generateAtmosphereCopy(repository=root,output=path.join(repository,'src/generated'),check=false){
  const sources=atmosphereSources(
    fs.readFileSync(path.join(repository,'data/atmosphere-lines.csv'),'utf8'),
    fs.readFileSync(path.join(repository,'data/preparation-narration-pools.csv'),'utf8'),
  );
  for(const [name,source] of [['atmosphere-copy-data.ts',sources.atmosphere],['preparation-narration-data.ts',sources.preparation]]){
    const target=path.join(output,name);
    if(check)assert.equal(fs.readFileSync(target,'utf8'),source,`Stale ${name}: run npm run codegen`);
    else{fs.mkdirSync(output,{recursive:true});fs.writeFileSync(target,source);}
    console.log(`  ${name} (${check?'verified':'generated'})`);
  }
}
if(process.argv[1]&&path.resolve(process.argv[1])===fileURLToPath(import.meta.url)){
  assert(process.argv.slice(2).every(arg=>arg==='--check'),'Only --check is supported.');
  generateAtmosphereCopy(root,path.join(root,'src/generated'),process.argv.includes('--check'));
}
