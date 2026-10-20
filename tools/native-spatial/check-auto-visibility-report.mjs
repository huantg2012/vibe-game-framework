/** Reuse one saved geometry. No layout generation or policy tuning occurs. */
import assert from 'node:assert/strict';
import fs from 'node:fs';
import {createHash} from 'node:crypto';
import {buildNativeSpatialGeometry} from '../../src/generation/world-study/native-spatial-geometry.ts';
import {identifyNativeSpatialStructures} from '../../src/generation/world-study/native-spatial-measure.ts';
import {evaluateNativeSpatialVisibility} from '../../src/generation/world-study/native-spatial-visibility.ts';
import {qualifyNativeAutoSolidAreas} from '../../src/generation/world-study/native-auto-solid-area.ts';
import {certifyNativeAutoVisibility} from '../../src/generation/world-study/native-auto-visibility.ts';
const [input,output]=process.argv.slice(2);
assert(input&&output&&!fs.existsSync(output),'Provide an existing geometry and a fresh proof output path');
const source=JSON.parse(fs.readFileSync(input,'utf8')),started=performance.now();
const checkpoint=()=>{if(performance.now()-started>30000)throw new Error('Saved visibility proof exceeded 30-second deadline');};
const policy=source.input.nativeSpatial.policy,geometry=buildNativeSpatialGeometry(source.definition,source.seed);
const assemblies=source.plan.objects.filter(object=>object.kind==='solid').map(object=>object.assembly);
const groups=qualifyNativeAutoSolidAreas(identifyNativeSpatialStructures(geometry,assemblies,{...policy,minSolidAreaPx2:0}),
  geometry.terrain.cols,policy.minSolidAreaPx2,checkpoint).groups;
const coarse=evaluateNativeSpatialVisibility(geometry,groups.structures,policy);
assert.deepEqual(coarse,source.trace.gates.visibility,'The saved geometry must reproduce the unchanged coarse gate exactly');
checkpoint();
const refined=certifyNativeAutoVisibility(geometry,groups.structures,policy,coarse,checkpoint);
const report={input,worldId:source.worldId,grade:source.grade,seed:source.seed,
  scope:'one local G2 certificate on the saved unchanged geometry; no generation or full package',
  geometryHash:source.trace.geometryHash,definitionHash:createHash('sha256').update(JSON.stringify(source.definition)).digest('hex'),
  geometryAccepted:source.trace.gates.geometry.accepted&&refined.accepted,refined,elapsedMs:performance.now()-started};
fs.writeFileSync(output,JSON.stringify(report,null,2)+'\n');
console.log(JSON.stringify({output,geometryHash:report.geometryHash,geometryAccepted:report.geometryAccepted,
  coarseCoverage:coarse.metrics.coverage,refinedCoverage:refined.metrics.coverage,
  certificate:refined.metrics.visibilityCertificate,elapsedMs:report.elapsedMs}));
