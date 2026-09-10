import assert from 'node:assert/strict';
import {applyDefenseEffects,resetDefenseEngine} from '../../src/systems/defense-engine';
import {CONTAMINANT_DATA} from '../../src/generated/contaminant-data';
const families=['solidify','scatter','retrograde','muffle','expand','mirror','kindle','combust'] as const;
const oldRandom=Math.random;
try { for (const type of families) { for(const rng of [0,.99]) { Math.random=()=>rng;resetDefenseEngine(); const item={id:type,type,rarity:CONTAMINANT_DATA[type].rarity,stage:'defense' as const,impactCharges:2,usesRemaining:0};
const c={forecastTargetId:'CORE',actualPrimaryId:'CORE',stabilityProgress:0,moduleHps:{CORE:30,STORAGE:90,PURIFIER:70},moduleMaxHps:{CORE:100,STORAGE:100,PURIFIER:100}};
const r=applyDefenseEffects({CORE:20,STORAGE:5,PURIFIER:5},[item],c);
assert.deepEqual(r.sideEffects,[]);assert.equal(r.kindlingGain,0);assert.equal(r.stabilityChange,0);assert.equal(r.upgradeDiscount,0);assert.equal(r.moduleSwapTriggered,false);assert.equal(r.toolUseGrants,0);
if(type==='combust')assert(Object.values(r.healOut).reduce((a,b)=>a+b,0)>0);
const zero=applyDefenseEffects({CORE:0,STORAGE:0,PURIFIER:0},[item],c);assert.equal(Object.values(zero.healOut).reduce((a,b)=>a+b,0),0);
} console.log('PASS',type,'no former hidden side effects; zero damage no healing'); }}finally{Math.random=oldRandom;}

const context = { forecastTargetId: 'CORE', actualPrimaryId: 'CORE', stabilityProgress: 0,
  moduleHps: { CORE: 30, STORAGE: 90, PURIFIER: 70 }, moduleMaxHps: { CORE: 100, STORAGE: 100, PURIFIER: 100 } };
const item = (type: typeof families[number]) => ({ id: type, type, rarity: CONTAMINANT_DATA[type].rarity,
  stage: 'defense' as const, impactCharges: 2, usesRemaining: 0 });
const scatter = applyDefenseEffects({ CORE: 21, STORAGE: 5, PURIFIER: 5 }, [item('scatter')], context);
assert.equal(Object.values(scatter.finalDamagePerModule).reduce((a, b) => a + b, 0), 31, 'redistribution conserves integer total');
assert.equal(Math.max(...Object.values(scatter.finalDamagePerModule)) - Math.min(...Object.values(scatter.finalDamagePerModule)), 1);
const mirror = applyDefenseEffects({ CORE: 40, STORAGE: 20, PURIFIER: 20 }, [item('mirror')], context);
assert.deepEqual(mirror.finalDamagePerModule, { CORE: 30, STORAGE: 11, PURIFIER: 11 }, 'mirror adds secondary attenuation, not a resource reward');
const ember = applyDefenseEffects({ CORE: 400, STORAGE: 0, PURIFIER: 0 }, [item('combust')], context);
assert.deepEqual(ember.healOut, { CORE: 6 }, 'healing uses actual available HP lost, never overkill damage');
console.log('PASS integer conservation, secondary-only attenuation and actual-loss ember healing');
