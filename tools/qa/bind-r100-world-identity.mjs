/** Bind this bounded visual revision, retaining historical completed iterations.
 * In particular, new geometry never inherits revision 3's whole-run qualification. */
import fs from 'node:fs';
import assert from 'node:assert/strict';
import { createHash } from 'node:crypto';
import { checkPlan } from '../world-study/r100-progress.mjs';
const base='docs/qa/artifacts/r100-world-identity',ledgerPath='docs/progress/rift-r100.json';
const read=p=>JSON.parse(fs.readFileSync(p,'utf8'));
const sha=p=>createHash('sha256').update(fs.readFileSync(p)).digest('hex');
const source=`${base}/final-source/source-snapshot.json`, revision='r100-native-v3-revision-4';
const packages=read(`${base}/packages/index.json`).worlds,qualification=read(`${base}/qualification/report.json`);
assert.equal(qualification.status,'pass');assert.equal(qualification.cases,120);assert.equal(qualification.failures.length,0);
const normal=read(`${base}/after/report.json`), grades=read(`${base}/after-grades/report.json`);
assert.equal(normal.status,'captured');assert.equal(normal.cases.length,20);assert.equal(grades.status,'captured');assert.equal(grades.cases.length,40);
const reports=folder=>fs.readdirSync(folder,{withFileTypes:true}).flatMap(e=>e.isDirectory()?reports(`${folder}/${e.name}`):e.name==='report.json'?[`${folder}/${e.name}`]:[]);
const productionFiles=[`${base}/production/report.json`,...reports(`${base}/production-recheck`)];
const runs=productionFiles.flatMap(path=>read(path).cases.map(row=>({...row,path})));
const art='docs/art/rift-r100-world-identity.md';assert(fs.existsSync(art));
const data=read(ledgerPath),before=structuredClone(data),gradeIds=['low','medium','severe'];
const add=e=>{const prior=data.evidence.find(x=>x.id===e.id);if(prior)assert.deepEqual(prior,e);else data.evidence.push(e);};
const changes=[];
for(const world of data.worlds){
 const receipt=packages.find(row=>row.worldId===world.id);assert(receipt);assert.equal(sha(receipt.dependencyManifest.path),receipt.dependencyManifest.hash);
 const manifest=read(receipt.dependencyManifest.path);assert.equal(manifest.algorithm.revision,4);
 for(const dep of manifest.dependencies)assert.equal(sha(dep.path),dep.sha256,dep.path);
 for(const grade of gradeIds){const record=runs.find(row=>row.world===world.id&&row.grade===grade&&row.status==='passed');assert(record,`${world.id}/${grade}: current formal entry/recovery missing`);assert.equal(record.identity.generation.package.algorithmRevision,4);assert(record.coldIdentityPreserved);}
 const common={revision,worldId:world.id,dependencyHash:receipt.dependencyManifest.hash,grades:gradeIds,sourceManifest:source,sourceManifestSha256:sha(source)};
 const technical={...common,id:`R100-R4-TECHNICAL-${world.id}`,kind:'automated',purpose:'technical-review',path:`${base}/qualification/report.json`,scope:'当前20世界×3档×2固定种子120生成、Host、全身体路径、transfer与冷重构；兼容、材质与有限边界专项另列。',limitations:'两固定种子的有限技术验证，不沿用旧2400+480数量，不是所有种子、弱设备或完整体验。'};
 const visual={...common,id:`R100-R4-VISUAL-${world.id}`,kind:'runtime',purpose:'bounded-visual-review',path:art,scope:'20世界中档正常入场/前进，以及另一种子的低/重档实帧；集中记录逐世界近邻与混合实体补图。',limitations:'内部知情美术审查，不是用户终审或新玩家盲测；短镜头不证明整个地图或全路线边界。'};
 const production={...common,id:`R100-R4-PRODUCTION-${world.id}`,kind:'runtime',purpose:'production-integration',path:`${base}/completion.json`,coverage:['production-entry','recovery'],scope:'三档实际标题/备行/正式出发和检查点冷续；逐world固定第一次种子选择、独立新存档。',limitations:'准备页由正常scene方法打开以隔离基地寻路；控制world覆盖不是自然世界选择或完整搜撤。原菜单等待失败与定向复验单列，不删除。'};
 for(const evidence of [technical,visual,production]){add(evidence);if(!world.evidenceIds.includes(evidence.id))world.evidenceIds.push(evidence.id);}
 changes.push({worldId:world.id,previousRevision:world.revision,previousManifest:world.dependencyManifest,currentManifest:receipt.dependencyManifest});
 Object.assign(world,{revision,generation:{id:'r100-native',version:3,revision:4},dependencyManifest:receipt.dependencyManifest,invalidated:false});
 world.review={technical:'pass',visual:'pass',experience:'pending',human:'pending'};
 world.reviewEvidence={technical:[technical.id],visual:[visual.id],experience:[],human:[]};
 world.knownVisualLimitations='当前有限正常镜头内部复核通过；未代签用户审美，全部路线/种子与长程体验继续独立验证。';
 world.reviewScope={...world.reviewScope,technical:technical.scope,visual:visual.scope,experience:'几何已改变，旧修订3完整搜返及双种子过程不能直接继承；本批壳链一条短搜返只归限定QA，其余长程玩法资格待I07补验。',human:'本批修订4尚未获用户终审。'};
 for(const grade of gradeIds)Object.assign(world.grades[grade],{integration:'production',invalidated:false,review:{...world.review},reviewEvidence:structuredClone(world.reviewEvidence),integrationEvidence:[production.id]});
}
const completion={status:'bounded-visual-revision-complete',revision,worlds:20,gradeCases:60,newWorlds:0,source,sourceSha256:sha(source),generation:{path:`${base}/qualification/report.json`,sha256:sha(`${base}/qualification/report.json`),cases:120},normalFrames:120,normalReports:[`${base}/after/report.json`,`${base}/after-grades/report.json`],productionReports:productionFiles.map(path=>({path,sha256:sha(path)})),art:{path:art,sha256:sha(art)},changes,limits:'Current technical and bounded visual checks pass. New-geometry complete expedition qualification and human art review remain pending. Historical I01-I06 completions are retained. This does not close I07 or add worlds.'};
fs.writeFileSync(`${base}/completion.json`,JSON.stringify(completion,null,2)+'\n');
Object.assign(data.resume,{iteration:'R100-I07',batch:'Existing 20-world identity correction before expansion',headline:'20世界视觉重构已接入；I03–I06历史完成保留，I07扩产未完成',updatedDate:'2026-10-05',evidenceRevision:revision,lastCompleted:'20世界独立材料色与17派生构造深化；修订3封存，修订4有限生成、正常实图与正式进入/冷续已复核。',nextAction:'先复看修订4世界身份并补新几何完整搜撤与双种子玩法资格，再按现有差异缺口扩到I07目标36世界；不把本次20世界整改计成新增。'});
const i07=data.iterations.find(i=>i.id==='R100-I07');Object.assign(i07,{state:'active',stage:'experience-review',actualRevision:revision,goal:'先修正当前20世界区分度并补新几何玩法资格，再扩到累计36世界。'});
const risk=data.risks.find(r=>r.id==='R100-R02');risk.response='2026-10-05按用户反馈完成当前20世界材料本色、非周期地表组织和17派生实体构造深化；正常视野最近邻及三档有限图审通过，用户终审与新几何长程过程待补。先验证场所差异再扩数量；历史修订3资格与当前修订4分账。';
data.changeLog.push({date:'2026-10-05',summary:'当前20世界视觉身份修订4已接入；120生成、120正常实帧及60正式出发/冷续完成。旧修订3完整资格保留为历史，修订4新几何完整玩法资格待补；I07前置整改完成但扩产尚未完成。'});
assert.deepEqual(data.iterations.slice(0,6),before.iterations.slice(0,6),'Historical closed iterations must not be rewritten');
const result=checkPlan(data);assert(result.ok,result.errors.join('\n'));assert.equal(result.counts.candidates,20);assert.equal(result.counts.qualified,0,'Do not manufacture current complete gameplay approval');
fs.writeFileSync(ledgerPath,JSON.stringify(data,null,2)+'\n');console.log('PASS bounded revision4 binding:20 current implementations, historical6 completions retained; whole-run qualification pending');
