/** Additive verification of the new --play focus correction; old v1 evidence is immutable. */
import fs from 'node:fs';import assert from 'node:assert/strict';import {createHash} from 'node:crypto';
const base='docs/qa/artifacts/r100-i14',dir=`${base}/root/device-kit-v2`,kit='dist/r100-i14-device-kit-v2-20261009';
const hash=b=>createHash('sha256').update(b).digest('hex'),refs=[];
function read(file){const b=fs.readFileSync(file);refs.push({file,sha256:hash(b)});return JSON.parse(b);}
const old=read(`${base}/root/device-kit/manifest.json`),manifest=read(`${dir}/manifest.json`),handoff=read(`${dir}/handoff.json`);
assert.equal(hash(fs.readFileSync(`${kit}/I14-DEVICE-MANIFEST.json`)),handoff.manifestSha256);
assert.deepEqual(Object.keys(manifest.files).sort(),Object.keys(old.files).sort());
const changed=Object.keys(manifest.files).filter(f=>manifest.files[f]!==old.files[f]);assert.deepEqual(changed,['tools/qa/run-r100-i14-device.mjs']);
for(const[f,h]of Object.entries(manifest.files))assert.equal(hash(fs.readFileSync(`${kit}/${f}`)),h,f);
const archive=fs.readFileSync(handoff.archive);assert.equal(hash(archive),handoff.archiveSha256);assert.equal(archive.length,handoff.archiveBytes);
const oldRunner=fs.readFileSync('dist/r100-i14-device-kit-20261009/tools/qa/run-r100-i14-device.mjs','utf8'),newRunner=fs.readFileSync(`${kit}/tools/qa/run-r100-i14-device.mjs`,'utf8');
const added="    // Human play must receive real browser focus changes. Playwright otherwise pins focus on this page.\n    const focus = await context.newCDPSession(page);\n    await focus.send('Emulation.setFocusEmulationEnabled', {enabled: false});\n    await page.bringToFront();\n";
assert.equal(newRunner.replace(added,''),oldRunner);assert.equal(hash(fs.readFileSync('tools/qa/run-r100-i14-device.mjs')),manifest.files['tools/qa/run-r100-i14-device.mjs']);
const smoke=read(handoff.menuAndBlur.path);assert.equal(refs.at(-1).sha256,handoff.menuAndBlur.sha256);assert.equal(smoke.status,'passed-reference-menu-bootstrap-and-trusted-browser-blur');assert.deepEqual(smoke.errors,[]);assert.equal(smoke.weakDevice,false);assert.equal(smoke.manifestSha256,handoff.manifestSha256);assert.equal(smoke.sourceVerifiedAfter,true);
assert(smoke.focus.events.some(e=>e.type==='blur'&&e.trusted));assert.equal(smoke.focus.hidden,false);assert(smoke.returnedBeforeKey.paused);assert.equal(smoke.returnedBeforeKey.currentSave,null);assert(smoke.menu.interactive&&smoke.menu.webgl);assert.equal(smoke.menu.currentSave,null);
const failures=handoff.preservedSmokeFailures.map(r=>{const f=read(r.path);assert.equal(refs.at(-1).sha256,r.sha256);assert.equal(f.status,'failed');return{source:r,diagnosis:r.cause,failure:f.failure};});
for(const f of ['install-smoke-first-failure.mjs','install-smoke-second-failure.mjs','install-smoke.mjs','installed-kit-menu.png'])refs.push({file:`${dir}/${f}`,sha256:hash(fs.readFileSync(`${dir}/${f}`))});
const result={schemaVersion:1,createdAt:new Date().toISOString(),status:'v2-device-handoff-install-and-native-blur-source-pass',tool:{file:`${base}/qa-device-v2-review.mjs`,sha256:hash(fs.readFileSync(import.meta.filename))},
 supersedesForDelivery:`${base}/root/device-kit/handoff.json`,preservesOldReview:`${base}/qa-device-tool-review.json`,kitManifestSha256:handoff.manifestSha256,verifiedFiles:Object.keys(manifest.files).length,productionFiles:manifest.productionSourceCount,packageDependencies:manifest.uniquePackageDependencies,
 onlyChangedFile:changed[0],exactCodeChange:'Four lines after --play page.goto remove Playwright default focus emulation and bring the actual page to front; entire --run diagnostic branch unchanged.',
 archive:{sha256:handoff.archiveSha256,bytes:handoff.archiveBytes},observedMenuAndFocus:{browser:smoke.browser,trustedBlur:true,hidden:false,heldPauseBeforeKey:true,explicitEnterReturnsToMenu:true,currentSave:null,pageErrors:0,sourceUnchanged:true},
 preservedSmokeFailures:failures,
 limits:['Only reference Mac Chrome155, not a weaker machine or Windows/Linux qualification.','Normal MainMenu is interactive after explicit focus-overlay dismissal; this is not a natural sortie or performance sample.','Native blur observed; no visibility-hidden or OS-application focus claim.','Smoke invokes the installed kit bootstrap with the same reviewed context/CDP operations, not an end-to-end command-line --play close-window test.','Earlier /usr/bin/false child-failure evidence remains valid for unchanged --run; not repeated or relabelled as a real weak-device run.','This does not access or bypass the rejected review page and does not certify audio/fatigue/human release.'],references:refs};
fs.writeFileSync(`${base}/qa-device-v2-review.json`,JSON.stringify(result,null,2)+'\n',{flag:'wx'});console.log(JSON.stringify({status:result.status,files:result.verifiedFiles,onlyChangedFile:changed,archiveBytes:archive.length}));
