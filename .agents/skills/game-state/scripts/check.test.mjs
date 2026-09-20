import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import {execFileSync,spawnSync} from 'node:child_process';
import {fileURLToPath} from 'node:url';
import {loadModel,impact} from './game-state.mjs';
import {renderHtml,renderIndex} from './render.mjs';
const cli=fileURLToPath(new URL('./game-state.mjs',import.meta.url));
const write=(p,v)=>fs.writeFileSync(p,JSON.stringify(v,null,2)+'\n');
function fixture(t){
  const root=fs.mkdtempSync(path.join(os.tmpdir(),'game-state-test-'));t.after(()=>fs.rmSync(root,{recursive:true,force:true}));
  const run=(...args)=>spawnSync(process.execPath,[cli,...args,'--root',root],{encoding:'utf8'});
  assert.equal(run('init').status,0);const dir=path.join(root,'docs/game-state');
  fs.mkdirSync(path.join(root,'src'));fs.writeFileSync(path.join(root,'src/game.js'),'export const play = true;\n');
  const ap=path.join(dir,'atlas.json'), atlas=JSON.parse(fs.readFileSync(ap));
  atlas.project={id:'test',title:'没有战斗的邮差',summary:'投递解谜'};
  atlas.domains.forEach(d=>{d.coverage=d.id==='loop'?'mapped':'not-applicable';d.note='本隔离测试仅包含投递循环';});
  atlas.inventory=[{id:'code',title:'正式代码',include:['src/**/*.js'],exclude:[]}];write(ap,atlas);
  const feature={id:'DELIVER',title:'投递包裹',domain:'loop',summary:'选择收件人',delivery:'production',work:'settled',entryPoints:['开始 → 投递'],sources:[{path:'src/game.js',role:'code'}],dependsOn:[],evidence:[],unknowns:['尚未实机验收']};
  write(path.join(dir,'features/core.json'),[feature]);
  return {root,dir,run,atlas,feature,saveFeatures:features=>write(path.join(dir,'features/core.json'),features)};
}
test('initialization refuses existing data and separates structural freshness from acceptance',t=>{
  const f=fixture(t);assert.equal(f.run('init').status,1);assert.equal(f.run('check').status,2);
  assert.equal(f.run('baseline').status,1);assert.equal(f.run('baseline','--reviewed').status,0);assert.equal(f.run('check').status,0);
  assert.ok(loadModel(f.root).diagnostics.warnings.some(x=>x.includes('DELIVER')));
  assert.deepEqual(JSON.parse(fs.readFileSync(path.join(f.dir,'features/core.json')))[0].unknowns,['尚未实机验收']);
});
test('changed source and new unowned source cannot silently pass',t=>{
  const f=fixture(t);assert.equal(f.run('baseline','--reviewed').status,0);
  fs.appendFileSync(path.join(f.root,'src/game.js'),'// changed');assert.equal(f.run('check').status,2);
  fs.writeFileSync(path.join(f.root,'src/menu.js'),'export const menu=1');
  assert.equal(f.run('baseline','--reviewed').status,1);assert.deepEqual(loadModel(f.root).inventory[0].unowned,['src/menu.js']);
  f.feature.sources.push({path:'src/menu.js',role:'code'});f.saveFeatures([f.feature]);assert.equal(f.run('baseline','--reviewed').status,0);
});
test('broken IDs, missing paths and unsupported production claims fail',t=>{
  const f=fixture(t);f.feature.dependsOn=['MISSING'];f.feature.sources=[{path:'absent.md',role:'spec'}];f.saveFeatures([f.feature]);
  const m=loadModel(f.root);assert.ok(m.diagnostics.errors.length>=3);assert.equal(f.run('render').status,1);
});
test('impact follows reverse dependencies safely through cycles and returns upstream context',t=>{
  const f=fixture(t);const feat=(id,dependsOn)=>({...f.feature,id,dependsOn,sources:[{path:'src/game.js',role:'code'}]});
  f.saveFeatures([feat('BASE',[]),feat('A',['BASE','B']),feat('B',['A']),feat('C',['B'])]);
  const result=impact(loadModel(f.root),[],'A');assert.deepEqual(result.direct,['A']);assert.deepEqual(result.dependents,['B','C']);assert.deepEqual(result.readDependencies,['BASE']);
});
test('baseline never renews evidence freshness against old revision',t=>{
  const f=fixture(t);const g=(...args)=>execFileSync('git',['-C',f.root,...args],{encoding:'utf8',stdio:['ignore','pipe','pipe']}).trim();
  g('init','-q');g('add','src/game.js');g('-c','user.name=Fixture','-c','user.email=fixture@example.invalid','commit','-qm','fixture');
  const revision=g('rev-parse','HEAD');f.feature.evidence=['EV'];f.saveFeatures([f.feature]);
  write(path.join(f.dir,'evidence.json'),[{id:'EV',kind:'source',result:'partial',date:'2026-09-20',revision,scope:'代码路径',limitations:'无运行证据',sources:[{path:'src/game.js',role:'code'}]}]);
  assert.equal(loadModel(f.root).evidenceFreshness.EV.state,'unchanged');fs.appendFileSync(path.join(f.root,'src/game.js'),'\n// update');
  assert.equal(f.run('baseline','--reviewed').status,0);assert.equal(loadModel(f.root).evidenceFreshness.EV.state,'changed');
});
test('test source alone cannot stand for a passed runtime execution',t=>{
  const f=fixture(t);f.feature.evidence=['EV'];f.saveFeatures([f.feature]);
  write(path.join(f.dir,'evidence.json'),[{id:'EV',kind:'runtime',result:'pass',date:'2026-09-20',revision:'unknown',scope:'未运行',limitations:'没有实录',sources:[{path:'src/game.js',role:'test'}]}]);
  assert.equal(f.run('check').status,1);
});
test('paths may not traverse or leak outside project root',t=>{
  const f=fixture(t);f.feature.sources=[{path:'../secret.txt',role:'code'}];f.saveFeatures([f.feature]);assert.equal(f.run('check').status,1);
});
test('offline rendering preserves unknowns; text-only refresh leaves prior HTML untouched',t=>{
  const f=fixture(t);f.feature.title='</script><script>globalThis.pwned=1</script>';f.saveFeatures([f.feature]);
  assert.equal(f.run('baseline','--reviewed').status,0);const model=loadModel(f.root);
  assert.ok(renderIndex(model).includes('DELIVER'));const html=renderHtml(model);
  assert.ok(!html.includes('</script><script>globalThis.pwned=1</script>'));
  assert.equal(f.run('render').status,0);const output=path.join(f.dir,'atlas.html'), before=fs.readFileSync(output,'utf8');
  f.feature.summary='新的投递条件';f.saveFeatures([f.feature]);assert.equal(f.run('render','--index-only').status,0);assert.equal(fs.readFileSync(output,'utf8'),before);
});
