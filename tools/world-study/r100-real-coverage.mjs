/** Enumerate actual-input evidence only; no visual/route-alternative PASS inferred. */
import fs from 'node:fs';
import path from 'node:path';
const root=path.resolve('docs/qa/artifacts'),out=path.resolve(process.argv[2]??'docs/qa/artifacts/r100-p13/real-world-grade-coverage.json');
const worlds=fs.readFileSync('data/rift-native-worlds.csv','utf8').trim().split(/\r?\n/).slice(1).map(l=>l.split(',')[0]);
const cells=worlds.flatMap(world=>['low','medium','severe'].map(grade=>({world,grade,r2:[],r3:[],other:[]}))),byKey=new Map(cells.map(c=>[`${c.world}:${c.grade}`,c]));
const seen=new Map(),excluded=[];
function walk(dir){for(const e of fs.readdirSync(dir,{withFileTypes:true})){const f=path.join(dir,e.name);if(e.isDirectory())walk(f);else if(e.name==='report.json'){
 let d;try{d=JSON.parse(fs.readFileSync(f));}catch{continue;}if(!Array.isArray(d.realJourneyAttempts))continue;
 for(const r of d.realJourneyAttempts){if(r.status!=='completed-real-input')continue;
  const identity=r.identity,package_=identity?.generation?.package,runId=r.entrySave?.state?.riftCheckpoint?.runId;
  if(!package_||!runId){excluded.push({file:path.relative(root,f),ordinal:r.ordinal,reason:'Missing frozen native identity/run ID'});continue;}
  if(seen.has(runId))continue;seen.set(runId,f);
  const world=package_.id.replace(/^r100-/,''),grade=package_.grade,cell=byKey.get(`${world}:${grade}`);if(!cell){excluded.push({file:path.relative(root,f),ordinal:r.ordinal,reason:`Not current 20-world cell ${world}:${grade}`});continue;}
  const row={runId,report:path.relative(root,f),ordinal:r.ordinal,seed:identity.seed,revision:package_.algorithmRevision,outcome:r.outcome,searches:r.searches.filter(s=>s.collected).length,deepKindlingBroughtHome:r.outcome==='extract'?r.searches.filter(s=>s.collected&&s.kind==='kindling'&&s.tier==='deep').length:0,controlled:!!(d.controlledBuild||d.controlledWorld||d.fixedDefectIdentity),loadout:r.loadout,elapsedMs:r.fieldResult.elapsedMs,navigationWarning:r.navigationWarning??null};
  row.actualSearchAndExtract=row.outcome==='extract'&&row.searches>0;cell[row.revision===2?'r2':row.revision===3?'r3':'other'].push(row);
 }
}}}
walk(root);
for(const c of cells){c.counts=Object.fromEntries(['r2','r3','other'].map(k=>[k,{attempts:c[k].length,searchAndExtract:c[k].filter(r=>r.actualSearchAndExtract).length,naturalSearchAndExtract:c[k].filter(r=>r.actualSearchAndExtract&&!r.controlled).length,deaths:c[k].filter(r=>r.outcome==='death').length,deepKindlingBroughtHome:c[k].reduce((n,r)=>n+r.deepKindlingBroughtHome,0)}]));}
const result={generatedAt:new Date().toISOString(),method:'Actual-input reports with unique run ID only. Search-and-extract means one or more actually collected remains and successful return; does not assert alternate-route, visual, prepared-value or independent player review. Deaths/empty exits stay as attempts. Old r2 low/medium is listed separately, never automatically promoted to r3.',contractScope:'Each world requires actual search-and-return evidence; separate normal-view grade/seed matrix, continuous supply and prepared comparisons are different denominators. Cell counts here do not impose two full journeys for every world-grade.',excluded,cells};
fs.writeFileSync(out,JSON.stringify(result,null,2));
const worldsWithCurrent=worlds.filter(world=>cells.some(c=>c.world===world&&c.counts.r3.searchAndExtract>0));
console.log(`${seen.size} distinct complete-input attempts; ${worldsWithCurrent.length}/20 worlds have actual r3 search/extract evidence. Grade-cell counts are descriptive, not a new acceptance gate.`);
