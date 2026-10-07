/** Accounting fixtures only; no real generation, browser or extra sample claim. */
import assert from 'node:assert/strict';
import fs from 'node:fs';
import {createHash} from 'node:crypto';
import {buildGenerationSummary} from './r100-qualification-summary.mjs';

const hash = bytes => createHash('sha256').update(bytes).digest('hex');
const frozenPath = 'docs/qa/artifacts/r100-i10-i12/qualification-plan.json';
const frozenText = fs.readFileSync(frozenPath, 'utf8'), frozen = JSON.parse(frozenText);
const heldPath = frozen.generation.holdout.path, extraPath = frozen.generation.expandedHoldout.path;
const fixture = (stage = 'I11') => {
  const mem = new Map([[frozenPath, frozenText], [heldPath, fs.readFileSync(heldPath, 'utf8')], [extraPath, fs.readFileSync(extraPath, 'utf8')]]);
  const worlds = stage === 'I11' ? [...frozen.baseline.worlds, ...frozen.batches.filter(row => ['R100-I10', 'R100-I11'].includes(row.iteration)).flatMap(row => row.worlds)]
    : frozen.batches.filter(row => row.iteration === 'R100-I12').flatMap(row => row.worlds);
  const cases = worlds.flatMap(world => ['low','medium','severe'].flatMap(grade => frozen.generation.expandedHoldout.seeds.map(seed => ({world,grade,seed,cohort:'independent-holdout'}))));
  const plan = {version:1, worlds, seedPolicy:{mode:'expanded-holdout-only',qualificationPlan:{path:frozenPath,sha256:hash(frozenText)},stage}, groups:[{worlds,attempts:['/memory/attempt']} ]};
  const put = (file, value) => mem.set(file, JSON.stringify(value));
  const install = (folder, planned, rows, executor = 'synthetic frozen runner') => {
    const h = hash(executor); mem.set(`${folder}/qualification-${h.slice(0,12)}.mjs`, executor);
    put(`${folder}/source-snapshot.json`, {sha256:h,dependencies:[{path:'synthetic-runtime',sha256:hash('runtime')} ]});
    put(`${folder}/planned-cases.json`, {executorSha256:h,cases:planned});
    mem.set(`${folder}/cases.jsonl`, rows.map(row => JSON.stringify(row)).join('\n')+'\n');
  };
  const rows = cases.map(row => ({...row,ok:true,value:{...row,signature:'synthetic-only'}}));
  install('/memory/attempt', cases, rows); put('/memory/plan.json', plan);
  return {mem,plan,cases,rows,put,install,run(){ put('/memory/plan.json',plan);return buildGenerationSummary('/memory/plan.json',file=>{
    assert(mem.has(file),`Missing fixture ${file}`);return Buffer.from(mem.get(file));},file=>mem.has(file)); }};
};
const checks = [];
const positive = (name, check) => {check();checks.push({name,status:'pass'});};
const rejects = (name, mutate) => positive(name,()=>{const f=fixture();mutate(f);assert.throws(()=>f.run());});
positive('I11 complete2208 extra-only identities',()=>{const s=fixture().run();assert.equal(s.status,'pass');assert.equal(s.expectedCases,2208);assert.equal(s.seedPolicy.seedsPerGrade,8);});
positive('I12 complete384 extra-only identities',()=>{const s=fixture('I12').run();assert.equal(s.status,'pass');assert.equal(s.expectedCases,384);});
rejects('reject missing world',f=>f.plan.worlds.pop());
rejects('reject unknown stage',f=>f.plan.seedPolicy.stage='I10');
rejects('reject wrong mode',f=>f.plan.seedPolicy.mode='small-smoke');
rejects('reject resealed smaller qualification scope',f=>{const p=structuredClone(frozen);p.baseline.worlds.pop();const text=JSON.stringify(p);f.mem.set(frozenPath,text);f.plan.seedPolicy.qualificationPlan.sha256=hash(text);});
rejects('reject mutated qualification source',f=>f.mem.set(frozenPath,frozenText+' '));
rejects('reject holdout replacement',f=>{const extra=JSON.parse(f.mem.get(extraPath));extra.seeds[0]=1;f.put(extraPath,extra);});
rejects('reject original-base seed in raw row',f=>{f.rows[0].seed=frozen.generation.ordinarySeeds[0];f.rows[0].value.seed=f.rows[0].seed;f.install('/memory/attempt',f.cases,f.rows);});
rejects('reject wrong raw cohort',f=>{f.rows[0].cohort='ordinary';f.install('/memory/attempt',f.cases,f.rows);});
rejects('reject duplicate raw identity',f=>f.install('/memory/attempt',f.cases,[...f.rows,f.rows[0]]));
positive('missing raw process remains incomplete',()=>{const f=fixture();f.install('/memory/attempt',f.cases,f.rows.slice(1));const s=f.run();assert.equal(s.status,'incomplete');assert.equal(s.missing.length,1);});
positive('same executor retry retains original failure',()=>{const f=fixture();const failed={...f.cases[0],ok:false,error:'original timeout'};f.install('/memory/attempt',f.cases,[failed,...f.rows.slice(1)]);f.install('/memory/retry',[f.cases[0]],[f.rows[0]]);f.plan.groups[0].attempts.push('/memory/retry');const s=f.run();assert.equal(s.status,'pass');assert.equal(s.originalFailures.length,1);assert.equal(s.attempts,2209);});
rejects('reject changed retry executor',f=>{f.install('/memory/attempt',f.cases,[{...f.cases[0],ok:false,error:'original timeout'},...f.rows.slice(1)]);f.install('/memory/retry',[f.cases[0]],[f.rows[0]],'different runner');f.plan.groups[0].attempts.push('/memory/retry');});
positive('default original48 policy unchanged',()=>{
  const f=fixture();delete f.plan.seedPolicy;f.plan.worlds=['base-fixture'];f.plan.groups[0].worlds=f.plan.worlds;
  const seeds=[...frozen.generation.ordinarySeeds.map(seed=>({seed,cohort:'ordinary'})),...frozen.generation.boundarySeeds.map(seed=>({seed,cohort:'boundary'})),...frozen.generation.holdout.seeds.map(seed=>({seed,cohort:'independent-holdout'}))];
  const cases=['low','medium','severe'].flatMap(grade=>seeds.map(row=>({world:'base-fixture',grade,...row})));
  f.install('/memory/attempt',cases,cases.map(row=>({...row,ok:true,value:{...row,signature:'synthetic-only'}})));
  const s=f.run();assert.equal(s.status,'pass');assert.equal(s.expectedCases,144);assert(!Object.hasOwn(s,'seedPolicy'));assert.equal(s.independentHoldout.path,heldPath);
});
const output=process.argv[2];assert(output&&!fs.existsSync(output),'A fresh report path is required');
const ref=file=>({path:file,sha256:hash(fs.readFileSync(file))});
fs.writeFileSync(output,JSON.stringify({status:'pass',scope:'Synthetic in-memory accounting contract only; zero new game generation samples.',harness:ref('tools/qa/check-r100-expanded-holdout-summary.mjs'),summarizer:ref('tools/qa/r100-qualification-summary.mjs'),qualificationPlan:ref(frozenPath),checks},null,2)+'\n');
console.log(`PASS ${checks.length} expanded holdout accounting checks; no game cases run`);
