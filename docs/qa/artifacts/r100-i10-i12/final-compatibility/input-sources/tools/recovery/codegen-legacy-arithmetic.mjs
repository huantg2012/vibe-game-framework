/** Deterministic adapter around the unchanged historical executor. Only its
 * Math.atan2 call sites receive one explicit, audited historical arithmetic. */
import fs from 'node:fs';import assert from 'node:assert/strict';import{createHash}from'node:crypto';
const source='src/generation/legacy-rift-v2/executor.js',output='src/generation/legacy-rift-v2/arithmetic-executor.js';
const bytes=fs.readFileSync(source),manifest=JSON.parse(fs.readFileSync('src/generation/legacy-rift-v2/manifest.json'));
assert.equal(createHash('sha256').update(bytes).digest('hex'),manifest.executorSha256);
let text=bytes.toString();const count=(text.match(/Math\.atan2\(/g)??[]).length;assert.equal(count,14,'review any newly admitted arithmetic site');
text=text.replaceAll('Math.atan2(', 'historicalAtan2(');
const exports=/export \{\n  createWorldProductionMap,\n  generateRiftLayout,\n  validWorldProductionRecipe\n\};\s*$/;
assert(exports.test(text));text=text.replace(exports,'return { createWorldProductionMap, generateRiftLayout, validWorldProductionRecipe };\n}');
const result=`// GENERATED from immutable executor ${manifest.executorSha256}.\n// No global Math mutation and no tolerance-based identity acceptance.\nexport function createHistoricalArithmeticExecutor(historicalAtan2) {\n${text}`;
if(process.argv.includes('--write'))fs.writeFileSync(output,result);else assert.equal(fs.readFileSync(output,'utf8'),result);
console.log(`PASS historical executor adapter: ${count} explicit atan2 sites; original SHA intact`);
