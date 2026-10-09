/** No browser execution. Independently verify the final new-RC kit and actual reference CLI receipts. */
import fs from 'node:fs';import assert from 'node:assert/strict';import {createHash} from 'node:crypto';import {spawnSync} from 'node:child_process';
const base='docs/qa/artifacts/r100-i14/',dir=base+'root/device-kit-rc/',kit='dist/r100-i14-device-kit-rc-clean-20261009',hash=b=>createHash('sha256').update(b).digest('hex'),sha=f=>hash(fs.readFileSync(f)),refs=[];
const ref=file=>({file,sha256:sha(file)}),read=f=>{refs.push(ref(f));return JSON.parse(fs.readFileSync(f));};function bound(r){assert.equal(sha(r.path??r.file),r.sha256);refs.push(ref(r.path??r.file));}
const h=read(dir+'handoff-clean.json'),m=read(dir+'manifest.json'),rc=read(h.release.path),policy=read(h.runtimePolicy.path);for(const r of [h.release,h.manifest,h.archive,h.exporter,h.runner,h.runtimePolicy,h.historicalFocusCheck])bound(r);
assert.equal(h.release.sha256,'bbea9d40ab270586e6361b56b764050670b92101270c051715d3a1e1521690d3');assert.deepEqual(m.release,h.release);assert.equal(m.productionSourceCount,1398);assert.equal(m.uniquePackageDependencies,308);assert.equal(Object.keys(m.files).length,1519);assert.equal(sha(kit+'/I14-DEVICE-MANIFEST.json'),h.manifest.sha256);
for(const[f,s]of Object.entries(m.files))assert.equal(sha(kit+'/'+f),s,f);
const source=read(rc.finalSource.path);for(const[f,s]of Object.entries(source.sources))assert.equal(m.files[f],s);assert.equal(sha(h.archive.path),h.archive.sha256);assert.equal(fs.statSync(h.archive.path).size,h.archiveBytes);
assert.equal(policy.releaseCandidate.revision,rc.revision);assert.equal(policy.releaseCandidate.sha256,h.release.sha256);assert.deepEqual(read(policy.sourceManifest.file).sources,source.sources);const oldPolicy=read(base+'runtime-policy-freeze.json');for(const k of ['worlds','grade','seed','keys','heldMs','minimumActiveMs','budgets','tools'])assert.deepEqual(policy[k],oldPolicy[k],k);
for(const r of[policy.taskContract,policy.sourceManifest,...policy.dependencies])bound(r);for(const r of policy.tools)bound(r);
for(const c of h.checks){assert.equal(c.exitCode,0);if(c.log)bound(c.log);if(c.report)bound(c.report);}
const cli=read(dir+'cli-play-lifecycle.json');assert.equal(cli.status,'passed-reference-cli-only-page-close-and-port-fallback');assert.equal(cli.exit.code,0);assert.equal(cli.timedOut,false);assert(cli.usedAlternatePort&&cli.ownServerProcessExited);const events=cli.observation.events,menu=events.find(e=>e.type==='menu');assert(menu.state.interactive&&menu.state.webgl);assert.equal(menu.state.currentSave,null);assert.equal(events.filter(e=>['pageerror','observer-error'].includes(e.type)).length,0);const closed=events.find(e=>e.type==='only-page-closed'),disconnected=events.find(e=>e.type==='disconnected');assert(closed&&disconnected);const closureMs=Date.parse(disconnected.at)-Date.parse(closed.at);assert(closureMs>=0&&closureMs<30000);
for(const f of ['cli-play-lifecycle.mjs','cli-play-lifecycle-proxy.mjs','cli-play-observation.json','README.md'])refs.push(ref(dir+f));assert.equal(fs.readFileSync(dir+'README.md','utf8'),fs.readFileSync(kit+'/README-I14.md','utf8'));
for(const f of h.retainedFailures){const r=read(f);assert.equal(r.status,'failed');}
// Inspect each tar member without extraction: exact manifest file set, no symlink/device/cache/user-save members.
const py=String.raw`import tarfile,json,hashlib,sys,posixpath
archive,manifest_path,prefix=sys.argv[1:]
m=json.load(open(manifest_path));expected=dict(m['files']);expected['I14-DEVICE-MANIFEST.json']=hashlib.sha256(open(manifest_path,'rb').read()).hexdigest();seen=set()
with tarfile.open(archive,'r:gz') as t:
 for member in t:
  name=member.name
  assert name==prefix or name.startswith(prefix+'/'),name
  relative=name[len(prefix):].lstrip('/')
  assert '..' not in relative.split('/'),name
  if member.isdir():continue
  assert member.isfile(),name
  assert relative in expected and relative not in seen,name
  content=t.extractfile(member).read()
  assert hashlib.sha256(content).hexdigest()==expected[relative],name
  seen.add(relative)
assert seen==set(expected),(len(seen),len(expected))
print(json.dumps({'memberFiles':len(seen),'manifestBoundFiles':len(m['files']),'exactFileSet':True,'allArchivedBytesMatch':True,'onlyRegularFilesAndDirectories':True,'unexpectedMembers':[]}))`;
const check=spawnSync('python3',['-c',py,h.archive.path,dir+'manifest.json','r100-i14-device-kit-rc-clean-20261009'],{encoding:'utf8'});assert.equal(check.status,0,check.stderr+check.stdout);const archiveCheck=JSON.parse(check.stdout);
bound(h.supersedes);bound(h.archiveCorrection.firstFailure);bound(h.cleanPreflight.log);assert.equal(h.cleanPreflight.exitCode,0);assert.equal(h.archiveCorrection.contentChanged,false);const previousHandoff=read(h.supersedes.path);assert.deepEqual(h.manifest,previousHandoff.manifest);const previousManifest=read(previousHandoff.manifest.path);assert.deepEqual(previousManifest,m);refs.push(ref(base+'qa-device-current-rc-review.mjs'));
const r={schemaVersion:1,createdAt:new Date().toISOString(),status:'current-RC-clean-device-kit-source-archive-and-reference-CLI-pass',reviewer:'qa',tool:ref(import.meta.filename),release:h.release,manifest:h.manifest,archive:h.archive,archiveBytes:h.archiveBytes,verifiedFiles:1519,productionFiles:1398,packageDependencies:308,archiveCheck,
 sourceBinding:'Current newRC hash and all1398 source files,108 package manifests/308 dependencies and same original performance tools/budgets are bound. Exporter requires explicit RC hash and matching policy source, rejecting a different candidate.',
 archiveCorrection:{firstFailure:h.archiveCorrection.firstFailure,oldArchive:previousHandoff.archive,removedUnmanifestedAppleDoubleMembers:1608,contentBytesUnchanged:true,installationAndCLIInheritedThroughExactManifest:true,cleanPreflightExitCode:0},
 referenceInstall:{gameNpmCi:0,separatePlaywrightInstall:0,preflight:0,receipt:ref(dir+'handoff.json')},referenceCLI:{browser:events.find(e=>e.type==='launched').version,formalMenuInteractive:true,webgl:true,currentSave:null,pageErrors:0,defaultPortOccupied:true,actualPort:new URL(menu.url).port,onlyPageCloseToDisconnectedMs:closureMs,exitCode:0,ownServerProcessExited:true,newSorties:0},
 wrapperReview:'Explicit real-focus override removal and page-close/disconnected cleanup retained; shared Vite5173/fallback applies to both modes. Measurement child and threshold bytes unchanged. Previous false-child failure behavior is historical wrapper coverage; current archive was not newly run through four performance worlds.',
 limitations:['Same M4 Pro reference device only. This does not fulfill actual weaker hardware, another OS, cross-engine, hearing/fatigue or user final acceptance.','The actualCLI used programmatic only-page close, not native title-bar interaction. MainMenu smoke is not a natural sortie or a new performance sample.','Trusted blur/held-pause/Enter came from prior v2 on unchanged focus production code; this currentRC CLI did not repeat that event probe.','The archive exactly contains only manifest-bound source/material/tool files plus its manifest, excluding installed dependencies/caches/device results/player saves. Installation requires Node/Chrome and package-registry access.','Installation and actualCLI receipts were recorded on the preceding identical source directory; no second install/browser was run merely to repack without AppleDouble metadata. This review does not revisit or bypass the refused file review page. Original v2 close-timeout and v3 observer-assumption failures remain immutable.'],humanApproval:false,releaseApproval:false,references:refs};
const out=base+'qa-device-current-rc-clean-review.json';fs.writeFileSync(out,JSON.stringify(r,null,2)+'\n',{flag:'wx'});console.log(JSON.stringify({output:ref(out),status:r.status,archiveCheck,closureMs}));
