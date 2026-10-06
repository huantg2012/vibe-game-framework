/** Small adversarial fixtures for the evidence re-use gate, not gameplay samples. */
import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import {createHash} from 'node:crypto';
import {spawnSync} from 'node:child_process';
import {fileURLToPath} from 'node:url';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../..');
const harness = 'tools/qa/r100-source-continuity.mjs';
const temporary = fs.mkdtempSync(path.join(os.tmpdir(), 'coh-continuity-contract-'));
const sha = bytes => createHash('sha256').update(bytes).digest('hex');
const worldFile = 'src/generated/r100-native-worlds.ts';
const appearanceFile = 'src/generated/r100-world-appearance.ts';
const remainsFile = 'src/generated/rift-search-remains.ts';
const materialFile = 'src/generated/r100-package-manifest.ts';
const expansionFile = 'src/generation/world-study/native-volume-expansion.ts';
const world = {id:'fixture-rib', enabled:false, definitions:[{instances:[{constructionVersion:3, shapeProfile:'rib-vault'}]}]};
const literal = (name, value) => `export const ${name} = ${JSON.stringify(value)} as const;\n`;
const original = {
  [worldFile]:literal('R100_NATIVE_WORLDS', [world]),
  [appearanceFile]:literal('R100_WORLD_APPEARANCES', [{worldId:world.id, color:'#234'}]),
  [remainsFile]:literal('SEARCH_REMAINS', [{worldId:world.id, form:'rib'}]),
  [materialFile]:literal('R100_MATERIAL_DEPENDENCIES', [{path:'fixture', sha256:'abc'}]),
  [expansionFile]:'function pleatedSheet() { return 1; }\nfunction ribVault() { return 9; }\nexport const dispatch = ribVault;\n',
};
function snapshot(name, files) {
  const directory = path.join(temporary, name), sources = {};
  for (const [file, content] of Object.entries(files)) {
    fs.mkdirSync(path.dirname(path.join(directory,file)), {recursive:true});
    fs.writeFileSync(path.join(directory,file), content); sources[file] = sha(content);
  }
  const manifest = path.join(directory,'source-snapshot.json');
  fs.writeFileSync(manifest, JSON.stringify({temporaryRoot:directory,sources}));
  return manifest;
}
const results = [];
function run(name, mutate, expected, mode='unused-profiles', mutateBefore=null) {
  const old = structuredClone(original), next = structuredClone(original);
  mutateBefore?.(old); mutate(next);
  const before = snapshot(`${name}-before`,old), after = snapshot(`${name}-after`,next);
  const output = path.join(temporary,`${name}.json`);
  const result = spawnSync(process.execPath,[harness,'--from',before,'--to',after,'--worlds',world.id,'--output',output,'--unused-shape-change',mode],{cwd:root,encoding:'utf8'});
  assert.equal(result.status === 0, expected, `${name}: ${result.stderr || result.stdout}`);
  assert.equal(fs.existsSync(output),expected,`${name} must not write a false receipt`);
  results.push({name, expected:expected?'pass':'reject', actualExitCode:result.status});
  return result;
}
try {
  run('identical-source',()=>{},true);
  run('unused-profile-body',files=>files[expansionFile]=files[expansionFile].replace('return 1','return 2'),true);
  run('strict-mode-rejects-body-change',files=>files[expansionFile]=files[expansionFile].replace('return 1','return 2'),false,'none');
  const usesPleated = files=>{
    const changed=structuredClone(world);changed.definitions[0].instances[0].shapeProfile='pleated-sheet';
    files[worldFile]=literal('R100_NATIVE_WORLDS',[changed]);
  };
  assert.match(run('used-profile-cannot-be-ignored',usesPleated,false,'unused-profiles',usesPleated).stderr,/uses a revised profile/);
  run('shared-dispatch-change',files=>files[expansionFile]=files[expansionFile].replace('dispatch = ribVault','dispatch = pleatedSheet'),false);
  run('used-body-change',files=>files[expansionFile]=files[expansionFile].replace('return 9','return 8'),false);
  run('appearance-change',files=>files[appearanceFile]=literal('R100_WORLD_APPEARANCES',[{worldId:world.id,color:'#456'}]),false);
  run('remains-change',files=>files[remainsFile]=literal('SEARCH_REMAINS',[{worldId:world.id,form:'leaf'}]),false);
  run('material-dependency-change',files=>files[materialFile]=literal('R100_MATERIAL_DEPENDENCIES',[{path:'fixture',sha256:'def'}]),false);
  run('new-runtime-file',files=>files['src/new.ts']='export const x=1;',false);
  run('deleted-runtime-file',files=>delete files[expansionFile],false);
  run('enabled-only-and-catalog-append',files=>files[worldFile]=literal('R100_NATIVE_WORLDS',[{...world,enabled:true},{...world,id:'another'}]),true);
  const arg=process.argv.indexOf('--output');
  const report={status:'pass',scope:'Evidence continuity gate fixtures only; no new game, art or play qualification.',harness:{path:harness,sha256:sha(fs.readFileSync(path.join(root,harness)))},checks:results};
  if(arg>=0){assert(process.argv[arg+1]); const output=path.resolve(root,process.argv[arg+1]);assert(!fs.existsSync(output),'Do not overwrite gate evidence');fs.mkdirSync(path.dirname(output),{recursive:true});fs.writeFileSync(output,JSON.stringify(report,null,2)+'\n');}
  console.log(JSON.stringify(report,null,2));
} finally { fs.rmSync(temporary,{recursive:true,force:true}); }
