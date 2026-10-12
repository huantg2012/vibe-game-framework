/** Receiving-side rejection cases do not trust a claimed object ID alone. */
import assert from 'node:assert/strict';
import fs from 'node:fs';
import {createR100ProductionRecipe} from '../../src/generation/world-study/r100-package.ts';
import {createR100ProductionMap} from '../../src/generation/world-study/r100-production-map.ts';
import {hydrateR100MasterWorld} from '../../src/generation/world-study/r100-native-data.ts';
import {validateSearchSites} from '../../src/generation/world-study/search-site-placement.ts';
const recipe=createR100ProductionRecipe('pale-sail',20261012,'medium'),map=createR100ProductionMap(recipe),world=hydrateR100MasterWorld(map.native,map.layout);
const sites=world.searchSites,index=sites.findIndex(site=>site.sourceKind==='detached'&&Math.hypot(site.sourceAnchor.x-site.position.x,site.sourceAnchor.y-site.position.y)>5);
assert(index>=0,'A real detached case is required by this negative fixture');
const original=sites[index];
const mutate=patch=>({...world,searchSites:sites.map((site,i)=>i===index?{...site,...patch}:site)});
const cases=[['wrong material parent', {sourceObjectId:999999}],['fictitious parent surface',{sourceAnchor:{...original.position}}],
 ['unfrozen visual seed',{visualSeed:(original.visualSeed+1)>>>0}],['reward leaking field',{rarity:'rare'}],['wrong material axis',{axis:(original.axis+.7)%(Math.PI*2)}]];
for(const [name,patch]of cases)assert.throws(()=>validateSearchSites(mutate(patch)),undefined,name);
validateSearchSites(world);
const flag=process.argv.indexOf('--report'),destination=flag>=0?process.argv[flag+1]:null;
const report={status:'passed',worldId:'pale-sail',seed:20261012,grade:'medium',nodeId:original.nodeId,rejected:cases.map(([name])=>name),unchangedOriginalValid:true};
if(destination)fs.writeFileSync(destination,JSON.stringify(report,null,2)+'\n',{flag:'wx'});
console.log(JSON.stringify(report));
