import fs from 'node:fs';
import path from 'node:path';
const dir=process.argv[2]??'docs/qa/artifacts/iteration-27/economy-cycle';
const load=n=>JSON.parse(JSON.parse(fs.readFileSync(path.join(dir,n+'.storage.json'),'utf8'))['coh-save-v1']);
const files=['00-fresh-base','01-base','01-invested-base','02-base','02-invested-base-final','03-base','03-invested-base','04-base','04-invested-base','05-base','05-invested-base','06-base','06-maintained-base','07-loss-base','08-loss-base','09-recovery-base','09-recovery-repaired-base'];
const rows=files.map(label=>{const s=load(label);return {label,bank:s.kindlingReserve,cycle:s.cycle,modules:Object.fromEntries(s.modules.map(m=>[m.id,m.hp])),tide:s.tide,growth:s.growth,stability:s.stability,outcome:s.inventory.run?.outcome,income:s.inventory.run?.kindlingGained,equipment:s.inventory.equipment,items:s.inventory.items.map(i=>({id:i.id,definitionId:i.weapon?.definitionId,type:i.contaminant?.type,stage:(i.weapon??i.contaminant).stage,charges:(i.weapon??i.contaminant).impactCharges,uses:(i.weapon??i.contaminant).usesRemaining,location:i.location,source:i.source}))};});
fs.writeFileSync(path.join(dir,'complete-ledger.json'),JSON.stringify(rows,null,2));
console.log(JSON.stringify(rows.map(({label,bank,cycle,modules,outcome,income,stability})=>({label,bank,cycle,modules,outcome,income,stability})),null,2));
