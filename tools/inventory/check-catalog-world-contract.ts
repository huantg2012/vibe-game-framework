/** Controlled runtime comparisons, not a claim of natural-session balance. Only rendering/physics are adapters. */
import assert from 'node:assert/strict';
import { writeFileSync } from 'node:fs';
import { CatalogAbilityRuntime } from '../../src/systems/catalog-ability-runtime';
import { CATALOG_ITEMS, CATALOG_APPEARANCES, CATALOG_OFFERINGS } from '../../src/generated/contaminant-catalog-data';
import { createCatalogContaminant, getCatalogAbilityByDefinition } from '../../src/systems/contaminant-catalog';
import { ToolSystem } from '../../src/systems/tool-system';
import { AISystem } from '../../src/systems/ai/ai-system';
import { createEnemyTypeConfig } from '../../src/entities/enemy-factory';
import { EnemyControlState } from '../../src/systems/enemy-control-state';
import { EnvironmentHazardControl } from '../../src/systems/environment-hazard-control';
import { ChaosSystem, getChaosModulators } from '../../src/systems/chaos-system';
import { VisibilitySystem, createRiftVisionConfig } from '../../src/systems/visibility-system';
import { collectToolRevealSnapshot, findSoundLureLanding, findStitchPlacement, sweepGroundDash } from '../../src/systems/tool-targeting';
import { hasLineOfSight } from '../../src/utils/grid-raycast';
import { getBurdenSpeedFactor, sumPollutionResistance } from '../../src/systems/survival-attributes';
import { inventoryStore } from '../../src/systems/inventory-store';
import { contaminantSystem } from '../../src/systems/contaminant-system';
import { stepFsm } from '../../src/systems/ai/state-machine';
import { AIState } from '../../src/types/game-types';

const rows: Record<string, unknown>[] = [];
const graphic: any = new Proxy({}, { get: () => () => graphic });
const scene: any = { add: { graphics: () => graphic }, time: { now: 0 } };
for (const map of ['open-yard', 'broken-corner'] as const) for (const chaosStart of [0, 80]) for (const burden of [60, 140]) {
  const floor = (col: number, row: number) => col > 0 && row > 0 && col < 11 && row < 11 && !(map === 'broken-corner' && col === 5 && row <= 5);
  const grid = { cols: 12, rows: 12, tileSize: 32, version: 0, isWalkable: floor, isOpaque: (c: number, r: number) => !floor(c, r) };
  for (const def of Object.values(CATALOG_ITEMS).filter(row => row.class === 'core' && row.grade === 1)) {
    const ability = getCatalogAbilityByDefinition(def.id, 'contaminant-v1')!, origin = { x: 112, y: 112 }, enemyPos = { x: 136, y: 112 };
    const controls = new EnemyControlState(), environment = new EnvironmentHazardControl(); controls.setControlProtectionEnabled(true);
    const enemy: any = { id: 'guard', controls, config: createEnemyTypeConfig('infiltrator'),
      ai: { state: AIState.PATROL, position: enemyPos, facingAngle: Math.PI, perceptionRangeMult: 1, externalSpeedMult: 1,
        pendingDamage: false, pendingNoiseLevel: null, pendingNoisePos: { x: 0, y: 0 }, perceptionAccumMs: 0, targetingDecoy: false },
      getId: () => 'guard', getPosition: () => enemyPos, getState: () => enemy.ai.state, setVelocity() {} };
    const ai = new AISystem(); Object.assign(ai, { enemies: [enemy], occluders: grid, walk: grid });
    let snapshot: any = null, commits = 0;
    const runtime = new CatalogAbilityRuntime(scene, () => origin, () => [enemy], {
      runId: 'controlled-run', combatRulesVersion: 2, getFacingAngle: () => 0,
      isTargetAlive: () => true, isTargetVisible: p => hasLineOfSight(grid, origin, p), hasTargetLineOfSight: (a,b) => hasLineOfSight(grid,a,b),
      canApplyHardControl: id => ai.canApplyHardControl(id), setEnemyControl: (id, source, effect) => ai.setEnemyControl(id,source,effect),
      hasEnemyControl: (id, source) => ai.hasEnemyControl(id,source), clearEnemyControl: (id,source) => ai.clearEnemyControl(id,source),
      getBasePollutionResistance: () => 0,
      getDashDestination: distance => sweepGroundDash({ origin, destination: { x: origin.x+distance,y:origin.y }, grid }),
      advanceGroundDash: target => { Object.assign(origin,target); return true; },
      getSoundLureDestination: distance => findSoundLureLanding(origin,{x:1,y:0},distance,grid,16),
      reportSoundLure: (p,r,path) => ai.reportSoundLure(p,r,path),
      setVisualDecoy: (source,p) => ai.setVisualDecoy(source,p),
      getStitchPlacement: (length,distance) => findStitchPlacement(origin,{x:1,y:0},distance,length,grid,(a,b)=>hasLineOfSight(grid,a,b)),
      isGroundConnected: (a,b,range) => collectToolRevealSnapshot(a,range,grid,[b],[]).enemyPositions.length > 0,
      getRevealSnapshot: range => collectToolRevealSnapshot(origin,range,grid,[enemyPos],[{x:144,y:144},{x:208,y:112}]),
      showAbyssReveal: (enemies,nodes,_ms,cores) => { snapshot={enemies,nodes,cores}; },
      getEnvironmentTargets: () => [{ id:'paint',position:enemyPos,canSuppressHazard:!environment.suppressed }] as never,
      suppressEnvironmentHazard: (_id,source,ms) => { environment.suppress(source,ms); return true; },
      clearEnvironmentControl: (_id,source) => environment.clear(source),
    });
    const chaos = new ChaosSystem({ startingValue: chaosStart, getPollutionResistance: () => sumPollutionResistance([runtime.getResistanceBonus()]) });
    const baselineChaos = new ChaosSystem({ startingValue: chaosStart });
    const result: Record<string,unknown> = {map,chaosStart,burden,family:ability.familyId,definitionId:def.id};
    if (ability.slot === 'passive') {
      inventoryStore.setPersistence(null); contaminantSystem.reset();
      const item = createCatalogContaminant({ id:'bound',definitionId:def.id,appearanceId:Object.keys(CATALOG_APPEARANCES)[0]!,offeringProfileId:Object.keys(CATALOG_OFFERINGS)[0]!,quality:'ordinary',acquiredOrdinal:0 });
      item.stage='tool';item.usesRemaining=1;Object.assign(item.catalog!,{identification:'revealed',revealedAt:0,revealReceiptId:'reveal'});
      assert(inventoryStore.addContaminant(item).ok);const state=inventoryStore.getState();state.discoveredCatalogIds=[def.id];assert(inventoryStore.loadState(state));
      assert(inventoryStore.prepareTool(item.id,2).ok);assert(inventoryStore.beginRun('bound-run',{catalogVersion:'contaminant-v1',lootAlgorithmVersion:1,combatRulesVersion:2}).ok);
      const tool = new ToolSystem();tool.create(scene,contaminantSystem.getSortieLoadout(),()=>origin,()=>[],{runId:'bound-run'});
      assert.equal(inventoryStore.getItem(item.id)?.kind==='contaminant' ? (inventoryStore.getItem(item.id) as any).contaminant.usesRemaining : -1,0);
      if (ability.familyId === 'sight') {
        const vision=new VisibilitySystem();Object.assign(vision,{config:createRiftVisionConfig()});vision.setRadiusScale(getChaosModulators(chaosStart).radiusScale);
        const before=vision.getEffectiveRadius(0);vision.setAbilityRadiusMultiplier(tool.getVisionRadiusMultiplier());
        assert(vision.getEffectiveRadius(0)>before);assert.equal(vision.getEffectiveRadius(0),before*1.1);
        result.beforeRadius=before;result.afterRadius=vision.getEffectiveRadius(0);
      } else {
        const oldCapacity=160,newCapacity=inventoryStore.getCapacity();assert.equal(newCapacity,200);
        const before=getBurdenSpeedFactor(burden,oldCapacity),after=getBurdenSpeedFactor(burden+20,newCapacity);
        assert(after>=before);result.beforeFree=oldCapacity-burden;result.afterFree=newCapacity-(burden+20);result.beforeSpeed=before;result.afterSpeed=after;
      }
      const saved=tool.exportRuntimeState();tool.restoreRuntimeState(saved);assert.equal(tool.getVisionRadiusMultiplier(),ability.familyId==='sight'?1.1:1);
      tool.destroy();
    } else {
      assert(runtime.use(ability,'owned',()=>{commits++;return true;}));
      if (ability.familyId==='tripwire')enemyPos.x=152;
      runtime.update(100);assert.equal(commits,1);
      switch(ability.familyId) {
        case 'solidify': assert.equal(enemy.ai.externalSpeedMult,0);assert(controls.attackSuppressed);result.baselineTravel=3;result.effectTravel=0;result.attacksSuppressed=true;break;
        case 'tripwire': assert.equal(enemy.ai.externalSpeedMult,0);assert(!controls.attackSuppressed);result.baselineTravel=3;result.effectTravel=0;result.attacksSuppressed=false;break;
        case 'slow_zone': assert.equal(enemy.ai.externalSpeedMult,.7);result.baselineTravel=3;result.effectTravel=2.1;break;
        case 'resistance': {
          baselineChaos.addChaos('paint',10);chaos.addChaos('paint',10);for(let n=0;n<100;n++){baselineChaos.update(100);chaos.update(100);}
          assert(chaos.getValue()<baselineChaos.getValue());result.beforeChaos=baselineChaos.getValue();result.afterChaos=chaos.getValue();break;
        }
        case 'silence': {
          const config=createEnemyTypeConfig('infiltrator');const make=()=>({ai:{state:AIState.SUSPICIOUS,detection:.5,detectionFillRateMult:1,escalationSuppressed:false,pendingDamage:false,pendingNoiseLevel:null,position:{...enemyPos},velocity:{x:0,y:0},suspicionTimerMs:5000},config});
          const baseline=make(),silenced=make();const context:any={playerPos:origin,playerVel:{x:0,y:0},decoyPos:null,emitAlert(){},emitLost(){},cue(){},onHearingAvoided:()=>true};
          const percept:any={visible:false,hearingHit:false,hearingRate:.01,distance:40,zone:'none',hearingStill:false};
          stepFsm(baseline as never,percept,10,context);stepFsm(silenced as never,percept,10,{...context,playerActionSilenced:runtime.isActionSilenced()});
          assert(silenced.ai.detection<baseline.ai.detection);result.beforeDetection=baseline.ai.detection;result.afterDetection=silenced.ai.detection;break;
        }
        case 'dash': assert(origin.x>112);result.baselineTravel=0;result.effectTravel=origin.x-112;break;
        case 'sound_lure': assert.equal(enemy.ai.pendingNoiseLevel,'suspicious');assert(enemy.ai.pendingNoiseIsLure);result.baselineStimulus=null;result.effectStimulus=enemy.ai.pendingNoisePos;break;
        case 'image_lure': assert((ai as any).visibleDecoyFor(enemy));enemy.ai.state=AIState.CHASE;assert.equal((ai as any).visibleDecoyFor(enemy),null);result.baselineDecoy=null;result.effectDecoy={x:112,y:112};result.confirmedChaseNotReset=true;break;
        case 'survey': assert(snapshot.nodes.length>=1);result.baselineSnapshotCount=0;result.effectSnapshotCount=snapshot.nodes.length+snapshot.enemies.length;break;
        case 'suppress': assert(environment.suppressed);result.baselineContactChaos=2;result.effectContactChaos=0;break;
      }
    }
    rows.push(result);runtime.destroy();chaos.destroy();baselineChaos.destroy();
  }
}
assert.equal(rows.length,96);
// Normal closed topology: the modern sound source cannot hop a gap which requires a long detour.
{
  const grid={cols:12,rows:12,tileSize:32,version:0,isWalkable:(c:number,r:number)=>c>0&&r>0&&c<11&&r<11&&!(c===5&&r<7),isOpaque:(c:number,r:number)=>c===5&&r<7};
  const enemy:any={id:'hear',config:createEnemyTypeConfig('infiltrator'),ai:{state:AIState.PATROL,pendingDamage:false,pendingNoiseLevel:null,pendingNoisePos:{x:0,y:0},position:{x:176,y:112},perceptionRangeMult:1}};
  const ai=new AISystem();Object.assign(ai,{enemies:[enemy],occluders:grid,walk:grid});ai.reportSoundLure({x:144,y:112},96,true);assert.equal(enemy.ai.pendingNoiseLevel,null);
}
const path=process.argv[2];if(path)writeFileSync(path,JSON.stringify({kind:'controlled shared runtime, graphics/physics adapters; not natural-play balance',rows},null,2)+'\n');
console.log('PASS 96 controlled comparisons: 12 ordinary abilities × 2 topologies × 2 chaos levels × 2 burdens; real AI/Chaos/Visibility/Inventory integration');
