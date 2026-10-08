/** Independent bounded review of the explicit historical-harness branch. */
import fs from 'node:fs';
import assert from 'node:assert/strict';
import {createHash} from 'node:crypto';
import {validateHistoricalGenerationSources,validateGenerationHarnessSources} from '../../../../../tools/qa/r100-bind-i10-i12.mjs';

const base='docs/qa/artifacts/r100-i10-i12/closeout-independent-review';
const out=`${base}/binding-harness-independent-review.json`;
assert(!fs.existsSync(out));
const hash=b=>createHash('sha256').update(b).digest('hex');
const inputs=[];
function read(file,expected){const data=fs.readFileSync(file),sha256=hash(data);if(expected)assert.equal(sha256,expected);inputs.push({path:file,sha256});return JSON.parse(data);}
const supplement=read(`${base}/historical-generation-harness-supplement.json`,'7487ab29c41db02b242e0b0951b6c5c10d7ed2a29f5928c91516d9825127a388');
const historical=read(supplement.historicalBinding.path,supplement.historicalBinding.sha256);
const summary=read(supplement.historicalGeneration.path,supplement.historicalGeneration.sha256);
const parentChecks=read(`${base}/binding-harness-supplement-contracts.json`);
for(const ref of [parentChecks.binder,parentChecks.harness])assert.equal(hash(fs.readFileSync(ref.path)),ref.sha256);
const accesses=[];
function repoBytes(file){assert(file.startsWith(`${base}/generation-harness-sources/`),'Only preserved repository copies allowed in this check');accesses.push(file);return fs.readFileSync(file);}
function validate(value,reader=repoBytes){const rows=validateHistoricalGenerationSources(value,historical.generationSources);for(const row of rows){const group=summary.groups.find(g=>g.id===row.groupId);assert(group);validateGenerationHarnessSources(row,group.dependencies.filter(d=>d.path.startsWith('tools/')),reader);}}
const checks=[];
function pass(name,fn){fn();checks.push({name,status:'pass'});}
pass('All11 exact historical groups validate with a reader limited to the two repository copies',()=>validate(supplement.historicalGenerationSources));
pass('Permuting the11 rows preserves identity and coverage',()=>validate([...supplement.historicalGenerationSources].reverse()));
const rejected=(name,mutate)=>pass(name,()=>{const value=structuredClone(supplement.historicalGenerationSources);mutate(value);assert.throws(()=>validate(value));});
rejected('Same count with an unknown group id cannot replace an original group',x=>x[0].groupId='unknown-historical-group');
rejected('Another valid preserved historical tool cannot be swapped across SHA versions',x=>x[0].harnessSources=structuredClone(x[2].harnessSources));
rejected('Missing harnessSources fails instead of selecting the old temporary branch',x=>delete x[0].harnessSources);
rejected('Missing dependencyPath cannot claim coverage',x=>delete x[0].harnessSources[0].dependencyPath);
rejected('Keeping correct source and dependency identities cannot hide corrupted content',x=>x[0].harnessSources[0].sha256='0'.repeat(64));
pass('Truncated bytes fail even when all metadata remains unchanged',()=>assert.throws(()=>validate(supplement.historicalGenerationSources,file=>repoBytes(file).subarray(0,4))));
pass('Null explicit supplement rejects; only actual undefined permits historical compatibility',()=>assert.throws(()=>validateHistoricalGenerationSources(null,historical.generationSources)));
const tool={path:'tools/qa/r100-bind-i10-i12.mjs',sha256:hash(fs.readFileSync('tools/qa/r100-bind-i10-i12.mjs'))};
const report={schemaVersion:1,status:'pass-independent-explicit-historical-harness-binding-review',createdAt:new Date().toISOString(),reviewer:'i12_qa',tool,
  scope:'Static integration review plus9 bounded predicate checks on exact real historical receipts. No final108 proposal, map, browser, qualification run or ledger write.',
  findings:[
    'The optional explicit list is validated before the generation loop. Each original groupId occurs exactly once and retains the immutable source manifest path and SHA.',
    'The generation loop still reads the original frozen-source receipt. Every runtime dependency remains tied to snapshot.sources; only QA tools use the archivedHarness branch.',
    'Tool dependencyPath coverage must exactly equal the original raw generation dependencies. The repository file digest must equal its supplied SHA and the executed dependency SHA.',
    'Actual CLI reader constrains files to the repository, checks realpath containment and checks for concurrent changes before --write; an external/symlink path is not a supported bypass.',
    'Explicit supplement, including an empty/null/bad list, does not fall back. Only an absent field retains legacy temporary-path behavior; the final plan must actually include the completed11-row field.',
    'The parent48 checks bind current binder/harness SHA. This review additionally binds the exact supplementary and historical receipts that those checks used.',
  ],
  observedRepositoryHarnessPaths:[...new Set(accesses)],checks,parentContractChecks:parentChecks.checks.length,
  disposition:{finding:'QA-CLOSE-01',status:'tool-consumption-path-reviewed-final-plan-pending',remaining:'Populate final plan.historicalGenerationSources with this exact11-row supplement and run the real final proposal after all runtime gates. Merely updating the tool does not complete the final binding.'},
  limitations:['No product/gameplay result is inferred','white-scarfield severe remains independently unqualified','Original35-source archive boundaries and original manifests remain unchanged','Final complete binding cannot yet be exercised without pending artifacts'],inputs,
  self:{path:`${base}/audit-harness-binding.mjs`,sha256:hash(fs.readFileSync(`${base}/audit-harness-binding.mjs`))}};
fs.writeFileSync(out,JSON.stringify(report,null,2)+'\n',{flag:'wx'});
console.log(JSON.stringify({status:report.status,checks:checks.length,readOnlyRepositoryCopies:report.observedRepositoryHarnessPaths.length,report:{path:out,sha256:hash(fs.readFileSync(out))}},null,2));
