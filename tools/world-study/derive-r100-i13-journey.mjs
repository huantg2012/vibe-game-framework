/** Bounded I13 extension of the immutable revision6/policy15 input controller.
 * Changes only QA scheduling, earned equipment selection and evidence collection. */
import assert from 'node:assert/strict';
import fs from 'node:fs';
import { createHash } from 'node:crypto';
const sourcePath='tools/qa/r100-revision6-journey.mjs';
const targetPath='tools/world-study/r100-i13-journey.mjs';
const original=fs.readFileSync(sourcePath,'utf8');
const originalSha256=createHash('sha256').update(original).digest('hex');
assert.equal(originalSha256,'1386811f4b10785803315d795240dddb3b288fa350db728cbb8fde2b325a1277');
let source=original;
function replace(before,after){assert.equal(source.split(before).length,2,`exact single derivation anchor: ${before.slice(0,90)}`);source=source.replace(before,after);}
replace("from './r100-i09-costed-encounters.mjs'","from '../qa/r100-i09-costed-encounters.mjs'");
replace("from './r100-i09-tool-slots.mjs'","from '../qa/r100-i09-tool-slots.mjs'");
replace("const naturalPreparation=true;",`assert(!controlledBuild && !fixedIdentity && !process.env.QA_REPLAY_INPUTS, 'I13 forbids resources/gear/identity-replay fixtures');
const schedule=JSON.parse(process.env.QA_I13_SCHEDULE??'[]');
assert.equal(schedule.length,rounds);for(const grade of schedule)assert(['low','medium','severe'].includes(grade));
const preparation=JSON.parse(process.env.QA_I13_PREPARATION??'{}');
assert(Array.isArray(preparation.active)&&preparation.active.length===2);
const initialStorage=JSON.parse(fs.readFileSync(process.env.QA_STORAGE_STATE,'utf8'));
const initialSave=JSON.parse(initialStorage.origins[0].localStorage.find(entry=>entry.name==='coh-save-v1').value);
const naturalPreparation=true;`);
replace("  harnessSha256:","  i13:{schedule,preparation,resourceInjection:false,sourceControllerSha256:'"+originalSha256+"'},\n  harnessSha256:");
replace("const policy=grade;","const policy=grade;let previousTerminal=initialSave;");
const begin=source.indexOf(' async function equipOwned(){');
const end=source.indexOf(' function publicOfferingReduction',begin);
assert(begin>0&&end>begin);
source=source.slice(0,begin)+` async function equipOwned(){
   let owned=await ownedForPreparation();const changes=[];
   const weapon=owned.items.filter(item=>item.kind==='weapon'&&item.canEquip).sort((a,b)=>(b.qualityRank??0)-(a.qualityRank??0))[0];
   if(weapon&&weapon.id!==owned.equipment.weaponId){await page.locator('[role="option"][data-item-id="'+weapon.id+'"]').click();await page.getByRole('button',{name:'换到在手',exact:true}).click();changes.push({slot:'weapon',id:weapon.id});}
   const used=new Set();
   for(const slot of owned.toolSlots){
    const desiredName=slot.key===null?preparation.passive:preparation.active[slot.index];
    const desired=desiredName?owned.items.find(item=>item.name===desiredName&&item.kind==='contaminant'&&item.canEquip&&item.toolSlots?.includes(slot.id)&&!used.has(item.id)):null;
    const previous=owned.equipment.toolIds[slot.index]??null;
    if(desired)used.add(desired.id);
    if(previous===(desired?.id??null))continue;
    if(desired){await page.locator('[role="option"][data-item-id="'+desired.id+'"]').click();await page.getByRole('button',{name:'装到 '+slot.label,exact:true}).click();}
    else if(previous){await page.locator('[role="option"][data-item-id="'+previous+'"]').click();await page.getByRole('button',{name:'卸下 '+slot.label,exact:true}).click();}
    changes.push({slot:slot.id,before:previous,id:desired?.id??null,publicName:desired?.name??null,reason:desired?'Owned revealed preparation':'No currently owned usable declared preparation; no grant'});
    owned=await ownedForPreparation();
   }
   driver.log({event:'actual-owned-equipment-inputs',changes,preparation});return changes;
 }
`+source.slice(end);
replace("   grade=policy==='alternating'?['low','medium','severe'][(ordinal-ordinalStart)%3]:['conservative','gradual','repeat-risk','low-growth','medium-growth'].includes(policy)?'low':policy;","   grade=schedule[ordinal-ordinalStart];");
replace("    receipt.before=await storage(`${ordinal}-before`);",`    receipt.before=await storage(\`\${ordinal}-before\`);
    assert.deepEqual(receipt.before.state,previousTerminal,'I13 preserves complete preceding earned terminal save');
    receipt.timing={preparationStartedAt:new Date().toISOString(),preparationStartedMs:Date.now()};`);
replace("    const entry=await logState(`${ordinal}-entry`);",`    receipt.timing.preparationAndEntryWallMs=Date.now()-receipt.timing.preparationStartedMs;
    const entry=await logState(\`\${ordinal}-entry\`);`);
replace("    await driver.press('r');await page.locator('#impact-result-panel')",`    receipt.timing.returnAndManagementStartedMs=Date.now();
    await driver.press('r');await page.locator('#impact-result-panel')`);
replace("    receipt.status='completed-real-input';receipt.outcome=base.inventory.run.outcome;",`    previousTerminal=receipt.afterPreparation.state;
    receipt.timing.returnAndManagementWallMs=Date.now()-receipt.timing.returnAndManagementStartedMs;
    receipt.status='completed-real-input';receipt.outcome=base.inventory.run.outcome;`);
source=`// GENERATED by tools/world-study/derive-r100-i13-journey.mjs. Source SHA256 ${originalSha256}.\n`+source;
if(process.argv.includes('--check'))assert.equal(fs.readFileSync(targetPath,'utf8'),source,'I13 controller derivation drift');else fs.writeFileSync(targetPath,source);
console.log(`I13 input controller ${process.argv.includes('--check')?'verified':'written'}; source ${originalSha256}`);
