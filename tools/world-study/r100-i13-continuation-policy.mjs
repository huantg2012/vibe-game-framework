/** Public-input helpers for the separately authorized I13 continuation.
 * All candidates are already owned/revealed or normally observed. No game data
 * or hidden subject lookup is introduced here.
 */
import assert from 'node:assert/strict';

export function publicAbility(item) {
 const text = item.description ?? '';
 const number = expression => Number(text.match(expression)?.[1] ?? 0);
 if (/探查/.test(text)) return {family:'survey',power:number(/探查(\d+)格/)*32};
 if (/短冲/.test(text)) return {family:'dash',power:number(/短冲(\d+)像素/)};
 if (/压制|压住.*污染源/.test(text)) return {family:'suppress',power:number(/(\d+(?:\.\d+)?)秒/)};
 if (/停住.*敌/.test(text)) return {family:'solidify',power:number(/(\d+(?:\.\d+)?)秒/)};
 if (/消声/.test(text)) return {family:'silence',power:number(/(\d+(?:\.\d+)?)秒/)};
 return null;
}
export function sameRoute(left, right) {
 return left.target.id === right.target.id
  && JSON.stringify(left.points) === JSON.stringify(right.points);
}
export function relevantRemembered(candidates, route) {
 return candidates.filter(candidate => route.points.some(point =>
  Math.hypot(point.x-candidate.position.x,point.y-candidate.position.y)<170));
}
export function chooseOwnedPreparation(owned, slot, preparation, freshOrder) {
 const rule=slot.key===null?preparation.passive:preparation.active[slot.index];
 if(!rule)return null;
 const eligible=owned.items.filter(item=>item.kind==='contaminant'&&item.canEquip&&item.toolSlots?.includes(slot.id));
 if(rule.exactId) {
  const exact=eligible.find(item=>item.id===rule.exactId);
  if(exact)return exact;
  if(rule.exactOnly)return null;
 }
 const candidates=eligible.filter(item=>{
  if(rule.name)return item.name===rule.name;
  const ability=publicAbility(item);
  return ability?.family===rule.family&&ability.power>=(rule.minimumPower??0);
 });
 candidates.sort((a,b)=>(freshOrder.get(a.id)??Infinity)-(freshOrder.get(b.id)??Infinity));
 return candidates[0]??null;
}
export function budgetPermission({used, cap, family, facts, nextReady=true}) {
 if(used<cap&&nextReady)return {allowed:true,mode:'normal',reason:'within-preregistered-slot-budget'};
 const close=facts?.enemies?.filter(enemy=>Math.hypot(enemy.position.x-facts.position.x,enemy.position.y-facts.position.y)<=65)??[];
 const emergency=family==='dash'&&close.some(enemy=>enemy.attack==='windup'||enemy.attack==='active');
 return {allowed:emergency,mode:emergency?'emergency':'blocked',reason:emergency?'visible-near-attack-windup-or-active':'slot-budget-reserved-for-next-trip',evidence:close};
}
export function checkPublicPolicy() {
 const example={description:'探查4格内目标位置'};
 assert.deepEqual(publicAbility(example),{family:'survey',power:128});
 assert.deepEqual(publicAbility({description:'沿可走地面短冲48像素'}),{family:'dash',power:48});
 assert.equal(publicAbility({description:'供奉完成后揭晓'}),null);
 const route={target:{id:'known'},points:[{x:1,y:2}]};
 assert(sameRoute(route,route));assert(!sameRoute(route,{...route,points:[{x:2,y:2}]}));
 assert.equal(budgetPermission({used:1,cap:1,family:'survey',facts:{enemies:[]}}).allowed,false);
 const facts={position:{x:0,y:0},enemies:[{position:{x:30,y:0},attack:'windup'}]};
 assert.equal(budgetPermission({used:1,cap:1,family:'dash',facts}).mode,'emergency');
 assert.equal(budgetPermission({used:1,cap:1,family:'dash',facts:{...facts,enemies:[{position:{x:66,y:0},attack:'windup'}]}}).allowed,false);
 assert.equal(budgetPermission({used:0,cap:1,family:'dash',facts}).mode,'normal');
 return {status:'pass',scope:'public-family parsing, route comparison, normal per-slot cap, actual visible-attack emergency admission'};
}
if(process.argv[1]?.endsWith('r100-i13-continuation-policy.mjs')&&process.argv.includes('--self-check'))console.log(JSON.stringify(checkPublicPolicy()));
