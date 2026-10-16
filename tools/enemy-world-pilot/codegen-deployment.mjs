/** Two admitted worlds' actual spawn forms: CSV is the sole authoring source. */
import assert from 'node:assert/strict';
import fs from 'node:fs';
import {createHash} from 'node:crypto';
import {supportsRuntimeForm} from '../../src/generation/contamination-draw.ts';
import {validNativeEnemyDeployment} from '../../src/generation/world-study/native-enemy-deployment.ts';
import {POLLUTION_GRADE_DEFINITIONS} from '../../src/generated/rift-pollution-grade-data.ts';
const source='data/rift-native-enemy-deployment.csv',csv=fs.readFileSync(source,'utf8'),lines=csv.trim().split(/\r?\n/);
assert.equal(lines.shift(),'world_id,grade,role,substrate,coverage,continuity,occupancy,portfolio,motion,sense,rhythm,contact');
const sourceHash=createHash('sha256').update(csv).digest('hex'),records=new Map();
for(const line of lines){
  const cells=line.split(',');assert.equal(cells.length,12);
  const [worldId,grade,role,substrate,coverage,continuity,occupancy,portfolio,motion,sense,rhythm,contact]=cells;
  assert(['crystal-fibre','ruptured-film'].includes(worldId));assert(['low','medium','severe'].includes(grade));assert(['infiltrator','rewriter','paint'].includes(role));
  const key=`${worldId}:${grade}`,record=records.get(key)??{version:1,worldId,grade,sourceHash};assert(!record[role],`Duplicate ${key}/${role}`);
  const form={substrate,coverage,continuity,occupancy,portfolio,lexemes:{motion,sense,rhythm,contact}};
  assert(supportsRuntimeForm(form),`Unsupported actual runtime form: ${key}/${role}`);record[role]=form;records.set(key,record);
}
const rows=[...records.values()];assert.equal(rows.length,6);
for(const row of rows)assert(validNativeEnemyDeployment(row,row.worldId,row.grade,POLLUTION_GRADE_DEFINITIONS.find(grade=>grade.id===row.grade).paintCoverage));
const file='src/generated/r100-enemy-deployment.ts',body=`/** Generated from ${source}; do not edit. */\nimport type {NativeEnemyDeployment} from '@/generation/world-study/native-enemy-deployment';\nexport const NATIVE_ENEMY_DEPLOYMENTS:readonly NativeEnemyDeployment[]=${JSON.stringify(rows,null,2)};\n`;
if(process.argv.includes('--check'))assert.equal(fs.readFileSync(file,'utf8'),body);else fs.writeFileSync(file,body);
console.log(JSON.stringify({status:'passed',contracts:rows.length,forms:lines.length,file}));
