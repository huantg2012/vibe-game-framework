/** Read-only G1/G2/G3 diagnostic of one complete author CSV across all grades.
 * Ephemeral overrides are explicitly not a production or recoverable recipe. */
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import {createHash} from 'node:crypto';
import {createR100DirectConstructionRecipe} from '../../src/generation/world-study/r100-package.ts';
import {parseNativeSpatialConstructionReference} from '../../src/generation/world-study/native-spatial-construction-reference.ts';
import {applyNativeConstructionIntent} from '../../src/generation/world-study/native-construction-recipe.ts';
import {createNativeConstructionCandidate} from '../../src/generation/world-study/native-construction-generation.ts';
const [referenceFile,shoreFile,intentFile,output]=process.argv.slice(2);
assert(referenceFile&&shoreFile&&intentFile&&output,'Usage: check-reviewed-grades.mjs REFERENCE_CSV SHORE_CSV INTENT_JSON NEW_OUTPUT');
assert(!fs.existsSync(output),'Never overwrite grade evidence');fs.mkdirSync(output,{recursive:true});
const sha=value=>createHash('sha256').update(value).digest('hex'),source=file=>{const csv=fs.readFileSync(file,'utf8');return{csv,sourceHash:sha(csv)};};
const reference=source(referenceFile),shore=source(shoreFile),parsed=parseNativeSpatialConstructionReference(reference.csv,reference.sourceHash),frozenIntent=JSON.parse(fs.readFileSync(intentFile,'utf8'));
const intent={frameWidthPx:frozenIntent.frameWidthPx,frameHeightPx:frozenIntent.frameHeightPx,targetWalkAreaPx2:frozenIntent.targetWalkAreaPx2,planningCellFactor:frozenIntent.planningCellFactor};
const report={status:'running',scope:'Ephemeral authoring diagnostic. Real r13 construction adapter and gates; no production recipe validation, catalog write, content deployment or recovery claim.',worldId:parsed.worldId,referenceFile,referenceHash:reference.sourceHash,shoreFile,shoreHash:shore.sourceHash,intent,cases:[]};
const save=()=>fs.writeFileSync(path.join(output,'report.json'),JSON.stringify(report,null,2)+'\n');save();
for(const grade of ['low','medium','severe']){
  const began=performance.now(),result={grade,status:'running'};report.cases.push(result);
  try{
    const recipe=createR100DirectConstructionRecipe(parsed.worldId,parsed.seed,grade);
    recipe.nativeConstruction={...recipe.nativeConstruction,reference,shore,intent,sourceHash:sha(JSON.stringify({reference:reference.sourceHash,shore:shore.sourceHash,intent}))};
    recipe.nativeSpatial=applyNativeConstructionIntent(recipe.nativeSpatial,recipe.nativeConstruction);
    const trace={geometrySeed:parsed.seed,proposalBudget:1,layoutProposals:0,geometryEvaluations:0,fullCandidates:0,feedbackBases:[],candidates:[],deploymentRejections:[],stopReason:'searching'};
    const candidate=createNativeConstructionCandidate(recipe,trace,()=>assert(performance.now()-began<60000,'Grade geometry deadline'));
    result.trace=trace;result.status=candidate.trace.accepted?'passed':'rejected';
    const m=candidate.trace.gates.geometry.metrics;result.summary={reasons:candidate.trace.reasons,maxEmptyUpperPx:m.maxEmptyUpperPx,maxDeepSpanPx:m.maxDeepSpanPx,wideRatio:m.wideRatio,largestWideRatio:m.largestWideRatio,walkAreaPx2:m.walkAreaPx2,cover:candidate.trace.gates.visibility?.metrics.coverage};
    fs.writeFileSync(path.join(output,`layout-${grade}.json`),JSON.stringify(candidate.layout,null,2)+'\n');
  }catch(error){result.status='failed';result.error=String(error.stack??error);}
  result.elapsedMs=performance.now()-began;save();console.log(JSON.stringify({grade,status:result.status,summary:result.summary,error:result.error}));
}
report.status=report.cases.every(c=>c.status==='passed')?'passed':'rejected';save();if(report.status!=='passed')process.exitCode=1;
