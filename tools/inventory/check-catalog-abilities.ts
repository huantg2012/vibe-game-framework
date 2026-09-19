/** I28 runtime contract: authored items -> real handlers, continuous geometry and exact continuation. */
import assert from 'node:assert/strict';
import { CATALOG_ITEMS } from '../../src/generated/contaminant-catalog-data';
import { getCatalogAbilityByDefinition } from '../../src/systems/contaminant-catalog';
import { CatalogAbilityRuntime, validateCatalogAbilityRuntimeState } from '../../src/systems/catalog-ability-runtime';
import { EnemyControlState } from '../../src/systems/enemy-control-state';
import { EnvironmentHazardControl } from '../../src/systems/environment-hazard-control';
import { ContaminationHostSystem } from '../../src/systems/contamination-host-system';
import { GAME_CONSTANTS } from '../../src/config/constants';
import { sweepGroundDash } from '../../src/systems/tool-targeting';
import { AIState } from '../../src/types/game-types';

function fixture(definitionId: string) {
  const ability = getCatalogAbilityByDefinition(definitionId, 'contaminant-v1')!;
  const origin = { x: 48, y: 48 }, enemyPosition = { x: 80, y: 48 };
  const controls = new EnemyControlState(); controls.setControlProtectionEnabled(true);
  const host = new EnvironmentHazardControl(); host.setControlProtectionEnabled(true);
  const decoys = new Map<string, unknown>(); let commits = 0, sounds = 0, hostApplications = 0, input = true, resistance = 0;
  let visible = true, connected = true, dashDistance = ability.rangePx;
  const graphic: any = new Proxy({}, { get: () => () => graphic });
  const system = new CatalogAbilityRuntime({ add: { graphics: () => graphic } } as never, () => origin,
    () => [{ getId: () => 'body', getPosition: () => enemyPosition, getState: () => AIState.PATROL }] as never, {
      runId: 'run', combatRulesVersion: 2, getFacingAngle: () => 0,
      isTargetAlive: () => true, isTargetVisible: () => visible, hasTargetLineOfSight: () => true,
      canApplyHardControl: () => controls.canApplyHardControl(),
      setEnemyControl: (_id, source, effect) => controls.set(source, effect),
      hasEnemyControl: (_id, source) => controls.has(source), clearEnemyControl: (_id, source) => { controls.clear(source); },
      getEnvironmentTargets: () => [{ id: 'host', position: enemyPosition, canSuppressHazard: !host.suppressed && !host.protectionRemainingMs }] as never,
      suppressEnvironmentHazard: (_id, source, duration) => { host.suppress(source, duration); hostApplications++; return true; },
      clearEnvironmentControl: (_id, source) => host.clear(source),
      getBasePollutionResistance: () => resistance,
      getDashDestination: () => ({ x: origin.x + dashDistance, y: origin.y }),
      advanceGroundDash: position => { Object.assign(origin, position); return true; },
      setPlayerInput: enabled => { input = enabled; },
      isGroundConnected: (_from, to, range) => connected && Math.hypot(to.x-origin.x,to.y-origin.y)<=range,
      getSoundLureDestination: () => ({ x: origin.x + 64, y: origin.y }), reportSoundLure: () => { sounds++; },
      getStitchPlacement: () => ({ pointA: { x: 88, y: 16 }, pointB: { x: 88, y: 80 } }),
      setVisualDecoy: (source, position) => { if (position) decoys.set(source, position); else decoys.delete(source); },
      getRevealSnapshot: () => ({ enemyPositions: [], nodePositions: [], corePositions: [] }), showAbyssReveal: () => {},
    });
  const use = (actionId = `a${commits + 1}`, success = true) => system.use(ability, 'item', () => { if (success) commits++; return success; }, actionId);
  return { ability, system, controls, host, origin, enemyPosition, decoys, use,
    counts: () => ({ commits, sounds, hostApplications, input }),
    visibility: (value: boolean) => { visible = value; }, connected: (value: boolean) => { connected = value; },
    resistance: (value: number) => { resistance = value; }, dashDistance: (value: number) => { dashDistance = value; },
    step: (dt: number) => { controls.tick(dt); host.tick(dt); system.update(dt); } };
}

let tested = 0;
for (const definition of Object.values(CATALOG_ITEMS)) {
  if (definition.slot !== 'active') continue;
  const f = fixture(definition.id);
  assert(f.use('first'), definition.id);
  assert(!f.use('first'), 'same action cannot double-activate');
  assert(!f.use('second'), 'same family cannot refresh through another action');
  f.step(37);
  const saved = JSON.parse(JSON.stringify(f.system.exportRuntimeState()));
  assert(validateCatalogAbilityRuntimeState(saved), definition.id + ' accepts its own authored parameter range');
  assert.equal(saved.effects[0].resolvedParams.paramValue, definition.paramValue);
  const counts = f.counts(), hostBefore = f.host.exportRuntimeState();
  f.controls.beginRuntimeRestore();
  f.system.restoreRuntimeState(saved);
  assert.deepEqual(f.system.exportRuntimeState(), saved, definition.id + ' resumes exact identity, params and clocks');
  assert.deepEqual(f.counts(), counts, 'restore never consumes or replays sound/host application');
  assert.deepEqual(f.host.exportRuntimeState(), hostBefore, 'Host lifetime remains authoritative');
  const bad = structuredClone(saved); bad.effects[0].resolvedParams.paramValue += 1;
  assert(!validateCatalogAbilityRuntimeState(bad), 'forged parameters rejected');
  f.step(definition.durationMs + 1);
  assert.equal(f.system.getActiveEffects().length, 0);
  assert.equal(f.controls.movementMultiplier, 1);
  assert.equal(f.decoys.size, 0);
  assert(f.counts().input);
  f.system.destroy(); tested++;
}
assert.equal(tested, 36);

{
  const f = fixture('sealed_hourglass');
  assert(f.use()); f.step(100); f.controls.breakOnDamage();
  assert.equal(f.controls.controlProtectionRemainingMs, 2000);
  const state = f.system.exportRuntimeState(); assert.equal(state.effects[0]!.controlActive, false);
  f.controls.beginRuntimeRestore(); f.system.restoreRuntimeState(state); f.controls.restoreControlProtection(2000);
  f.step(1); assert.equal(f.controls.movementMultiplier, 1); assert(!f.use('protected'));
  const refusal = f.system.exportRuntimeState();
  assert.equal(refusal.controlRejections?.[0]?.remainingMs, 350, 'visible protected target gets a short refusal trace without a charge');
  f.system.restoreRuntimeState(refusal);
  assert.deepEqual(f.system.exportRuntimeState(), refusal, 'refusal remaining time also resumes exactly');
  f.step(1999); assert.equal(f.system.exportRuntimeState().controlRejections?.length, 0); assert(f.use('after-recovery'));
  f.system.destroy();
}
{
  const f = fixture('wooden_thread_spool'); assert(f.use()); f.enemyPosition.x = 96; f.step(16);
  assert.equal(f.controls.movementMultiplier, 0); assert(!f.controls.attackSuppressed, 'line does not prohibit attacks');
  f.step(1500); assert.equal(f.controls.movementMultiplier, 1); assert(!f.controls.canApplyHardControl());
  f.controls.tick(2000); assert(f.controls.canApplyHardControl());
  f.enemyPosition.x = 80; f.step(16); assert.equal(f.controls.movementMultiplier, 1, 'same target crosses a given line only once');
  f.system.destroy();
}
{
  const f = fixture('waterlogged_spine'); assert(f.use()); f.step(16); assert.equal(f.controls.movementMultiplier, .4);
  f.controls.set('another-area', { movementMultiplier: .7, movementGroup: 'heavy-zone' });
  assert.equal(f.controls.movementMultiplier, .4, 'heavy areas take strongest');
  f.connected(false); f.step(16); assert.equal(f.controls.movementMultiplier, .7, 'leaving releases this source immediately');
  f.system.destroy();
}
{
  const f = fixture('salted_vial'); f.resistance(60); assert(!f.use()); assert.equal(f.counts().commits, 0);
  f.resistance(50); assert(f.use()); assert.equal(f.system.getResistanceBonus(), 20);
  f.system.destroy();
}
{
  const f = fixture('hollow_loom_shuttle'); f.dashDistance(15); assert(!f.use());
  f.dashDistance(96); assert(f.use()); f.step(100); assert.equal(f.origin.x, 96);
  f.step(100); assert.equal(f.origin.x, 144); assert(!f.use('cooldown'));
  f.step(399); assert(!f.use('cooldown')); f.step(1); assert(f.use('ready')); f.system.destroy();
}
{
  const f = fixture('amber_beetle'); assert(!f.use('storage-failed', false)); assert.equal(f.controls.movementMultiplier, 1);
  assert.equal(f.system.getActiveEffects().length, 0); assert(f.use('storage-failed')); f.system.destroy();
}
{
  const grid = { cols: 8, rows: 8, tileSize: 32, isWalkable: (c: number, r: number) => c !== 4 && r !== 4 };
  const origin = { x: 80, y: 80 };
  assert(sweepGroundDash({ origin, destination: { x: 200, y: 80 }, grid }).x < 118.0001, 'full 20px body stops before void');
  const hit = sweepGroundDash({ origin, destination: { x: 124, y: 124 }, grid });
  assert(hit.x < 118.0001 && hit.y < 118.0001, 'diagonal body cannot cut corner');
  const body = sweepGroundDash({ origin, destination: { x: 124, y: 80 }, grid, bodies: [{ position: { x: 120, y: 80 }, halfWidth: 10, halfHeight: 10 }] });
  assert(body.x < 100.0001, 'body collision cannot be tunnelled');
  const hidden = sweepGroundDash({ origin, destination: { x: 124, y: 80 }, grid, isVisible: p => p.x < 90 || p.x > 100 });
  assert(hidden.x < 90, 'unseen gap truncates even with a visible endpoint');
}
{
  let hits = 0;
  const graphic:any=new Proxy({},{get:()=>()=>graphic});
  const wall:any={id:'wall',kind:'yi',alive:true,core:{x:64,y:64},windupMs:349,windupCol:2,windupRow:2,
    strikeThisFrame:false,strikeFloors:[{col:2,row:2}],walk:null,moving:false,telegraph:graphic,gfx:graphic,
    activity:{visual:{phase:'active'}},noiseRemainingMs:0,
    form:{portfolio:'yi',substrate:'wall_rust',coverage:'rewrite',continuity:'monolith',occupancy:'wall',lexemes:{motion:'motion_anchor',sense:'sense_touch',rhythm:'rhythm_open',contact:'contact_adjacent_strike'}}};
  const host=new ContaminationHostSystem();Object.assign(host,{hosts:[wall],liveMotion:true,skipPaint:true,combat:{applyHazardHit(){hits++;}},paintYi(){},paintMarks(){}});
  host.setControlProtectionEnabled(true);
  assert(!host.getToolTargets()[0]!.canSuppressHazard,'legacy combust does not silently gain wall targets');
  assert(host.getToolTargets()[0]!.canSuppressCatalogHazard);
  assert(!host.suppressHazard('wall','old',3000));assert(host.suppressHazard('wall','modern',3000,true));
  assert.equal(wall.windupMs,-1,'near-complete old windup is cancelled');
  for(let i=0;i<29;i++)(host as any).tickYi(wall,2,2,100);
  assert.equal(hits,0);
  (host as any).tickYi(wall,2,2,100);assert.equal(wall.windupMs,0,'wall resumes with a complete new warning');
  assert(!host.suppressHazard('wall','chain',3000,true),'control protection blocks immediate suppression chaining');
  (host as any).tickYi(wall,2,2,GAME_CONSTANTS.CONTAMINATION.ADJACENT_STRIKE_WINDUP_MS-1);assert.equal(hits,0);
  (host as any).tickYi(wall,2,2,1);assert.equal(hits,1);
}
console.log(`PASS ${tested} catalog active item definitions; final-use effects, params/recovery, control protection, strongest areas, bounded continuous dash`);
