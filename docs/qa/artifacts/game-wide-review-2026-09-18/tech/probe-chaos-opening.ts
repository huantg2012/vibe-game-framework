import assert from 'node:assert/strict';
import fs from 'node:fs';
import {ChaosSystem} from '@/systems/chaos-system';
import {eventBus} from '@/core/event-bus';
import {GameEvent} from '@/types/events';
const chaos=new ChaosSystem({startingValue:15,chaosRateModifier:.79});let elapsed=0;const events:any[]=[];
const listener=(payload:any)=>events.push({elapsed,...payload});eventBus.on(GameEvent.CHAOS_CHANGED,listener);
const initial=chaos.getValue();assert.equal(initial,15);assert.equal(events.length,0);
while(!events.length&&elapsed<10000){elapsed+=100;chaos.update(100);}
assert.equal(elapsed,2600);assert(events[0].value>=16);const result={scope:'Actual ChaosSystem events, combined with static HUD initial0; no DOM rendering',initial,hudStaticInitial:0,firstChanged:events[0],notes:'HUD created after ChaosSystem starts; opening value deliberately emits no event; first change emitted after delta>=1.'};
eventBus.off(GameEvent.CHAOS_CHANGED,listener);chaos.destroy();fs.writeFileSync('docs/qa/artifacts/game-wide-review-2026-09-18/tech/chaos-opening.json',JSON.stringify(result,null,2));console.log(JSON.stringify(result));
