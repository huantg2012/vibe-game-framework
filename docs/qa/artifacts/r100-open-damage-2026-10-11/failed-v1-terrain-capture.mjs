import {build} from '/Users/yilungao/coh/node_modules/esbuild/lib/main.js';
import fs from 'node:fs';
const entry=`import fs from 'node:fs';
import {createR100ProductionRecipe} from './src/generation/world-study/r100-package.ts';
import {createR100SpatialDefinition} from './src/generation/world-study/r100-spatial-world.ts';
import {createMasterWorld} from './src/generation/world-study/r100-master-world.ts';
const recipe=createR100ProductionRecipe('cinder-ridge',20261010,'medium');
const {definition}=createR100SpatialDefinition(recipe.nativeDefinition,recipe.spatialPolicy,20261010);
globalThis.__terrainCapture=(data)=>{fs.writeFileSync('/tmp/coh-open-damage-terrain.json',JSON.stringify(data));};
try{createMasterWorld(definition,20261010,{grade:recipe.gradeDefinition,profile:recipe.profile,spatialDeployment:recipe.spatialPolicy.deployment});}catch(error){if(error.message!=='DIAGNOSTIC_TERRAIN_CAPTURE')throw error;console.log('Captured exact production terrain before pollution; not an admitted map');}
`;
await build({stdin:{contents:entry,resolveDir:'/Users/yilungao/coh',loader:'ts'},bundle:true,platform:'node',format:'esm',outfile:'/tmp/coh-open-damage-terrain.bundle.mjs',plugins:[{name:'read-terrain-before-pollution',setup(b){b.onLoad({filter:/r100-master-world\.ts$/},a=>({contents:fs.readFileSync(a.path,'utf8').replace('  const pollution = createMasterPollution',`  globalThis.__terrainCapture({ definition, tileMap, seats: Array.from(seats), reachable: Array.from(reachable), meshes: meshes.filter(m=>roles.get(m.spec.id)==='solid').map(m=>({id:m.spec.id,positions:Array.from(m.positions),indices:Array.from(m.indices)})) });
  throw new Error('DIAGNOSTIC_TERRAIN_CAPTURE');
  const pollution = createMasterPollution`),loader:'ts'}));}}]});
