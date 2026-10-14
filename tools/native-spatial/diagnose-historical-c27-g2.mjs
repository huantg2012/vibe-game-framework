/** One historical rejected geometry, one official G2 evaluation. Never admission. */
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import {createHash} from 'node:crypto';
import {pathToFileURL} from 'node:url';
import ts from 'typescript';

const output=process.argv[2];
assert(output&&!fs.existsSync(output),'Supply a fresh diagnostic directory');
const source='docs/qa/artifacts/native-spatial-2026-10-14/wide-bias-replay/candidate-27.json';
const formalSource='docs/qa/artifacts/native-spatial-2026-10-14/production-gel-core-shoulder-round1.json';
const expectedHash='1100442b556caf23';
const sourceRoots=['native-spatial-generation','native-spatial-geometry','native-spatial-measure','native-spatial-visibility','native-spatial-types','native-spatial-structures','r100-master-world'].map(name=>'src/generation/world-study/'+name+'.ts');
const files=new Set(),external=new Set();
function localDependency(file,spec){
  let base;
  if(spec.startsWith('@/'))base='src/'+spec.slice(2);
  else if(spec.startsWith('.'))base=path.normalize(path.join(path.dirname(file),spec));
  else if(spec==='phaser')base='tools/contam-preview/phaser-stub.ts';
  else {external.add(spec);return;}
  const resolved=[base,base+'.ts',base+'.js',base+'.json',path.join(base,'index.ts')].find(candidate=>fs.existsSync(candidate)&&fs.statSync(candidate).isFile());
  assert(resolved,`Unresolved source dependency ${file}: ${spec}`);return resolved;
}
function closure(file){
  if(files.has(file))return;files.add(file);if(file.endsWith('.json'))return;
  const sf=ts.createSourceFile(file,fs.readFileSync(file,'utf8'),ts.ScriptTarget.Latest,true);
  function visit(node){
    let spec;
    if((ts.isImportDeclaration(node)||ts.isExportDeclaration(node))&&node.moduleSpecifier&&ts.isStringLiteral(node.moduleSpecifier))spec=node.moduleSpecifier.text;
    else if(ts.isCallExpression(node)&&(node.expression.kind===ts.SyntaxKind.ImportKeyword||ts.isIdentifier(node.expression)&&node.expression.text==='require')){
      assert(node.arguments.length===1&&ts.isStringLiteral(node.arguments[0]),`Nonliteral import in ${file}`);spec=node.arguments[0].text;
    }else if(ts.isImportTypeNode(node)&&ts.isLiteralTypeNode(node.argument)&&ts.isStringLiteral(node.argument.literal))spec=node.argument.literal.text;
    if(spec){const dependency=localDependency(file,spec);if(dependency)closure(dependency);}
    ts.forEachChild(node,visit);
  }visit(sf);
}
sourceRoots.forEach(closure);
assert.equal(external.size,0,'Unexpected external dependency in production source closure');
const dependencyCount=files.size;
for(const file of [source,formalSource,'tools/native-spatial/diagnose-historical-c27-g2.mjs','tools/contam-preview/tsconfig.json','tsconfig.json','package.json','package-lock.json'])files.add(file);
const sha=data=>createHash('sha256').update(data).digest('hex');
const snapshot=()=>Object.fromEntries([...files].sort().map(file=>[file,sha(fs.readFileSync(file))]));
const before=snapshot(),startedAt=new Date().toISOString(),started=performance.now();
fs.mkdirSync(output,{recursive:true});
const report={status:'running',scope:'One saved rejected c27, exact-geometry identity first, one official G2 diagnostic; no admission, no deployment, no G4, no sampler invocation.',startedAt,node:process.version,source,formalSource,expectedHash,dependencyCount,sourceHashes:before,counts:{actualCompilations:0,officialG2Calls:0},fingerprintMethod:'Direct official nativeSpatialGeometryFingerprint import; complete generation/layout/joint dependency closure bound.'};
const save=()=>fs.writeFileSync(path.join(output,'report.json'),JSON.stringify(report,null,2)+'\n');save();
try{
  const saved=JSON.parse(fs.readFileSync(source,'utf8')),formal=JSON.parse(fs.readFileSync(formalSource,'utf8'));
  const historical=formal.failures[0].diagnostics.attempts[0].candidates.find(row=>row.candidate===27);
  assert.equal(historical.geometryHash,expectedHash);assert.equal(saved.diagnostic.geometryHash,expectedHash);
  assert.equal(historical.geometrySeed,20261012);assert.equal(historical.accepted,false);
  assert.deepEqual(historical.gates.geometry.reasons,['G3-wide-domain-area']);
  const {proposal,input}=saved;
  assert.equal(proposal.candidate,27);assert.deepEqual(proposal.requestedCounts,{holes:11,solids:5});
  assert.equal(input.policy.minWideRatio,.55);assert.equal(input.policy.maxCoverRoutePx,320);
  const load=name=>import(pathToFileURL(path.resolve('src/generation/world-study/'+name+'.ts')).href);
  const {nativeSpatialGeometryFingerprint}=await load('native-spatial-generation');
  const {buildNativeSpatialGeometry,nativeCellPoint}=await load('native-spatial-geometry');
  const {identifyNativeSpatialStructures,evaluateNativeSpatialGeometry}=await load('native-spatial-measure');
  const {evaluateNativeSpatialVisibility,nativeSpatialShortestPaths}=await load('native-spatial-visibility');
  const compileStart=performance.now();report.counts.actualCompilations++;
  const geometry=buildNativeSpatialGeometry(proposal.definition,historical.geometrySeed);
  report.compileMs=performance.now()-compileStart;
  const fingerprint=nativeSpatialGeometryFingerprint(geometry,proposal);
  report.actualHash=fingerprint.hash;report.canonicalSha256=sha(fingerprint.canonical);
  assert.equal(fingerprint.hash,expectedHash,'Do not evaluate G2 on a changed historical geometry');
  const measureStart=performance.now();
  const groups=identifyNativeSpatialStructures(geometry,proposal.assemblies,input.policy);
  const geometryGate=evaluateNativeSpatialGeometry(geometry,groups,input.policy,input.world,{placements:proposal.holes,profiles:input.holeProfiles},{landRects:proposal.plan.land,placements:proposal.bays,landJoins:proposal.landJoins,profiles:input.bayProfiles,allowedCounts:input.world.bayCountOptions,minWideJoinPx:input.world.landRectMinOverlapPx});
  report.geometryMeasureMs=performance.now()-measureStart;
  assert.deepEqual(geometryGate,historical.gates.geometry,'Actual G1/G3 receipt must match preserved formal record');
  report.historicalG1G3=geometryGate;
  report.productionAdmitted=false;report.productionRejectionRetained=geometryGate.reasons;
  report.policy={probeStepPx:input.policy.probeStepPx,referenceSightPx:input.policy.referenceSightPx,revealRouteMinPx:input.policy.revealRouteMinPx,revealRouteMaxPx:input.policy.revealRouteMaxPx,maxCoverRoutePx:input.policy.maxCoverRoutePx,minWideRatio:input.policy.minWideRatio};
  save();console.log(JSON.stringify({stage:'exact-historical-geometry-verified',actualHash:fingerprint.hash,geometryRejected:geometryGate.reasons,wideRatio:geometryGate.metrics.wideRatio,compileMs:report.compileMs}));
  report.counts.officialG2Calls++;report.g2StartedAt=new Date().toISOString();save();
  const g2Start=performance.now();
  const g2=evaluateNativeSpatialVisibility(geometry,groups.structures,input.policy);
  report.g2Ms=performance.now()-g2Start;report.g2=g2;
  const {cols}=geometry.terrain,toPoint=cell=>nativeCellPoint(cell,cols);
  report.holeSummary=g2.metrics.holes.map(hole=>({id:hole.id,testedQ:hole.testedQ,witnessCount:hole.witnesses.length,failureCounts:hole.failureCounts,routeMinPx:hole.witnesses.length?Math.min(...hole.witnesses.map(w=>w.routePx)):null,routeMaxPx:hole.witnesses.length?Math.max(...hole.witnesses.map(w=>w.routePx)):null,firstWitness:hole.witnesses.length?{...hole.witnesses[0],qPoint:toPoint(hole.witnesses[0].q),vPoint:toPoint(hole.witnesses[0].v),tPoint:toPoint(hole.witnesses[0].t)}:null}));
  // This supplementary shortest-path read reports the actual gap; it does not rerun G2.
  const supplementaryStart=performance.now(),paths=nativeSpatialShortestPaths(geometry,g2.metrics.qCells),limit=input.policy.maxCoverRoutePx;
  let overLimit=0,unreachable=0;const bandCounts={'0–160':0,'160–320':0,'320–480':0,'480–640':0,'>640':0,unreachable:0};
  for(let cell=0;cell<geometry.reachable.length;cell++)if(geometry.reachable[cell]){
    const d=paths.distance[cell]/1000;if(!Number.isFinite(d)){unreachable++;bandCounts.unreachable++;}else{bandCounts[d<=160?'0–160':d<=320?'160–320':d<=480?'320–480':d<=640?'480–640':'>640']++;}if(d>limit)overLimit++;
  }
  assert.equal(overLimit,g2.metrics.coverage.overLimit);assert.equal(unreachable,g2.metrics.coverage.unreachable);
  const worst=g2.metrics.coverage.worstCell,route=[],seen=new Set();let at=worst;
  if(at>=0&&Number.isFinite(paths.distance[at]))while(at>=0){assert(!seen.has(at),'Coverage parent route cycles');seen.add(at);route.push(at);at=paths.parent[at];}
  const nearestQ=route.length?route.at(-1):null;
  if(nearestQ!==null)assert(g2.metrics.qCells.includes(nearestQ));
  report.coverageDiagnostic={...g2.metrics.coverage,limitPx:limit,deficitPx:g2.metrics.coverage.maxRoutePx===null?null:Math.max(0,g2.metrics.coverage.maxRoutePx-limit),overLimitRatio:overLimit/geometry.reachableCount,uniqueQualifiedQ:g2.metrics.qCells.length,worstPoint:worst>=0?toPoint(worst):null,nearestQ,nearestQPoint:nearestQ===null?null:toPoint(nearestQ),nearestQHoleIds:g2.metrics.holes.filter(hole=>hole.witnesses.some(w=>w.q===nearestQ)).map(hole=>hole.id),routeCells:route,routePoints:route.map(toPoint),bandCounts};
  report.supplementaryPathMs=performance.now()-supplementaryStart;
  report.status='completed-diagnostic';
}catch(error){report.status='diagnostic-error';report.error=String(error.stack??error);process.exitCode=1;}
report.sourceHashesAfter=snapshot();report.sourcesStable=JSON.stringify(before)===JSON.stringify(report.sourceHashesAfter);
if(!report.sourcesStable){report.status='invalid-source-changed';process.exitCode=1;}
report.finishedAt=new Date().toISOString();report.totalMs=performance.now()-started;save();
console.log(JSON.stringify({status:report.status,sourcesStable:report.sourcesStable,dependencyCount:report.dependencyCount,counts:report.counts,actualHash:report.actualHash,geometryRejected:report.productionRejectionRetained,g2Accepted:report.g2?.accepted,g2Reasons:report.g2?.reasons,holeSummary:report.holeSummary?.map(h=>({id:h.id,witnessCount:h.witnessCount})),coverage:report.g2?.metrics.coverage,g2Ms:report.g2Ms,totalMs:report.totalMs,error:report.error}));
