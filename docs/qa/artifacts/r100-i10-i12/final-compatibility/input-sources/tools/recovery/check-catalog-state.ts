/** Authentic catalog frame + controlled effect compositions for the complete boundary.
 * This validates saved ownership, not natural acquisition or combat balance. */
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { CATALOG_ITEMS } from '../../src/generated/contaminant-catalog-data';
import { getCatalogAbilityByDefinition } from '../../src/systems/contaminant-catalog';
import type { CatalogEffectState } from '../../src/systems/catalog-ability-runtime';
Object.defineProperty(globalThis, 'localStorage', { configurable:true, value:{getItem:()=> 'zh-CN'} });
const { validateRiftRecoveryState } = await import('../../src/systems/rift-recovery-state');
const baseline = JSON.parse(readFileSync(new URL('./fixtures/catalog-active.json', import.meta.url),'utf8'));
const copy = () => structuredClone(baseline);
const accept = (f:any) => validateRiftRecoveryState(f.checkpoint.state,f.inventory,f.checkpoint.elapsedMs);
assert(accept(baseline),'original keyboard run is admissible');
let badCases=0;
const reject=(change:(f:any)=>void,label:string,source=baseline)=> {const f=structuredClone(source);change(f);assert(!accept(f),label);badCases++;};
reject(f=>{delete f.inventory.run.dropPlan;},'new run requires locked plan');
reject(f=>{f.checkpoint.state.tools.catalog.runId='';},'new catalog cannot claim legacy anonymous run');
reject(f=>{f.checkpoint.state.search.nodes.find((n:any)=>n.revealedItem).revealedItem.contaminant.catalog.acquiredOrdinal=1;},'birth snapshot keeps ordinal zero');
reject(f=>{f.checkpoint.state.search.nodes.find((n:any)=>n.revealedItem).revealedItem.contaminant.quality='fine';},'cached quality cannot diverge from original draw');
reject(f=>{f.inventory.run.dropPlan.entries.find((n:any)=>n.nodeId==='CTM_NODE_02').contaminant.catalog.definitionId='sealed_hourglass';},'node cache binds full original identity');
reject(f=>{delete f.inventory.run.catalogVersion;delete f.inventory.run.dropPlan;},'legacy no-plan run cannot manufacture new catalog cache');
reject(f=>{f.checkpoint.state.tools.catalog.controlRejections=[{enemyId:'foreign',remainingMs:350}];},'rejection visuals cannot reveal a foreign entity');

function withEffect(definitionId:string) {
  const f=copy(), s=f.checkpoint.state, ability=getCatalogAbilityByDefinition(definitionId,'contaminant-v1')!;
  const actionId='catalog:controlled:1', sourceInstanceId='consumed-controlled-item';
  const enemy=s.ai.enemies[0], host=s.world.hosts.hosts[0];
  const p={...s.player.position};
  const family=ability.familyId;
  const effect:CatalogEffectState={effectId:'ability:1',actionId,sourceInstanceId,definitionId,catalogVersion:'contaminant-v1',
    resolvedParams:ability,startTime:s.tools.elapsedMs,remainingTime:ability.durationMs,origin:p,position:{...p},
    targetId:family==='solidify'?enemy.id:family==='suppress'?host.id:null,controlActive:family==='solidify',pulseElapsedMs:0,
    line:family==='tripwire'?{pointA:{x:p.x-32,y:p.y+32},pointB:{x:p.x+32,y:p.y+32}}:null,
    affectedEnemyIds:[],previousPositions:[],stops:[],snapshot:family==='survey'?{enemyPositions:[],nodePositions:[],corePositions:[]}:null,echo:null};
  s.tools.catalog.serial=1;s.tools.catalog.completedActions=[actionId];s.tools.catalog.effects=[effect];
  f.inventory.run.carriedOutIds.push(sourceInstanceId);f.inventory.run.destroyedIds.push(sourceInstanceId);
  f.inventory.run.actionReceipts[actionId]={itemId:sourceInstanceId,broken:true,usesLeft:0,definitionId,catalogVersion:'contaminant-v1'};
  if(family==='silence'){s.ai.hearingSuppressed=true;s.ai.playerActionSilenced=true;}
  if(family==='image_lure')s.ai.visualDecoys=[[effect.effectId,{...p}]];
  if(family==='suppress')s.world.hosts.controls=[[host.id,{suppressions:[[effect.effectId,ability.durationMs]],delays:[],recovery:'none',paintInflated:false,protectionRemainingMs:0}]];
  if(family==='dash')s.player.inputEnabled=false;
  return f;
}
let definitions=0;
for(const row of Object.values(CATALOG_ITEMS)) {
  if(row.slot!=='active')continue;
  const f=withEffect(row.id);assert(accept(f),`${row.id} survives missing final-use carrier`);definitions++;
  reject(b=>{delete b.inventory.run.actionReceipts['catalog:controlled:1'];},'no receipt means no effect',f);
  reject(b=>{b.inventory.run.actionReceipts['catalog:controlled:1'].definitionId='unknown';},'receipt cannot claim another item definition',f);
  reject(b=>{b.checkpoint.state.tools.catalog.effects[0].resolvedParams.paramValue+=1;},'resolved params version locked',f);
  reject(b=>{b.inventory.run.destroyedIds=[];},'missing source needs broken receipt and destroyed ledger',f);
}
const frozen=withEffect('sealed_hourglass');
reject(f=>{f.inventory.run.catalogVersion='legacy-v1';},'legacy expedition cannot host catalog active effects',frozen);
reject(f=>{f.inventory.run.combatRulesVersion=1;f.checkpoint.state.world.hosts.controls=[[f.checkpoint.state.world.hosts.hosts[0].id,{suppressions:[],delays:[],recovery:'none',paintInflated:false,protectionRemainingMs:2000}]];},'old combat rules cannot hydrate new Host immunity');
reject(f=>{f.inventory.run.combatRulesVersion=1;f.checkpoint.state.ai.enemies[0].controlProtectionRemainingMs=2000;},'old combat rules cannot hydrate new AI immunity');
reject(f=>{f.checkpoint.state.tools.catalog.effects[0].targetId='foreign';},'freeze source roster',frozen);
reject(f=>{f.checkpoint.state.ai.enemies[0].controlProtectionRemainingMs=2000;},'simultaneous live freeze and immunity impossible',frozen);
const suppression=withEffect('cold_ash_pipe');
reject(f=>{f.checkpoint.state.world.hosts.controls=[];},'suppression must have Host authoritative source',suppression);
reject(f=>{f.checkpoint.state.world.hosts.controls[0][1].suppressions[0][0]='ability:2';},'Host and effect source IDs must match',suppression);
reject(f=>{f.checkpoint.state.world.hosts.controls[0][1].suppressions[0][1]=999999;},'Host lifetime cannot exceed authored value',suppression);
const silence=withEffect('scorched_scarf');
reject(f=>{f.checkpoint.state.ai.playerActionSilenced=false;},'real AI action gate must match live ability',silence);
const line=withEffect('wooden_thread_spool');
reject(f=>{const e=f.checkpoint.state.tools.catalog.effects[0];e.affectedEnemyIds=['foreign'];e.stops=[{enemyId:'foreign',remainingMs:1}];},'crossing cannot invent enemy',line);
console.log(`PASS catalog frame: original browser save, ${definitions} final-use parameter definitions, ${badCases} corruption counterexamples`);
