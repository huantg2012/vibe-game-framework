/** One diagnostic of the original request, not a replacement field journey. */
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { createHash } from 'node:crypto';
import { pathToFileURL } from 'node:url';
import { build } from 'esbuild';
const base='docs/qa/artifacts/r100-i10-i12/b04-worker-failure-diagnosis';
const sourcePath='docs/qa/artifacts/r100-i10-i12/b04-buried-raised-source/source-snapshot.json';
const sha=data=>createHash('sha256').update(data).digest('hex');
const receipt=file=>({path:file,sha256:sha(fs.readFileSync(file))});
const source=JSON.parse(fs.readFileSync(sourcePath));
assert.equal(receipt(sourcePath).sha256,'f7c0302cba8c86b82dd972731205e1db1e193380f6c98fd9727202127f69e94d');
const reportPath=base+'/node-identity-report.json',output=base+'/node-identity-executor.mjs';
assert(!fs.existsSync(reportPath));assert(!fs.existsSync(output));
const verify=()=>{for(const[file,hash]of Object.entries(source.sources))assert.equal(sha(fs.readFileSync(path.join(source.temporaryRoot,file))),hash,file);};
verify();
const built=await build({stdin:{contents:`import {createR100ProductionRecipe,validR100ProductionRecipe} from './src/generation/world-study/r100-package';
import {executeRiftGeneration} from './src/generation/rift-generation-execute';
import {riftGenerationTransferables} from './src/generation/rift-generation-protocol';
export {createR100ProductionRecipe,validR100ProductionRecipe,executeRiftGeneration,riftGenerationTransferables};`,resolveDir:source.temporaryRoot,sourcefile:'same-request-diagnostic.ts',loader:'ts'},bundle:true,platform:'node',format:'esm',target:'node22',outfile:output,metafile:true,tsconfig:path.join(source.temporaryRoot,'tsconfig.json')});
const dependencies=Object.keys(built.metafile.inputs).filter(file=>!file.endsWith('same-request-diagnostic.ts')).map(file=>{const actual=path.resolve(file),relative=path.relative(source.temporaryRoot,actual);assert(source.sources[relative],relative);assert.equal(receipt(actual).sha256,source.sources[relative]);return{file:relative,sha256:source.sources[relative]};});
const report={status:'running',source:receipt(sourcePath),runner:receipt(base+'/check-node-identity.mjs'),executor:receipt(output),dependencies,requested:{world:'buried-lamellae',grade:'severe',seed:3075192741},startedAt:new Date().toISOString(),method:'Exact frozen3110 generation and structured-clone ownership transfer in Node. This does not test Chrome module imports, Worker startup/lifecycle or reproduce the historical browser failure.'};
try{
 const lib=await import(pathToFileURL(path.resolve(output)).href),generation=lib.createR100ProductionRecipe(report.requested.world,report.requested.seed,report.requested.grade);
 assert(lib.validR100ProductionRecipe(generation));assert.equal(generation.package.algorithmRevision,6);
 const began=performance.now(),wire=lib.executeRiftGeneration({kind:'departure',generation});
 report.generationWallMs=performance.now()-began;report.generationReportedMs=wire.generationMs;
 report.identity=wire.identity;const identityHash=sha(JSON.stringify(wire.identity));
 const buffers=lib.riftGenerationTransferables(wire);report.transferBufferCount=buffers.length;report.transferBytes=buffers.reduce((sum,buffer)=>sum+buffer.byteLength,0);
 const clone=structuredClone(wire,{transfer:buffers});assert.equal(sha(JSON.stringify(clone.identity)),identityHash);assert(buffers.every(buffer=>buffer.byteLength===0));
 report.identitySha256=identityHash;report.transferIdentityExact=true;report.status='pass';
}catch(error){report.status='failed';report.error=String(error.stack??error);throw error;}
finally{verify();report.sourceBeforeAndAfterExact=true;report.finishedAt=new Date().toISOString();fs.writeFileSync(reportPath,JSON.stringify(report,null,2)+'\n',{flag:'wx'});}
console.log(JSON.stringify({status:report.status,generationWallMs:report.generationWallMs,transferBytes:report.transferBytes,identitySha256:report.identitySha256}));
