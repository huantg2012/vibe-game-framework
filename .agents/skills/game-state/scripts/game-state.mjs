#!/usr/bin/env node
/** Engine-independent, offline game-state index. Node built-ins only. */
import fs from 'node:fs';
import path from 'node:path';
import crypto from 'node:crypto';
import { execFileSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';
import { renderHtml, renderIndex } from './render.mjs';

export const DOMAINS = [
  ['loop','核心循环'], ['controls','操作与玩家能力'], ['world','场景与地图'],
  ['encounters','遭遇与挑战'], ['items','物品与内容'], ['progression','成长与经济'],
  ['interface','菜单与信息界面'], ['presentation','美术、音频与反馈'],
  ['narrative','叙事与世界规则'], ['persistence','存档、恢复与交付'],
  ['accessibility','设置与可访问性'], ['development','开发、挂起与退役内容'],
];
const ROLES = ['spec','code','data','test','decision','art','audio','doc'];
const hash = value => crypto.createHash('sha256').update(value).digest('hex');
const string = value => typeof value === 'string' && value.trim().length > 0;
const unique = values => [...new Set(values)].sort();
const posix = value => value.split(path.sep).join('/');
function safeRelative(value) {
  return string(value) && !path.isAbsolute(value) && !value.includes('\\') && !value.split('/').includes('..') && !value.includes(':') && !value.includes('\0');
}
function contained(root, relative) {
  if (!safeRelative(relative)) throw new Error(`需要项目内相对路径: ${relative}`);
  const resolved = path.resolve(root, relative);
  if (fs.existsSync(resolved)) {
    const real = fs.realpathSync(resolved);
    if (real !== root && !real.startsWith(root + path.sep)) throw new Error(`符号链接越过项目根: ${relative}`);
  }
  return resolved;
}
function git(root, args) {
  try { return execFileSync('git', ['-C', root, ...args], {encoding:'utf8',stdio:['ignore','pipe','ignore'],maxBuffer:16*1024*1024}).trim(); }
  catch { return null; }
}
function writeJSON(file, value) { fs.writeFileSync(file, JSON.stringify(value, null, 2) + '\n'); }
function globRegex(pattern) {
  if (!safeRelative(pattern)) throw new Error(`非法 inventory pattern: ${pattern}`);
  let out = '^';
  for (let i=0; i<pattern.length; i++) {
    const c = pattern[i];
    if (c === '*' && pattern[i+1] === '*') {
      i++; if (pattern[i+1] === '/') { i++; out += '(?:.*/)?'; } else out += '.*';
    } else if (c === '*') out += '[^/]*';
    else if (c === '?') out += '[^/]';
    else out += c.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
  }
  return new RegExp(out + '$');
}
function scan(root, patterns) {
  const found = new Set();
  for (const pattern of patterns) {
    const regex = globRegex(pattern);
    const fixed = pattern.split('/').filter((part, i, parts) => !parts.slice(0,i+1).some(p => /[*?]/.test(p))).join('/');
    const start = contained(root, fixed || '.');
    const walk = dir => {
      if (!fs.existsSync(dir)) return;
      const info = fs.lstatSync(dir);
      if (info.isSymbolicLink()) return;
      if (info.isFile()) { const rel=posix(path.relative(root,dir)); if(regex.test(rel)) found.add(rel); return; }
      for (const e of fs.readdirSync(dir,{withFileTypes:true})) {
        if (['.git','node_modules','.DS_Store'].includes(e.name)) continue;
        walk(path.join(dir,e.name));
      }
    };
    walk(start);
  }
  return [...found].sort();
}

export function loadModel(rootArg, atlasArg='docs/game-state/atlas.json') {
  const root=fs.realpathSync(rootArg), atlasFile=contained(root,atlasArg), dir=path.dirname(atlasFile);
  const diagnostics={errors:[],warnings:[],stale:[],unowned:[]};
  const {errors,warnings,stale,unowned}=diagnostics;
  const tracked = new Set();
  function read(file) {
    const rel=posix(path.relative(root,file));
    tracked.add(rel);
    try { return JSON.parse(fs.readFileSync(contained(root,rel),'utf8')); }
    catch(e) { errors.push(`${rel}: ${e.message}`); return null; }
  }
  function requireText(v,label) { if(!string(v)) errors.push(`${label}: 缺少非空文本`); }
  function array(v,label) { if(!Array.isArray(v)){errors.push(`${label}: 必须为数组`);return [];}return v; }
  function choice(v,values,label) { if(!values.includes(v))errors.push(`${label}: 无效值 ${v}`); }
  function sources(v,label) {
    for(const s of array(v,label)) {
      if(!s || typeof s!=='object'){errors.push(`${label}: 非法来源`);continue;}
      choice(s.role,ROLES,`${label}.role`);
      try { const p=contained(root,s.path); if(!fs.statSync(p).isFile())throw new Error('不是文件'); tracked.add(s.path); }
      catch(e){errors.push(`${label}: ${s.path}: ${e.message}`);}
    }
  }
  function idMap(items,label) {
    const map=new Map();
    for(const item of items) {
      if(!item || typeof item!=='object'){errors.push(`${label}: 非法对象`);continue;}
      if(!string(item.id)||!/^[A-Za-z0-9][A-Za-z0-9._-]*$/.test(item.id)) errors.push(`${label}: 非法 ID ${item.id}`);
      if(map.has(item.id))errors.push(`${label}: 重复 ID ${item.id}`);
      map.set(item.id,item);
    }
    return map;
  }
  const atlas=read(atlasFile) || {};
  if(atlas.schemaVersion!==1)errors.push('schemaVersion 必须为 1');
  for(const k of ['id','title','summary']) requireText(atlas.project?.[k],`project.${k}`);
  const domains=array(atlas.domains,'domains'), domainMap=idMap(domains,'domains');
  for(const d of domains){requireText(d.title,'domain.title');requireText(d.note,'domain.note');choice(d.coverage,['mapped','unreviewed','not-applicable'],'domain.coverage');if(d.coverage==='unreviewed')warnings.push(`领域尚未核对: ${d.title}`);}
  // Default coverage vocabulary is replaceable, but any omission must be explicit.
  for(const [id,title] of DOMAINS) if(!domainMap.has(id))warnings.push(`标准覆盖域未登记: ${title} (${id})；请添加或说明替代分类`);
  const features=[]; const featureLocations={};
  for(const name of array(atlas.featureFiles,'featureFiles')) {
    try { const f=contained(dir,name); const entries=array(read(f),name); features.push(...entries); for(const entry of entries) if(entry?.id)featureLocations[entry.id]=posix(path.relative(root,f)); }
    catch(e){errors.push(e.message);}
  }
  let evidence=[];
  try { evidence=array(read(contained(dir,atlas.evidenceFile)),'evidence'); } catch(e){errors.push(e.message);}
  const fm=idMap(features,'features'), em=idMap(evidence,'evidence');
  for(const f of features) {
    for(const k of ['title','summary'])requireText(f[k],`${f.id}.${k}`);
    if(!domainMap.has(f.domain))errors.push(`${f.id}: 未知领域 ${f.domain}`);
    choice(f.delivery,['unknown','design','dev','production','retired'],`${f.id}.delivery`);
    choice(f.work,['active','paused','settled'],`${f.id}.work`);
    for(const k of ['entryPoints','dependsOn','evidence','unknowns']) for(const t of array(f[k],`${f.id}.${k}`))requireText(t,`${f.id}.${k}`);
    sources(f.sources,`${f.id}.sources`);
    if(f.delivery==='production' && (!f.entryPoints?.length || !f.sources?.some(s=>s.role==='code')))errors.push(`${f.id}: 正式接入声明需要玩家入口与代码来源`);
    if(f.delivery==='unknown' && !f.unknowns?.length)errors.push(`${f.id}: unknown 需要写明待核实问题`);
    for(const id of f.dependsOn||[])if(!fm.has(id)||id===f.id)errors.push(`${f.id}: 无效依赖 ${id}`);
    for(const id of f.evidence||[])if(!em.has(id))errors.push(`${f.id}: 缺少证据 ${id}`);
    if(!f.evidence?.length)warnings.push(`${f.id}: 未登记验证证据`);
  }
  for(const d of domains) {
    const n=features.filter(f=>f.domain===d.id).length;
    if(d.coverage==='mapped'&&!n)errors.push(`${d.id}: 声明已映射但没有功能`);
    if(d.coverage==='not-applicable'&&n)errors.push(`${d.id}: 不适用域却包含功能`);
  }
  for(const e of evidence) {
    choice(e.kind,['source','automated','runtime','human'],`${e.id}.kind`);
    choice(e.result,['pass','fail','partial','unknown'],`${e.id}.result`);
    for(const k of ['revision','scope','limitations'])requireText(e[k],`${e.id}.${k}`);
    if(!/^\d{4}-\d{2}-\d{2}$/.test(e.date)||!Number.isFinite(Date.parse(e.date)))errors.push(`${e.id}: date 需要有效 YYYY-MM-DD`);
    sources(e.sources,`${e.id}.sources`);
    if(!e.sources?.length)errors.push(`${e.id}: 没有证据来源`);
    if(e.kind!=='source'&&e.result==='pass'&&!e.sources?.some(s=>['doc','art','audio'].includes(s.role)))errors.push(`${e.id}: 执行/人工通过需要持久化报告或实录，代码/测试文件存在不是执行证据`);
  }
  const constraints=array(atlas.constraints,'constraints'), cm=idMap(constraints,'constraints');
  for(const c of constraints) {
    requireText(c.statement,`${c.id}.statement`);choice(c.status,['active','superseded'],`${c.id}.status`);
    sources(c.source?[{...c.source,role:'decision'}]:[],`${c.id}.source`);
    if(!c.source)errors.push(`${c.id}: 缺少决策来源`);
    for(const id of array(c.featureIds,`${c.id}.featureIds`))if(!fm.has(id))errors.push(`${c.id}: 未知功能 ${id}`);
    if(c.status==='superseded'&&(!cm.has(c.supersededBy)||c.supersededBy===c.id))errors.push(`${c.id}: 被替代约束需指向另一有效约束 ID`);
  }
  const owned=new Set(features.flatMap(f=>(f.sources||[]).map(s=>s.path)));
  const inventory=[];
  const declarations=array(atlas.inventory,'inventory');idMap(declarations,'inventory');
  if(!declarations.length)warnings.push('没有 inventory 扫描范围；新文件遗漏无法自动发现');
  for(const inv of declarations) {
    try {
      requireText(inv.title,`${inv.id}.title`);
      const patterns=array(inv.include,`${inv.id}.include`);
      if(!patterns.length)errors.push(`${inv.id}: include 不能为空`);
      const excludes=array(inv.exclude,`${inv.id}.exclude`).map(x=>{requireText(x.reason,`${inv.id}.exclude.reason`);return globRegex(x.pattern);});
      const files=scan(root,patterns).filter(p=>!excludes.some(r=>r.test(p)));
      files.forEach(p=>tracked.add(p));
      const missing=files.filter(p=>!owned.has(p)); unowned.push(...missing.map(p=>`${inv.id}: ${p}`));
      inventory.push({id:inv.id,title:inv.title,files,unowned:missing});
    }catch(e){errors.push(`${inv.id}: ${e.message}`);}
  }
  const fingerprints={};
  for(const p of [...tracked].sort())try{fingerprints[p]=hash(fs.readFileSync(contained(root,p)));}catch{}
  const snapshotFile=path.join(dir,'snapshot.json');let snapshot=null;
  if(fs.existsSync(snapshotFile))try{snapshot=JSON.parse(fs.readFileSync(snapshotFile,'utf8'));}catch(e){errors.push(`snapshot.json: ${e.message}`);}
  if(!snapshot)stale.push('尚未建立来源指纹基线');
  else if(snapshot.schemaVersion!==1||!snapshot.files||!snapshot.inventory)errors.push('snapshot.json 结构错误');
  else {
    for(const p of unique([...Object.keys(fingerprints),...Object.keys(snapshot.files)]))if(fingerprints[p]!==snapshot.files[p])stale.push(p);
    for(const inv of inventory)if(JSON.stringify(snapshot.inventory[inv.id]||[])!==JSON.stringify(inv.files))stale.push(`inventory:${inv.id}`);
  }
  const revision=git(root,['rev-parse','HEAD'])||'no-git';
  const evidenceFreshness={}; const revisionCache=new Map(), oldFileHashes=new Map();
  function hasRevision(ref){if(!revisionCache.has(ref))revisionCache.set(ref,git(root,['rev-parse','--verify',`${ref}^{commit}`]));return revisionCache.get(ref);}
  for(const e of evidence) {
    const code=unique(features.filter(f=>(f.evidence||[]).includes(e.id)).flatMap(f=>(f.sources||[]).filter(s=>['code','data','art','audio'].includes(s.role)).map(s=>s.path)));
    if(!/^[0-9a-f]{7,40}$/.test(e.revision)||!hasRevision(e.revision)) {
      evidenceFreshness[e.id]={state:'unknown',note:'无法按该版本自动对照；保留原范围，不代表当前有效',changed:[]};
    } else {
      const changed=code.filter(p=>{
        const key=`${e.revision}:${p}`;
        if(!oldFileHashes.has(key))try { const old=execFileSync('git',['-C',root,'show',key],{stdio:['ignore','pipe','ignore'],maxBuffer:16*1024*1024});oldFileHashes.set(key,hash(old)); }catch{oldFileHashes.set(key,null);}
        return oldFileHashes.get(key)!==fingerprints[p];
      });
      evidenceFreshness[e.id]={state:changed.length?'changed':'unchanged',note:changed.length?'关联实现已变：历史证据需重新判断适用范围':'登记的关联实现未变；仍仅证明原范围',changed};
    }
  }
  const changedEvidence=Object.values(evidenceFreshness).filter(e=>e.state==='changed').length;
  const unknownEvidence=Object.values(evidenceFreshness).filter(e=>e.state==='unknown').length;
  if(changedEvidence||unknownEvidence)warnings.push(`历史证据适用性：${changedEvidence} 条关联实现已变化，${unknownEvidence} 条无法按版本比较；基线不改变此判断。`);
  return {atlas,features,featureLocations,evidence,diagnostics,inventory,evidenceFreshness,meta:{generatedAt:new Date().toISOString(),revision,fingerprint:hash(JSON.stringify(fingerprints)),snapshotAt:snapshot?.capturedAt||null,root,atlasPath:atlasArg,linkPrefix:posix(path.relative(dir,root))+'/'},fingerprints,snapshot};
}

function template() {
  return {schemaVersion:1,project:{id:'new-game',title:'新游戏',summary:'待建立现状索引；尚未核对项目内容。'},domains:DOMAINS.map(([id,title])=>({id,title,coverage:'unreviewed',note:'初始化占位：需实际核查，或说明不适用原因。'})),featureFiles:['features/core.json'],evidenceFile:'evidence.json',constraints:[],inventory:[]};
}
function printDiagnostics(model) {
  for(const [type,entries] of Object.entries(model.diagnostics))for(const s of entries)console.log(`${type}: ${s}`);
  console.log(`登记 ${model.features.length} 项功能 / ${model.evidence.length} 条证据。结构与来源检查不等于玩法验收。`);
}
export function impact(model, changedPaths=[], featureID) {
  const direct=new Set(model.features.filter(f=>(f.sources||[]).some(s=>changedPaths.includes(s.path))).map(f=>f.id));
  for(const c of model.atlas.constraints||[])if(changedPaths.includes(c.source?.path))for(const id of c.featureIds)direct.add(id);
  if(featureID){if(!model.features.some(f=>f.id===featureID))throw new Error(`未知功能 ${featureID}`);direct.add(featureID);}
  const all=new Set(direct);let changed=true;
  while(changed){changed=false;for(const f of model.features)if(!all.has(f.id)&&f.dependsOn.some(id=>all.has(id))){all.add(f.id);changed=true;}}
  const requirements=new Set(); const queue=[...all];
  while(queue.length){const next=queue.pop();const f=model.features.find(f=>f.id===next);for(const id of f?.dependsOn||[])if(!all.has(id)&&!requirements.has(id)){requirements.add(id);queue.push(id);}}
  return {direct:[...direct].sort(),dependents:[...all].filter(id=>!direct.has(id)).sort(),readDependencies:[...requirements].sort(),changedPaths,unmappedChanges:changedPaths.filter(p=>!model.features.some(f=>f.sources.some(s=>s.path===p)))};
}
export function main(args=process.argv.slice(2)) {
  const command=args.shift();const opts={};
  const flags=new Set(['--reviewed','--index-only']);const values=new Set(['--root','--atlas','--since','--feature']);
  while(args.length){const k=args.shift();if(flags.has(k))opts[k]=true;else if(values.has(k)&&args.length&&!args[0].startsWith('--'))opts[k]=args.shift();else throw new Error(`未知/缺值参数: ${k}`);}
  if(!['init','check','baseline','render','impact'].includes(command))throw new Error('用法: game-state.mjs init|check|baseline|render|impact --root PROJECT [--atlas docs/game-state/atlas.json] [--reviewed] [--index-only] [--since REF] [--feature ID]');
  const root=fs.realpathSync(opts['--root']||process.cwd()), atlasArg=opts['--atlas']||'docs/game-state/atlas.json', atlasFile=contained(root,atlasArg), dir=path.dirname(atlasFile);
  if(command==='init'){
    if(fs.existsSync(dir)&&fs.readdirSync(dir).length)throw new Error('初始化目标目录非空；不覆盖已有索引');
    fs.mkdirSync(path.join(dir,'features'),{recursive:true});writeJSON(atlasFile,template());writeJSON(path.join(dir,'features/core.json'),[]);writeJSON(path.join(dir,'evidence.json'),[]);console.log(`已初始化 ${atlasArg}；所有领域明确待核实。`);return 0;
  }
  const model=loadModel(root,atlasArg);
  if(model.diagnostics.errors.length){printDiagnostics(model);return 1;}
  if(command==='check'){printDiagnostics(model);return model.diagnostics.stale.length||model.diagnostics.unowned.length?2:0;}
  if(command==='baseline'){
    if(!opts['--reviewed'])throw new Error('baseline 需要 --reviewed：先核对变化与受影响功能；此命令只记录文件指纹，不提升验证状态。');
    if(model.diagnostics.unowned.length){printDiagnostics(model);throw new Error('仍有未登记来源文件，先分类或写明排除理由');}
    writeJSON(path.join(dir,'snapshot.json'),{schemaVersion:1,capturedAt:new Date().toISOString(),revision:model.meta.revision,files:model.fingerprints,inventory:Object.fromEntries(model.inventory.map(i=>[i.id,i.files]))});console.log('已记录来源指纹；历史证据、未验证项和验收状态均未改变。');return 0;
  }
  if(command==='render'){
    fs.writeFileSync(path.join(dir,'INDEX.md'),renderIndex(model));
    if(!opts['--index-only'])fs.writeFileSync(path.join(dir,'atlas.html'),renderHtml(model));
    printDiagnostics(model);console.log(opts['--index-only']?'已刷新 INDEX.md':'已刷新 INDEX.md 与 atlas.html（离线快照）');return 0;
  }
  let changed=[];
  if(opts['--since']){
    const ref=opts['--since'];if(ref.startsWith('-')||!git(root,['rev-parse','--verify',`${ref}^{commit}`]))throw new Error(`无效 Git 版本: ${ref}`);
    const diff=git(root,['diff','--name-only',ref,'--']);if(diff===null)throw new Error('无法读取 Git 差异');changed.push(...diff.split('\n').filter(Boolean));
  }else if(!opts['--feature'])changed.push(...model.diagnostics.stale.filter(p=>model.fingerprints[p]||model.snapshot?.files?.[p]));
  const untracked=git(root,['ls-files','--others','--exclude-standard']);if(untracked)changed.push(...untracked.split('\n'));
  console.log(JSON.stringify(impact(model,unique(changed),opts['--feature']),null,2));return 0;
}
if(process.argv[1]&&path.resolve(process.argv[1])===fileURLToPath(import.meta.url))try{process.exitCode=main();}catch(e){console.error(e.message);process.exitCode=1;}
