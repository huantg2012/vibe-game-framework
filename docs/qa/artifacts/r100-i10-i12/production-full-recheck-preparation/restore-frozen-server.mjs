// Optional recovery of the SAME already-frozen source. Never creates a new snapshot.
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import {createHash} from 'node:crypto';
import {createServer} from 'vite';

const project=process.cwd();
const manifestFile='docs/qa/artifacts/r100-i10-i12/final-source/source-snapshot.json';
const expectedManifestSha='e4477ea30d618f8d3f76bab7379961ee5fb8cc668f580c84385626509bdbd1af';
const receiptFile='docs/qa/artifacts/r100-i10-i12/production-full-recheck-preparation/restore-execution.json';
const sha=file=>createHash('sha256').update(fs.readFileSync(file)).digest('hex');
assert.equal(sha(manifestFile),expectedManifestSha);
const manifest=JSON.parse(fs.readFileSync(manifestFile,'utf8'));
assert.equal(manifest.sourceRoot,project);
assert.equal(manifest.port,3122);
assert.equal(manifest.temporaryRoot,'/private/var/folders/h7/8bj85y3s2_j07mj1td8x3c740000gn/T/coh-r100-qa-IFvDxZ');
assert.equal(manifest.verifiedCopyHashes,true);
assert.deepEqual(manifest.patches,[]);
assert.equal(Object.keys(manifest.sources).length,1397);
for(const [file,expected] of Object.entries(manifest.sources)){
  assert(!path.isAbsolute(file)&&!file.split('/').includes('..'));
  assert.equal(sha(path.join(manifest.temporaryRoot,file)),expected,`Frozen source changed: ${file}`);
  assert.equal(sha(path.join(project,file)),expected,`Working source changed: ${file}`);
}
if(process.argv.includes('--verify-only')){
  console.log(JSON.stringify({status:'verified-only-no-server-start',manifest:manifestFile,sha256:expectedManifestSha,files:1397,port:3122}));
}else{
  assert.equal(process.env.QA_RESTORE_ORIGINAL_SOURCE,'1','Explicit root dispatch is required before restoring the server');
  assert(!fs.existsSync(receiptFile),'Preserve any previous restore receipt');
  const folder=manifest.temporaryRoot;
  // Exactly the original frozen-server configuration; only the original PID is different.
  const server=await createServer({root:folder,configFile:false,cacheDir:path.join(folder,'.vite-cache'),
    resolve:{alias:{'@':path.join(folder,'src')}},server:{host:'127.0.0.1',port:manifest.port,strictPort:true,
      open:false,hmr:false,watch:{ignored:['**/*']},fs:{allow:[folder,project]}}});
  await server.listen();
  assert.equal(sha(manifestFile),expectedManifestSha,'The frozen manifest must never be overwritten');
  const receipt={status:'restored-original-frozen-directory',at:new Date().toISOString(),manifest:{path:manifestFile,sha256:expectedManifestSha},
    temporaryRoot:folder,port:manifest.port,originalPid:manifest.pid,restoredPid:process.pid,parentPid:process.ppid,
    sourceFilesVerified:1397,manifestModified:false,newSnapshotCreated:false,servedSourceAudit:'Required separately before any browser launch'};
  fs.writeFileSync(receiptFile,JSON.stringify(receipt,null,2)+'\n',{flag:'wx'});
  console.log(JSON.stringify(receipt));
  for(const signal of ['SIGINT','SIGTERM'])process.once(signal,async()=>{await server.close();process.exit(0);});
}
