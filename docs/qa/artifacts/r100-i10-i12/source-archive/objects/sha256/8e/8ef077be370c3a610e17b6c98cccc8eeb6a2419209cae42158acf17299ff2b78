/** JSON-only continuation of current tool effects; V1 checkpoints may omit this section. */
import type { Vector2 } from '@/types/game-types';
import type { DissolveState, GlitchBlock, StepFadeState } from '@/systems/tool-vfx';
import { validateBodyEchoRuntimeState, type BodyEchoRuntimeState } from '@/systems/tool-body-echo';
import { runtimeInteger, runtimeNumber, runtimeRecord, runtimeStrings, runtimeVector } from '@/systems/ai/runtime-validation';
import { CONTAMINANT_DATA } from '@/generated/contaminant-data';
export interface ToolExtendedRuntimeState {
  readonly indicators?: {enemyId:string;blinkPhase:number;sources:{tag:string;mult:number;suppressed:boolean}[]}[];
  readonly freezes: readonly { enemyId:string; remainingMs:number; lastPos:Vector2; dissolving:boolean;
    dissolveBlocks:GlitchBlock[]; dissolve:DissolveState; echo:BodyEchoRuntimeState|null; controlActive:boolean }[];
  readonly delays: readonly {hostId:string; position:Vector2; remainingMs:number; source:string}[];
  readonly combusts: readonly {hostId:string; position:Vector2; remainingMs:number; source:string;
    blocks:GlitchBlock[]; dissolving:boolean; dissolve:DissolveState}[];
  readonly marks: readonly {enemyId:string; position:Vector2; remainingMs:number; collapsing:boolean;
    collapseFade:StepFadeState; echo:BodyEchoRuntimeState|null}[];
  readonly tracking: readonly {enemyId:string; sampledAt:number|null; lastVisiblePosition:Vector2;
    hasVisiblePosition:boolean; spent:boolean; echo:BodyEchoRuntimeState|null}[];
  readonly retrogradeEquipped:boolean;
  readonly mirrors: readonly {position:Vector2; groundY:number; remainingMs:number; source:string;
    shattering:boolean; shatterBlocks:GlitchBlock[]; shatterDissolve:DissolveState; echo:BodyEchoRuntimeState|null}[];
  readonly expand: {remainingMs:number; stiffnessMs:number; phase:'stiffness'; jitterPhase:number; echo:BodyEchoRuntimeState|null}|null;
  readonly stuns: readonly {enemyId:string; remainingMs:number; tag:'echo'}[];
  readonly pulses: readonly {position:Vector2; remainingMs:number}[];
  readonly bursts: readonly {position:Vector2; remainingMs:number; blocks:GlitchBlock[]; echo:BodyEchoRuntimeState|null}[];
  readonly abyss: {remainingMs:number; enemies:Vector2[]; nodes:Vector2[]; cores:Vector2[]};
  readonly scatter: {triggersRemaining:number; active:boolean; suppressedEnemyIds:string[]};
}
function echo(value:unknown):boolean {return value===null||validateBodyEchoRuntimeState(value);}
function id(value:unknown):value is string{return typeof value==='string'&&value.length>0&&value.length<1024;}
function blocks(value:unknown, max:number):boolean{return Array.isArray(value)&&value.length<=max&&value.every(b=>runtimeRecord(b)&&runtimeNumber(b.dx)&&runtimeNumber(b.dy)&&runtimeNumber(b.size,0,1024)&&runtimeNumber(b.alphaMult,0,1));}
function dissolve(value:unknown,steps:number,interval:number):boolean{return runtimeRecord(value)&&value.stepsTotal===steps&&value.stepIntervalMs===interval&&runtimeInteger(value.stepsDone,0,steps-1)&&runtimeNumber(value.timerMs,0,interval)&&typeof value.jitterPending==='boolean';}
function fade(value:unknown):boolean{return runtimeRecord(value)&&Array.isArray(value.alphaSteps)&&value.alphaSteps.length===3&&value.alphaSteps.every((v,i)=>v===1-i/2)&&runtimeInteger(value.stepIndex,0,1)&&value.stepIntervalMs===90&&runtimeNumber(value.timerMs,0,90);}
export function validateToolExtendedRuntimeState(value:unknown,elapsedMs:number,controlSerial:number):value is ToolExtendedRuntimeState {
 if(!runtimeRecord(value)||typeof value.retrogradeEquipped!=='boolean')return false;
 if(value.indicators!==undefined&&(!Array.isArray(value.indicators)||value.indicators.length>4096||!value.indicators.every(row=>runtimeRecord(row)&&id(row.enemyId)&&runtimeNumber(row.blinkPhase,0)&&Array.isArray(row.sources)&&row.sources.length<=16&&row.sources.every(s=>runtimeRecord(s)&&id(s.tag)&&runtimeNumber(s.mult,0,1)&&typeof s.suppressed==='boolean'))))return false;
 for(const key of ['freezes','delays','combusts','marks','tracking','mirrors','stuns','pulses','bursts'])if(!Array.isArray(value[key])||(value[key] as unknown[]).length>512)return false;
 const sourceIds=new Set<string>();
 const source=(x:unknown):boolean=>{if(!id(x)||!/^tool:[1-9][0-9]*$/.test(x)||sourceIds.has(x)||!runtimeInteger(Number(x.slice(5)),1,controlSerial))return false;sourceIds.add(x);return true;};
 for(const r of value.freezes as unknown[])if(!runtimeRecord(r)||!id(r.enemyId)||!runtimeVector(r.lastPos)||typeof r.dissolving!=='boolean'||typeof r.controlActive!=='boolean'||(r.dissolving&&r.controlActive)||!runtimeNumber(r.remainingMs,-Infinity,CONTAMINANT_DATA.solidify.toolDurationMs)||(!r.dissolving&&r.remainingMs<=0)||!blocks(r.dissolveBlocks,7)||!dissolve(r.dissolve,2,90)||!echo(r.echo))return false;
 for(const r of value.delays as unknown[])if(!runtimeRecord(r)||!id(r.hostId)||!runtimeVector(r.position)||!source(r.source)||!runtimeNumber(r.remainingMs,-450,CONTAMINANT_DATA.delay.toolDurationMs))return false;
 for(const r of value.combusts as unknown[])if(!runtimeRecord(r)||!id(r.hostId)||!runtimeVector(r.position)||!source(r.source)||!runtimeNumber(r.remainingMs,Number.MIN_VALUE,CONTAMINANT_DATA.combust.toolDurationMs)||r.dissolving!==false||!blocks(r.blocks,9)||!dissolve(r.dissolve,3,90))return false;
 for(const r of value.marks as unknown[])if(!runtimeRecord(r)||!id(r.enemyId)||!runtimeVector(r.position)||!runtimeNumber(r.remainingMs,Number.MIN_VALUE,CONTAMINANT_DATA.retrograde.toolDurationMs)||r.collapsing!==false||!fade(r.collapseFade)||!echo(r.echo))return false;
 const tracked=new Set<string>();for(const r of value.tracking as unknown[]) {if(!runtimeRecord(r)||!id(r.enemyId)||tracked.has(r.enemyId)||!runtimeVector(r.lastVisiblePosition)||!(r.sampledAt===null||runtimeNumber(r.sampledAt,0,elapsedMs))||typeof r.spent!=='boolean'||typeof r.hasVisiblePosition!=='boolean'||!echo(r.echo))return false;tracked.add(r.enemyId);}
 for(const r of value.mirrors as unknown[])if(!runtimeRecord(r)||!source(r.source)||!runtimeVector(r.position)||!runtimeNumber(r.groundY)||!runtimeNumber(r.remainingMs,r.shattering ? -Infinity : Number.MIN_VALUE,CONTAMINANT_DATA.mirror.toolDurationMs)||typeof r.shattering!=='boolean'||!blocks(r.shatterBlocks,8)||!(r.shattering?dissolve(r.shatterDissolve,2,75):dissolve(r.shatterDissolve,1,1))||!echo(r.echo))return false;
 const e=value.expand;if(e!==null&&(!runtimeRecord(e)||e.phase!=='stiffness'||e.stiffnessMs!==CONTAMINANT_DATA.expand.toolDurationMs||!runtimeNumber(e.remainingMs,Number.MIN_VALUE,e.stiffnessMs)||!runtimeNumber(e.jitterPhase)||!echo(e.echo)))return false;
 const stunned=new Set<string>();for(const r of value.stuns as unknown[]){if(!runtimeRecord(r)||!id(r.enemyId)||stunned.has(r.enemyId)||r.tag!=='echo'||!runtimeNumber(r.remainingMs,Number.MIN_VALUE,CONTAMINANT_DATA.echo.toolDurationMs))return false;stunned.add(r.enemyId);}
 for(const r of value.pulses as unknown[])if(!runtimeRecord(r)||!runtimeVector(r.position)||!runtimeNumber(r.remainingMs,Number.MIN_VALUE,350))return false;
 for(const r of value.bursts as unknown[])if(!runtimeRecord(r)||!runtimeVector(r.position)||!runtimeNumber(r.remainingMs,Number.MIN_VALUE,240)||!blocks(r.blocks,5)||!echo(r.echo))return false;
 const a=value.abyss;if(!runtimeRecord(a)||!runtimeNumber(a.remainingMs,0,CONTAMINANT_DATA.abyss.toolDurationMs))return false;
 for(const key of ['enemies','nodes','cores'])if(!Array.isArray(a[key])||(a[key] as unknown[]).length>4096||!(a[key] as unknown[]).every(runtimeVector))return false;
 const s=value.scatter;return runtimeRecord(s)&&runtimeInteger(s.triggersRemaining,0,1000)&&typeof s.active==='boolean'&&s.active===(s.triggersRemaining>0)&&runtimeStrings(s.suppressedEnemyIds,4096);
}
